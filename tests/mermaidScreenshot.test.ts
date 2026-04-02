import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { JSDOM } from "jsdom";
import {
    computeMermaidTargetWidth,
    replaceMermaidCodeBlocksWithImages,
    resolveMermaidPpi,
    resolveMermaidRenderScale,
} from "../src/node/mermaidScreenshot.js";

describe("mermaidScreenshot", () => {
    it("should replace mermaid fenced code block with image", async () => {
        const dom = new JSDOM("<section id=\"wenyan\"><pre><code class=\"language-mermaid\">graph TD\nA-->B</code></pre></section>");
        const root = dom.window.document.getElementById("wenyan") as HTMLElement;

        await replaceMermaidCodeBlocksWithImages(root, {
            renderer: async () => {
                return {
                    buffer: Buffer.from("mock"),
                    width: 500,
                    height: 240,
                };
            },
            writeTempFile: async () => "/tmp/mermaid-1.png",
        });

        const img = root.querySelector("img");
        expect(img).not.toBeNull();
        expect(img?.getAttribute("src")).toBe("/tmp/mermaid-1.png");
        expect(img?.getAttribute("alt")).toBe("mermaid diagram");
        expect(img?.getAttribute("width")).toBe("500");
        expect(img?.getAttribute("height")).toBe("240");
        expect(root.querySelector("pre > code.language-mermaid")).toBeNull();
    });

    it("should default to PPI 76 and renderScale 2", async () => {
        const dom = new JSDOM("<section id=\"wenyan\"><pre><code class=\"language-mermaid\">graph TD\nA-->B</code></pre></section>");
        const root = dom.window.document.getElementById("wenyan") as HTMLElement;

        let capturedInput: { ppi: number; renderScale: number; targetCssWidth: number } | undefined;
        const renderer = async (input: { ppi: number; renderScale: number; targetCssWidth: number }) => {
            capturedInput = input;
            return {
                buffer: Buffer.from("mock"),
                width: 608,
                height: 300,
            };
        };

        await replaceMermaidCodeBlocksWithImages(root, {
            renderer,
            writeTempFile: async () => "/tmp/mermaid-2.png",
        });

        expect(capturedInput).toBeDefined();
        expect(capturedInput?.ppi).toBe(76);
        expect(capturedInput?.renderScale).toBe(2);
        expect(capturedInput?.targetCssWidth).toBe(computeMermaidTargetWidth(768, 76));
        expect(capturedInput?.targetCssWidth).toBe(608);
    });

    it("should clamp mermaidPpi and mermaidRenderScale", async () => {
        expect(resolveMermaidPpi()).toBe(76);
        expect(resolveMermaidPpi(200)).toBe(76);
        expect(resolveMermaidPpi(12)).toBe(38);

        expect(resolveMermaidRenderScale()).toBe(2);
        expect(resolveMermaidRenderScale(10)).toBe(3);
        expect(resolveMermaidRenderScale(0.2)).toBe(1);
    });

    it("should pass clamped ppi and renderScale into renderer", async () => {
        const dom = new JSDOM("<section id=\"wenyan\"><pre><code class=\"language-mermaid\">graph TD\nA-->B</code></pre></section>");
        const root = dom.window.document.getElementById("wenyan") as HTMLElement;

        let capturedInput: { ppi: number; renderScale: number; targetCssWidth: number } | undefined;

        await replaceMermaidCodeBlocksWithImages(root, {
            mermaidPpi: 120,
            mermaidRenderScale: 8,
            renderer: async (input) => {
                capturedInput = input;
                return {
                    buffer: Buffer.from("mock"),
                    width: 608,
                    height: 300,
                };
            },
            writeTempFile: async () => "/tmp/mermaid-2b.png",
        });

        expect(capturedInput).toBeDefined();
        expect(capturedInput?.ppi).toBe(76);
        expect(capturedInput?.renderScale).toBe(3);
    });

    it("should fallback gracefully when rendering fails", async () => {
        const dom = new JSDOM("<section id=\"wenyan\"><pre><code class=\"language-mermaid\">graph TD\nA-->B</code></pre></section>");
        const root = dom.window.document.getElementById("wenyan") as HTMLElement;

        await replaceMermaidCodeBlocksWithImages(root, {
            renderer: async () => {
                throw new Error("render failed");
            },
            writeTempFile: async () => "/tmp/mermaid-3.png",
        });

        expect(root.querySelector("pre > code.language-mermaid")).not.toBeNull();
        expect(root.querySelector("img")).toBeNull();
    });

    it("should keep browser evaluate import path SSR-safe", async () => {
        const sourcePath = path.resolve("src/node/mermaidScreenshot.ts");
        const source = await readFile(sourcePath, "utf-8");

        expect(source).toContain('require.resolve("mermaid/dist/mermaid.min.js")');
        expect(source).toContain("await page.addScriptTag({ path: mermaidBundleEntry });");
        expect(source).toContain('new Function("u", "return import(u)")');
        expect(source).toContain("const mermaidGlobal = (globalThis as { mermaid?: unknown }).mermaid;");
        expect(source).toContain("const mermaidModule = await dynamicImport(moduleUrl);");
        expect(source).not.toContain("const mermaidModule = await import(moduleUrl);");
    });
});
