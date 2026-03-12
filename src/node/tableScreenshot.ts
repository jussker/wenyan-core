/**
 * tableScreenshot.ts
 *
 * 使用 Puppeteer 在 PC 宽度（800px）下渲染文章 HTML，
 * 对每个 <table> 截图并通过回调上传，最终将 <table> 元素替换为 <img>。
 *
 * 设计原则：
 * - 单一职责：只负责 Puppeteer + DOM 操作，不知道 WeChat / uploadImage
 * - 依赖倒置：通过 TableUploadCallback 注入上传行为
 * - 错误降级：Puppeteer 失败时返回原始 HTML，不阻断发布流程
 */
import { JSDOM } from "jsdom";

/** 上传回调类型：接收 PNG Buffer 和文件名，返回可访问的图片 URL */
export type TableUploadCallback = (buffer: Buffer, filename: string) => Promise<string>;

/**
 * 将文章 HTML 中所有 <table> 元素截图并替换为 <img>。
 *
 * @param articleSectionHtml - 完整的 #wenyan section 的 outerHTML（含 inline styles）
 * @param upload - 上传回调，返回微信 CDN URL
 * @returns 修改后的 HTML（table 已替换为 img），或 Puppeteer 失败时返回原始 HTML
 */
export async function replaceTablesWithScreenshots(
  articleSectionHtml: string,
  upload: TableUploadCallback,
): Promise<string> {
  const dom = new JSDOM(articleSectionHtml);
  const document = dom.window.document;
  const tables = Array.from(document.querySelectorAll<HTMLElement>("table"));

  if (tables.length === 0) {
    return articleSectionHtml;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let launch: (opts: any) => Promise<any>;
  try {
    const mod = await import("puppeteer");
    launch = (mod.default?.launch ?? mod.launch).bind(mod.default ?? mod);
  } catch (importErr) {
    console.warn("[tableScreenshot] puppeteer not installed, skipping table screenshot:", importErr);
    return articleSectionHtml;
  }

  const pcPageHtml = buildPcPageHtml(articleSectionHtml);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any;
  try {
    browser = await launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    for (let i = 0; i < tables.length; i++) {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });
        await page.setContent(pcPageHtml, { waitUntil: "networkidle0" });

        // nth-of-type 是 CSS 选择器，1-based
        const tableEl = await page.$(`table:nth-of-type(${i + 1})`);
        if (!tableEl) {
          console.warn(`[tableScreenshot] table[${i}] not found in Puppeteer page, skipping.`);
          continue;
        }

        const screenshotBuffer = await tableEl.screenshot({ type: "png" }) as unknown as Buffer;
        const filename = `wenyan_table_${Date.now()}_${i}.png`;
        const url = await upload(screenshotBuffer, filename);

        // 替换 JSDOM 中对应的 table 元素
        const imgEl = document.createElement("img");
        imgEl.setAttribute("src", url);
        imgEl.setAttribute(
          "style",
          "max-width:100%;display:block;margin:1em auto;border-radius:8px;",
        );
        tables[i].parentNode?.replaceChild(imgEl, tables[i]);
      } finally {
        await page.close();
      }
    }
  } catch (err) {
    console.warn("[tableScreenshot] Puppeteer failed, tables will render as HTML:", (err as Error).message ?? err);
    return articleSectionHtml;
  } finally {
    await browser?.close();
  }

  // 返回修改后的 section HTML
  const wenyanEl = document.getElementById("wenyan");
  return wenyanEl ? wenyanEl.outerHTML : dom.serialize();
}

/** 构建用于 Puppeteer 渲染的完整 PC HTML 页面 */
function buildPcPageHtml(articleSectionHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { background: #ffffff; padding: 24px; }
    #wenyan { max-width: 752px; }
  </style>
</head>
<body>${articleSectionHtml}</body>
</html>`;
}
