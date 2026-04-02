import path from "node:path";
import { Readable } from "node:stream";
import { FormData, File } from "formdata-node";
import { FormDataEncoder } from "form-data-encoder";
import { JSDOM } from "jsdom";
import { R as RuntimeEnv, r as readBinaryFile, g as getNormalizeFilePath, a as readFileContent, c as configStore, publishToWechatDraft } from "./publish.js";
import { b, d, e, i, m, f, n, s, h, t, j, u } from "./publish.js";
import { createWenyanCore, getAllGzhThemes } from "./core.js";
import fs from "node:fs/promises";
import os from "node:os";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
function getServerUrl(options) {
  let serverUrl = options.server || "http://localhost:3000";
  serverUrl = serverUrl.replace(/\/$/, "");
  return serverUrl;
}
function getHeaders(options) {
  const headers = {};
  if (options.clientVersion) {
    headers["x-client-version"] = options.clientVersion;
  }
  if (options.apiKey) {
    headers["x-api-key"] = options.apiKey;
  }
  return headers;
}
async function healthCheck(serverUrl) {
  try {
    const healthRes = await fetch(`${serverUrl}/health`, { method: "GET" });
    if (!healthRes.ok) {
      throw new Error(`HTTP Error: ${healthRes.status} ${healthRes.statusText}`);
    }
    const healthData = await healthRes.json();
    if (healthData.status !== "ok" || healthData.service !== "wenyan-cli") {
      throw new Error(`Invalid server response. Make sure the server URL is correct.`);
    }
    return healthData.version;
  } catch (error) {
    throw new Error(
      `Failed to connect to server (${serverUrl}). 
Please check if the server is running and the network is accessible. 
Details: ${error.message}`
    );
  }
}
async function verifyAuth(serverUrl, headers) {
  const verifyRes = await fetch(`${serverUrl}/verify`, {
    method: "GET",
    headers
    // 携带 x-api-key 和 x-client-version
  });
  if (verifyRes.status === 401) {
    throw new Error("鉴权失败 (401)：Server 拒绝访问，请检查传入的 --api-key 是否正确。");
  }
  if (!verifyRes.ok) {
    throw new Error(`Verify Error: ${verifyRes.status} ${verifyRes.statusText}`);
  }
}
async function uploadStyledContent(gzhContent, serverUrl, headers) {
  const mdFilename = "publish_target.json";
  const mdForm = new FormData();
  mdForm.append(
    "file",
    new File([Buffer.from(JSON.stringify(gzhContent), "utf-8")], mdFilename, { type: "application/json" })
  );
  const mdEncoder = new FormDataEncoder(mdForm);
  const mdUploadRes = await fetch(`${serverUrl}/upload`, {
    method: "POST",
    headers: { ...headers, ...mdEncoder.headers },
    body: Readable.from(mdEncoder),
    duplex: "half"
  });
  const mdUploadData = await mdUploadRes.json();
  if (!mdUploadRes.ok || !mdUploadData.success) {
    throw new Error(`Upload Document Failed: ${mdUploadData.error || mdUploadData.desc || mdUploadRes.statusText}`);
  }
  const mdFileId = mdUploadData.data.fileId;
  return mdFileId;
}
async function requestServerPublish(mdFileId, serverUrl, headers, options) {
  const { theme, customTheme, highlight, macStyle, footnote } = options;
  const publishRes = await fetch(`${serverUrl}/publish`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fileId: mdFileId,
      theme,
      highlight,
      customTheme,
      macStyle,
      footnote
    })
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok || publishData.code === -1) {
    throw new Error(`Remote Publish Failed: ${publishData.desc || publishRes.statusText}`);
  }
  return publishData.media_id;
}
function needUpload(url) {
  return !/^(https?:\/\/|data:|asset:\/\/)/i.test(url);
}
async function uploadLocalImage(originalUrl, serverUrl, headers, relativePath) {
  const imagePath = RuntimeEnv.resolveLocalPath(originalUrl, relativePath);
  let fileBuffer;
  try {
    fileBuffer = await readBinaryFile(imagePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error(`[Client] Warning: Local image not found: ${imagePath}`);
      return null;
    }
    throw new Error(`Failed to read local image (${imagePath}): ${error.message}`);
  }
  const filename = path.basename(imagePath);
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml"
  };
  const type = mimeTypes[ext] || "application/octet-stream";
  const form = new FormData();
  form.append("file", new File([fileBuffer], filename, { type }));
  const encoder = new FormDataEncoder(form);
  const uploadRes = await fetch(`${serverUrl}/upload`, {
    method: "POST",
    headers: { ...headers, ...encoder.headers },
    body: Readable.from(encoder),
    duplex: "half"
  });
  const uploadData = await uploadRes.json();
  if (uploadRes.ok && uploadData.success) {
    return `asset://${uploadData.data.fileId}`;
  } else {
    console.error(`[Client] Warning: Failed to upload ${filename}: ${uploadData.error || uploadData.desc}`);
    return null;
  }
}
async function uploadLocalImages(content, serverUrl, headers, relativePath) {
  if (content.includes("<img")) {
    const dom = new JSDOM(content);
    const document2 = dom.window.document;
    const images = Array.from(document2.querySelectorAll("img"));
    const uploadPromises = images.map(async (element) => {
      const dataSrc = element.getAttribute("src");
      if (dataSrc && needUpload(dataSrc)) {
        const newUrl = await uploadLocalImage(dataSrc, serverUrl, headers, relativePath);
        if (newUrl) {
          element.setAttribute("src", newUrl);
        }
      }
    });
    await Promise.all(uploadPromises);
    return document2.body.innerHTML;
  }
  return content;
}
async function uploadCover(serverUrl, headers, cover, relativePath) {
  if (cover && needUpload(cover)) {
    const newCoverUrl = await uploadLocalImage(cover, serverUrl, headers, relativePath);
    if (newCoverUrl) {
      return newCoverUrl;
    }
  }
  return cover;
}
const LONG_IMAGE_RATIO_THRESHOLD = 2.2;
const LONG_IMAGE_MAX_HEIGHT_VH = 72;
async function applyAdaptiveImageInteractions(root, relativePath, options = {}) {
  const mode = resolveLongImageMode(options.mode);
  const ratioThreshold = resolveLongImageRatioThreshold(options.ratioThreshold);
  const maxHeightVh = resolveLongImageMaxHeightVh(options.maxHeightVh);
  const images = Array.from(root.querySelectorAll("img"));
  for (const image of images) {
    image.classList.add("wy-img");
    const dimension = await resolveImageDimension(image, relativePath);
    if (!dimension) {
      image.classList.add("wy-img-normal");
      applyNormalImageStyle(image);
      if (mode === "always") {
        image.classList.remove("wy-img-normal");
        image.classList.add("wy-img-long");
        applyLongImageInteraction(image, maxHeightVh);
      }
      continue;
    }
    const ratio = dimension.height / dimension.width;
    image.setAttribute("data-wy-width", String(dimension.width));
    image.setAttribute("data-wy-height", String(dimension.height));
    image.setAttribute("data-wy-ratio", ratio.toFixed(4));
    if (mode === "off") {
      image.classList.add("wy-img-normal");
      applyNormalImageStyle(image);
      continue;
    }
    if (mode === "always" || ratio >= ratioThreshold) {
      image.classList.add("wy-img-long");
      applyLongImageInteraction(image, maxHeightVh);
    } else {
      image.classList.add("wy-img-normal");
      applyNormalImageStyle(image);
    }
  }
}
function resolveLongImageMode(mode) {
  if (mode === "always" || mode === "off") {
    return mode;
  }
  return "auto";
}
function resolveLongImageRatioThreshold(value) {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return LONG_IMAGE_RATIO_THRESHOLD;
  }
  return value;
}
function resolveLongImageMaxHeightVh(value) {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return LONG_IMAGE_MAX_HEIGHT_VH;
  }
  return value;
}
async function resolveImageDimension(image, relativePath) {
  const fromAttributes = getDimensionFromAttributes(image);
  if (fromAttributes) {
    return fromAttributes;
  }
  const src = image.getAttribute("src") || "";
  if (!src || isNonLocalSource(src)) {
    return null;
  }
  try {
    const resolvedPath = RuntimeEnv.resolveLocalPath(src, relativePath);
    const data = await fs.readFile(resolvedPath);
    return parseImageDimensionFromBuffer(data);
  } catch {
    return null;
  }
}
function getDimensionFromAttributes(image) {
  const widthAttr = parseNumber(image.getAttribute("width"));
  const heightAttr = parseNumber(image.getAttribute("height"));
  if (widthAttr && heightAttr) {
    return { width: widthAttr, height: heightAttr };
  }
  const styleText = image.getAttribute("style") || "";
  const widthFromStyle = parsePixelValue(styleText, "width");
  const heightFromStyle = parsePixelValue(styleText, "height");
  if (widthFromStyle && heightFromStyle) {
    return { width: widthFromStyle, height: heightFromStyle };
  }
  return null;
}
function isNonLocalSource(src) {
  return /^(https?:\/\/|data:|asset:\/\/)/i.test(src);
}
function parseNumber(value) {
  if (!value) {
    return null;
  }
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}
function parsePixelValue(styleText, property) {
  const regex = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`, "i");
  const match = styleText.match(regex);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}
function applyNormalImageStyle(image) {
  image.style.setProperty("max-width", "100%");
  image.style.setProperty("width", "auto");
  image.style.setProperty("height", "auto");
  image.style.setProperty("display", "block");
  image.style.setProperty("margin", "0 auto");
}
function applyLongImageInteraction(image, maxHeightVh) {
  let wrapper = image.parentElement;
  if (!wrapper || !wrapper.classList.contains("wy-img-long-scroll")) {
    const wrapperTag = image.parentElement?.tagName === "P" ? "span" : "div";
    wrapper = image.ownerDocument.createElement(wrapperTag);
    wrapper.className = "wy-img-long-scroll";
    image.parentElement?.insertBefore(wrapper, image);
    wrapper.appendChild(image);
  }
  wrapper.style.setProperty("display", "block");
  wrapper.style.setProperty("margin", "0 auto");
  wrapper.style.setProperty("max-height", `${maxHeightVh}vh`);
  wrapper.style.setProperty("overflow-y", "auto");
  wrapper.style.setProperty("overflow-x", "hidden");
  wrapper.style.setProperty("-webkit-overflow-scrolling", "touch");
  image.style.setProperty("max-width", "100%");
  image.style.setProperty("width", "100%");
  image.style.setProperty("height", "auto");
  image.style.setProperty("display", "block");
  image.style.setProperty("margin", "0 auto");
}
function parseImageDimensionFromBuffer(buffer) {
  return parsePngDimension(buffer) || parseJpegDimension(buffer) || parseGifDimension(buffer) || parseWebpDimension(buffer);
}
function parsePngDimension(buffer) {
  if (buffer.length < 24) {
    return null;
  }
  const pngSignature = [137, 80, 78, 71];
  for (let i2 = 0; i2 < pngSignature.length; i2++) {
    if (buffer[i2] !== pngSignature[i2]) {
      return null;
    }
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!width || !height) {
    return null;
  }
  return { width, height };
}
function parseGifDimension(buffer) {
  if (buffer.length < 10) {
    return null;
  }
  const header = buffer.subarray(0, 6).toString("ascii");
  if (header !== "GIF87a" && header !== "GIF89a") {
    return null;
  }
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  if (!width || !height) {
    return null;
  }
  return { width, height };
}
function parseJpegDimension(buffer) {
  if (buffer.length < 4 || buffer[0] !== 255 || buffer[1] !== 216) {
    return null;
  }
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 255) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 218 || marker === 217) {
      break;
    }
    const size = buffer.readUInt16BE(offset + 2);
    if (size < 2 || offset + 2 + size > buffer.length) {
      break;
    }
    if (isSofMarker(marker)) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      if (width && height) {
        return { width, height };
      }
      return null;
    }
    offset += 2 + size;
  }
  return null;
}
function isSofMarker(marker) {
  return [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker);
}
function parseWebpDimension(buffer) {
  if (buffer.length < 30) {
    return null;
  }
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF") {
    return null;
  }
  if (buffer.subarray(8, 12).toString("ascii") !== "WEBP") {
    return null;
  }
  const chunkType = buffer.subarray(12, 16).toString("ascii");
  if (chunkType === "VP8X") {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height };
  }
  if (chunkType === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    const width = (bits & 16383) + 1;
    const height = (bits >> 14 & 16383) + 1;
    return { width, height };
  }
  return null;
}
const DEFAULT_MERMAID_PPI = 76;
const MIN_MERMAID_PPI = 38;
const MAX_MERMAID_PPI = 76;
const DEFAULT_MERMAID_RENDER_SCALE = 2;
const MIN_MERMAID_RENDER_SCALE = 1;
const MAX_MERMAID_RENDER_SCALE = 3;
const CSS_BASELINE_PPI = 96;
const DEFAULT_BASE_CSS_WIDTH = 768;
function resolveMermaidPpi(mermaidPpi) {
  if (!Number.isFinite(mermaidPpi) || !mermaidPpi || mermaidPpi <= 0) {
    return DEFAULT_MERMAID_PPI;
  }
  return clamp(Math.round(mermaidPpi), MIN_MERMAID_PPI, MAX_MERMAID_PPI);
}
function resolveMermaidRenderScale(mermaidRenderScale) {
  if (!Number.isFinite(mermaidRenderScale) || !mermaidRenderScale || mermaidRenderScale <= 0) {
    return DEFAULT_MERMAID_RENDER_SCALE;
  }
  return clamp(Math.round(mermaidRenderScale), MIN_MERMAID_RENDER_SCALE, MAX_MERMAID_RENDER_SCALE);
}
function computeMermaidTargetWidth(baseCssWidth, mermaidPpi) {
  const width = Math.max(1, Math.round(baseCssWidth * (mermaidPpi / CSS_BASELINE_PPI)));
  return width;
}
async function replaceMermaidCodeBlocksWithImages(root, options = {}) {
  if (options.mermaid === false) {
    return;
  }
  const blocks = Array.from(root.querySelectorAll("pre > code.language-mermaid"));
  if (blocks.length === 0) {
    return;
  }
  const mermaidPpi = resolveMermaidPpi(options.mermaidPpi);
  const mermaidRenderScale = resolveMermaidRenderScale(options.mermaidRenderScale);
  const renderer = options.renderer ?? renderMermaidByPuppeteer;
  const writeTempFile = options.writeTempFile ?? writeMermaidTempFile;
  for (const codeElement of blocks) {
    const preElement = codeElement.parentElement;
    if (!preElement || preElement.tagName !== "PRE") {
      continue;
    }
    const code = codeElement.textContent?.trim() || "";
    if (!code) {
      continue;
    }
    try {
      const targetCssWidth = computeMermaidTargetWidth(DEFAULT_BASE_CSS_WIDTH, mermaidPpi);
      const rendered = await renderer({
        code,
        ppi: mermaidPpi,
        renderScale: mermaidRenderScale,
        targetCssWidth
      });
      const imagePath = await writeTempFile({
        buffer: rendered.buffer,
        code,
        ppi: mermaidPpi,
        renderScale: mermaidRenderScale
      });
      const imgElement = root.ownerDocument.createElement("img");
      imgElement.setAttribute("src", imagePath);
      imgElement.setAttribute("alt", "mermaid diagram");
      imgElement.setAttribute("width", String(Math.max(1, Math.round(rendered.width))));
      imgElement.setAttribute("height", String(Math.max(1, Math.round(rendered.height))));
      preElement.replaceWith(imgElement);
    } catch (error) {
      console.warn("[mermaidScreenshot] failed to render Mermaid block, fallback to code block:", error);
    }
  }
}
async function writeMermaidTempFile(input) {
  const hash = createHash("sha1").update(input.code).update(`:${input.ppi}`).update(`:${input.renderScale}`).digest("hex").slice(0, 16);
  const tempDir = path.join(os.tmpdir(), "wenyan-mermaid");
  await fs.mkdir(tempDir, { recursive: true });
  const filePath = path.join(tempDir, `mermaid_${hash}.png`);
  await fs.writeFile(filePath, input.buffer);
  return filePath;
}
async function renderMermaidByPuppeteer(input) {
  let launch;
  try {
    const mod = await import("puppeteer");
    launch = (mod.default?.launch ?? mod.launch).bind(mod.default ?? mod);
  } catch (importErr) {
    throw new Error(`puppeteer import failed: ${importErr.message || String(importErr)}`);
  }
  const require2 = createRequire(import.meta.url);
  const mermaidBundleEntry = require2.resolve("mermaid/dist/mermaid.min.js");
  const mermaidEntry = require2.resolve("mermaid/dist/mermaid.esm.mjs");
  const mermaidModuleUrl = pathToFileURL(mermaidEntry).href;
  let browser;
  try {
    browser = await launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    });
    const page = await browser.newPage();
    try {
      await page.setViewport({
        width: Math.max(640, input.targetCssWidth + 64),
        height: 1024,
        deviceScaleFactor: input.renderScale
      });
      await page.setContent(
        `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="stage"></div></body></html>`,
        { waitUntil: "domcontentloaded" }
      );
      await page.addScriptTag({ path: mermaidBundleEntry });
      const renderMeta = await page.evaluate(
        async ({ code, moduleUrl, targetCssWidth }) => {
          const stage = document.getElementById("stage");
          if (!stage) {
            return { ok: false, error: "stage missing", width: 0, height: 0 };
          }
          stage.setAttribute(
            "style",
            `width:${targetCssWidth}px;display:block;margin:0;padding:0;background:#ffffff;`
          );
          try {
            const mermaidGlobal = globalThis.mermaid;
            let mermaid = mermaidGlobal;
            if (!mermaid) {
              const dynamicImport = new Function("u", "return import(u)");
              const mermaidModule = await dynamicImport(moduleUrl);
              mermaid = mermaidModule.default;
            }
            if (!mermaid) {
              return { ok: false, error: "mermaid runtime unavailable", width: 0, height: 0 };
            }
            mermaid.initialize({ startOnLoad: false, securityLevel: "loose" });
            const renderId = `wenyan-mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const output = await mermaid.render(renderId, code);
            stage.innerHTML = output.svg;
            const svgElement = stage.querySelector("svg");
            if (!svgElement) {
              return { ok: false, error: "svg not generated", width: 0, height: 0 };
            }
            const box = svgElement.getBoundingClientRect();
            return {
              ok: true,
              width: Math.max(1, Math.ceil(box.width)),
              height: Math.max(1, Math.ceil(box.height))
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { ok: false, error: message, width: 0, height: 0 };
          }
        },
        {
          code: input.code,
          moduleUrl: mermaidModuleUrl,
          targetCssWidth: input.targetCssWidth
        }
      );
      if (!renderMeta.ok) {
        throw new Error(renderMeta.error || "mermaid render failed");
      }
      const stageHandle = await page.$("#stage");
      if (!stageHandle) {
        throw new Error("stage not found for screenshot");
      }
      const screenshot = await stageHandle.screenshot({ type: "png" });
      const buffer = Buffer.from(screenshot);
      return {
        buffer,
        width: renderMeta.width,
        height: renderMeta.height
      };
    } finally {
      await page.close();
    }
  } finally {
    await browser?.close();
  }
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
const wenyanCoreInstance = await createWenyanCore();
const ENV_DEFAULT_AUTHOR = "WECHAT_DEFAULT_AUTHOR";
const ENV_CTA_PRE_HEAD = "WECHAT_CTA_PRE_HEAD";
const ENV_CTA_POST_FOOTNOTE = "WECHAT_CTA_POST_FOOTNOTE";
async function renderWithTheme(markdownContent, options, assetBaseDir) {
  if (!markdownContent) {
    throw new Error("No content provided for rendering.");
  }
  const {
    theme,
    customTheme,
    highlight,
    macStyle,
    footnote,
    mermaid,
    mermaidPpi,
    mermaidRenderScale,
    longImageMode,
    longImageRatioThreshold,
    longImageMaxHeightVh
  } = options;
  let handledCustomTheme = customTheme;
  if (customTheme) {
    const normalizePath = getNormalizeFilePath(customTheme);
    handledCustomTheme = await readFileContent(normalizePath);
  } else if (theme) {
    handledCustomTheme = await configStore.getThemeById(theme);
  }
  if (!handledCustomTheme && !theme) {
    throw new Error(`theme "${theme}" not found.`);
  }
  const gzhContent = await renderStyledContent(markdownContent, {
    themeId: theme,
    hlThemeId: highlight,
    isMacStyle: macStyle,
    isAddFootnote: footnote,
    themeCss: handledCustomTheme,
    assetBaseDir,
    mermaid,
    mermaidPpi,
    mermaidRenderScale,
    longImageMode,
    longImageRatioThreshold,
    longImageMaxHeightVh
  });
  return gzhContent;
}
async function renderStyledContent(content, options = {}) {
  const {
    assetBaseDir,
    mermaid,
    mermaidPpi,
    mermaidRenderScale,
    longImageMode,
    longImageRatioThreshold,
    longImageMaxHeightVh,
    mermaidRenderer,
    mermaidTempFileWriter,
    ...styleOptions
  } = options;
  const preHandlerContent = await wenyanCoreInstance.handleFrontMatter(content);
  const fallbackAuthor = getEnvSnippet(ENV_DEFAULT_AUTHOR);
  if (!preHandlerContent.author && fallbackAuthor) {
    preHandlerContent.author = fallbackAuthor;
  }
  const preHeadCtaHtml = await resolveSnippetToHtml(getEnvSnippet(ENV_CTA_PRE_HEAD));
  const postFootnoteCtaHtml = await resolveSnippetToHtml(getEnvSnippet(ENV_CTA_POST_FOOTNOTE));
  const html = await wenyanCoreInstance.renderMarkdown(preHandlerContent.body);
  const dom = new JSDOM(`<body><section id="wenyan">${html}</section></body>`);
  const document2 = dom.window.document;
  const wenyan = document2.getElementById("wenyan");
  await replaceMermaidCodeBlocksWithImages(wenyan, {
    mermaid,
    mermaidPpi,
    mermaidRenderScale,
    renderer: mermaidRenderer,
    writeTempFile: mermaidTempFileWriter
  });
  await applyAdaptiveImageInteractions(wenyan, assetBaseDir, {
    mode: longImageMode,
    ratioThreshold: longImageRatioThreshold,
    maxHeightVh: longImageMaxHeightVh
  });
  const result = await wenyanCoreInstance.applyStylesWithTheme(wenyan, {
    ...styleOptions,
    preHeadCtaHtml,
    postFootnoteCtaHtml
  });
  return {
    content: result,
    title: preHandlerContent.title,
    cover: preHandlerContent.cover,
    description: preHandlerContent.description,
    author: preHandlerContent.author,
    source_url: preHandlerContent.source_url
  };
}
function getEnvSnippet(name) {
  const value = process.env[name] || "";
  return value.trim().replace(/\\n/g, "\n");
}
function looksLikeHtmlSnippet(snippet) {
  return /<\/?[a-z][\w-]*(\s[^>]*)?>/i.test(snippet);
}
async function resolveSnippetToHtml(snippet) {
  if (!snippet) {
    return "";
  }
  if (looksLikeHtmlSnippet(snippet)) {
    return snippet;
  }
  return await wenyanCoreInstance.renderMarkdown(snippet);
}
async function prepareRenderContext(inputContent, options, getInputContent) {
  const { content, absoluteDirPath } = await getInputContent(inputContent, options.file);
  const gzhContent = await renderWithTheme(content, options, absoluteDirPath);
  return { gzhContent, absoluteDirPath };
}
async function listThemes() {
  const themes = getAllGzhThemes();
  const themeList = themes.map((theme) => {
    return {
      id: theme.meta.id,
      name: theme.meta.name,
      description: theme.meta.description,
      isBuiltin: true
    };
  });
  const customThemes = await configStore.getThemes();
  if (customThemes.length > 0) {
    customThemes.forEach((theme) => {
      themeList.push({
        id: theme.id,
        name: theme.id,
        description: theme.description,
        isBuiltin: false
      });
    });
  }
  return themeList;
}
async function addTheme(name, path2) {
  if (!name || !path2) {
    throw new Error("添加主题时必须提供名称(name)和路径(path)");
  }
  if (checkThemeExists(name) || await checkCustomThemeExists(name)) {
    throw new Error(`主题 "${name}" 已存在`);
  }
  if (path2.startsWith("http")) {
    const response = await fetch(path2);
    if (!response.ok) {
      throw new Error(`无法从远程获取主题: ${response.statusText}`);
    }
    const content = await response.text();
    await configStore.addThemeToConfig(name, content);
  } else {
    const normalizePath = getNormalizeFilePath(path2);
    const content = await readFileContent(normalizePath);
    await configStore.addThemeToConfig(name, content);
  }
}
async function removeTheme(name) {
  if (checkThemeExists(name)) {
    throw new Error(`默认主题 "${name}" 不能删除`);
  }
  if (!await checkCustomThemeExists(name)) {
    throw new Error(`自定义主题 "${name}" 不存在`);
  }
  await configStore.deleteThemeFromConfig(name);
}
function checkThemeExists(themeId) {
  const themes = getAllGzhThemes();
  return themes.some((theme) => theme.meta.id === themeId);
}
async function checkCustomThemeExists(themeId) {
  const customThemes = await configStore.getThemes();
  return customThemes.some((theme) => theme.id === themeId);
}
async function getGzhContent(content, themeId, hlThemeId, isMacStyle = true, isAddFootnote = true) {
  return await renderStyledContent(content, {
    themeId,
    hlThemeId,
    isMacStyle,
    isAddFootnote
  });
}
async function renderAndPublish(inputContent, options, getInputContent) {
  const { gzhContent, absoluteDirPath } = await prepareRenderContext(inputContent, options, getInputContent);
  if (!gzhContent.title) throw new Error("未能找到文章标题");
  const data = await publishToWechatDraft(
    {
      title: gzhContent.title,
      content: gzhContent.content,
      cover: gzhContent.cover,
      author: gzhContent.author,
      source_url: gzhContent.source_url
    },
    {
      relativePath: absoluteDirPath
    }
  );
  if (data.media_id) {
    return data.media_id;
  } else {
    throw new Error(`发布到微信公众号失败，
${data}`);
  }
}
async function renderAndPublishToServer(inputContent, options, getInputContent) {
  const serverUrl = getServerUrl(options);
  const headers = getHeaders(options);
  await healthCheck(serverUrl);
  await verifyAuth(serverUrl, headers);
  const { gzhContent, absoluteDirPath } = await prepareRenderContext(inputContent, options, getInputContent);
  if (!gzhContent.title) throw new Error("未能找到文章标题");
  gzhContent.content = await uploadLocalImages(gzhContent.content, serverUrl, headers, absoluteDirPath);
  gzhContent.cover = await uploadCover(serverUrl, headers, gzhContent.cover, absoluteDirPath);
  const mdFileId = await uploadStyledContent(gzhContent, serverUrl, headers);
  return await requestServerPublish(mdFileId, serverUrl, headers, options);
}
export {
  addTheme,
  b as configDir,
  d as configPath,
  configStore,
  e as ensureDir,
  getGzhContent,
  getNormalizeFilePath,
  i as isAbsolutePath,
  listThemes,
  m as md5FromBuffer,
  f as md5FromFile,
  n as normalizePath,
  prepareRenderContext,
  readBinaryFile,
  readFileContent,
  removeTheme,
  renderAndPublish,
  renderAndPublishToServer,
  renderStyledContent,
  renderWithTheme,
  s as safeReadJson,
  h as safeWriteJson,
  t as tokenPath,
  j as tokenStore,
  u as uploadCacheStore
};
