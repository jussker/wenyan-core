import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const DEFAULT_MERMAID_PPI = 76;
const MIN_MERMAID_PPI = 38;
const MAX_MERMAID_PPI = 76;
const DEFAULT_MERMAID_RENDER_SCALE = 2;
const MIN_MERMAID_RENDER_SCALE = 1;
const MAX_MERMAID_RENDER_SCALE = 3;
const CSS_BASELINE_PPI = 96;
const DEFAULT_BASE_CSS_WIDTH = 768;

type MermaidRenderInput = {
    code: string;
    ppi: number;
    renderScale: number;
    targetCssWidth: number;
};

type MermaidRenderOutput = {
    buffer: Buffer;
    width: number;
    height: number;
};

export type MermaidDiagramRenderer = (input: MermaidRenderInput) => Promise<MermaidRenderOutput>;

type MermaidTempFileWriteInput = {
    buffer: Buffer;
    code: string;
    ppi: number;
    renderScale: number;
};

export type MermaidTempFileWriter = (input: MermaidTempFileWriteInput) => Promise<string>;

export type MermaidScreenshotOptions = {
    mermaid?: boolean;
    mermaidPpi?: number;
    mermaidRenderScale?: number;
    renderer?: MermaidDiagramRenderer;
    writeTempFile?: MermaidTempFileWriter;
};

export function resolveMermaidPpi(mermaidPpi?: number): number {
    if (!Number.isFinite(mermaidPpi) || !mermaidPpi || mermaidPpi <= 0) {
        return DEFAULT_MERMAID_PPI;
    }
    return clamp(Math.round(mermaidPpi), MIN_MERMAID_PPI, MAX_MERMAID_PPI);
}

export function resolveMermaidRenderScale(mermaidRenderScale?: number): number {
    if (!Number.isFinite(mermaidRenderScale) || !mermaidRenderScale || mermaidRenderScale <= 0) {
        return DEFAULT_MERMAID_RENDER_SCALE;
    }
    return clamp(Math.round(mermaidRenderScale), MIN_MERMAID_RENDER_SCALE, MAX_MERMAID_RENDER_SCALE);
}

export function computeMermaidTargetWidth(baseCssWidth: number, mermaidPpi: number): number {
    const width = Math.max(1, Math.round(baseCssWidth * (mermaidPpi / CSS_BASELINE_PPI)));
    return width;
}

export async function replaceMermaidCodeBlocksWithImages(
    root: HTMLElement,
    options: MermaidScreenshotOptions = {},
): Promise<void> {
    if (options.mermaid === false) {
        return;
    }

    const blocks = Array.from(root.querySelectorAll<HTMLElement>("pre > code.language-mermaid"));
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
                targetCssWidth,
            });

            const imagePath = await writeTempFile({
                buffer: rendered.buffer,
                code,
                ppi: mermaidPpi,
                renderScale: mermaidRenderScale,
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

async function writeMermaidTempFile(input: MermaidTempFileWriteInput): Promise<string> {
    const hash = createHash("sha1")
        .update(input.code)
        .update(`:${input.ppi}`)
        .update(`:${input.renderScale}`)
        .digest("hex")
        .slice(0, 16);

    const tempDir = path.join(os.tmpdir(), "wenyan-mermaid");
    await fs.mkdir(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `mermaid_${hash}.png`);
    await fs.writeFile(filePath, input.buffer);
    return filePath;
}

async function renderMermaidByPuppeteer(input: MermaidRenderInput): Promise<MermaidRenderOutput> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let launch: (opts: any) => Promise<any>;
    try {
        const mod = await import("puppeteer");
        launch = (mod.default?.launch ?? mod.launch).bind(mod.default ?? mod);
    } catch (importErr) {
        throw new Error(`puppeteer import failed: ${(importErr as Error).message || String(importErr)}`);
    }

    const require = createRequire(import.meta.url);
    const mermaidBundleEntry = require.resolve("mermaid/dist/mermaid.min.js");
    const mermaidEntry = require.resolve("mermaid/dist/mermaid.esm.mjs");
    const mermaidModuleUrl = pathToFileURL(mermaidEntry).href;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let browser: any;
    try {
        browser = await launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });

        const page = await browser.newPage();
        try {
            await page.setViewport({
                width: Math.max(640, input.targetCssWidth + 64),
                height: 1024,
                deviceScaleFactor: input.renderScale,
            });

            await page.setContent(
                `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><div id="stage"></div></body></html>`,
                { waitUntil: "domcontentloaded" },
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
                        `width:${targetCssWidth}px;display:block;margin:0;padding:0;background:#ffffff;`,
                    );

                    try {
                        const mermaidGlobal = (globalThis as { mermaid?: unknown }).mermaid;
                        let mermaid = mermaidGlobal as {
                            initialize: (config: { startOnLoad: boolean; securityLevel: string }) => void;
                            render: (id: string, content: string) => Promise<{ svg: string }>;
                        } | undefined;

                        if (!mermaid) {
                            const dynamicImport = new Function("u", "return import(u)") as (u: string) => Promise<{
                                default: {
                                    initialize: (config: { startOnLoad: boolean; securityLevel: string }) => void;
                                    render: (id: string, content: string) => Promise<{ svg: string }>;
                                };
                            }>;
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
                            height: Math.max(1, Math.ceil(box.height)),
                        };
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        return { ok: false, error: message, width: 0, height: 0 };
                    }
                },
                {
                    code: input.code,
                    moduleUrl: mermaidModuleUrl,
                    targetCssWidth: input.targetCssWidth,
                },
            );

            if (!renderMeta.ok) {
                throw new Error(renderMeta.error || "mermaid render failed");
            }

            const stageHandle = await page.$("#stage");
            if (!stageHandle) {
                throw new Error("stage not found for screenshot");
            }

            const screenshot = await stageHandle.screenshot({ type: "png" });
            const buffer = Buffer.from(screenshot as Uint8Array);
            return {
                buffer,
                width: renderMeta.width,
                height: renderMeta.height,
            };
        } finally {
            await page.close();
        }
    } finally {
        await browser?.close();
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
