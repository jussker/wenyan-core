import { describe, it, expect } from "vitest";
import { renderStyledContent } from "../src/node/render.js";

describe("renderStyledContent image interaction", () => {
    it("should classify long and normal images in rendered html", async () => {
        const markdown = [
            "# 图片测试",
            "",
            "![long](demo-long.png){width=300 height=900}",
            "",
            "![normal](demo-normal.png){width=600 height=500}",
        ].join("\n");

        const result = await renderStyledContent(markdown, {
            themeCss: "#wenyan img { max-width: 100%; height: auto; }",
            hlThemeCss: "#wenyan pre code { color: #333; }",
            isMacStyle: false,
            isAddFootnote: false,
        });

        expect(result.content).toContain("wy-img-long-scroll");
        expect(result.content).toContain("class=\"wy-img wy-img-long\"");
        expect(result.content).toContain("data-wy-ratio=\"3.0000\"");
        expect(result.content).toContain("class=\"wy-img wy-img-normal\"");
    });

    it("should apply normal image class for wiki image syntax", async () => {
        const markdown = ["# Wiki 图片", "", "![[a/b.png|示例图]]"].join("\n");

        const result = await renderStyledContent(markdown, {
            themeCss: "#wenyan img { max-width: 100%; height: auto; }",
            hlThemeCss: "#wenyan pre code { color: #333; }",
            isMacStyle: false,
            isAddFootnote: false,
        });

        expect(result.content).toContain('src="a/b.png"');
        expect(result.content).toContain('alt="示例图"');
        expect(result.content).toContain('class="wy-img wy-img-normal"');
    });

    it("should convert mermaid block to image before wy-img classification", async () => {
        const markdown = [
            "# Mermaid 图片",
            "",
            "```mermaid",
            "graph TD",
            "A --> B",
            "```",
        ].join("\n");

        const result = await renderStyledContent(markdown, {
            themeCss: "#wenyan img { max-width: 100%; height: auto; }",
            hlThemeCss: "#wenyan pre code { color: #333; }",
            isMacStyle: false,
            isAddFootnote: false,
            mermaidRenderer: async () => {
                return {
                    buffer: Buffer.from("mock-mermaid"),
                    width: 300,
                    height: 900,
                };
            },
            mermaidTempFileWriter: async () => "/tmp/mock-mermaid.png",
        });

        expect(result.content).toContain('src="/tmp/mock-mermaid.png"');
        expect(result.content).toContain('alt="mermaid diagram"');
        expect(result.content).toContain('class="wy-img wy-img-long"');
        expect(result.content).toContain("wy-img-long-scroll");
        expect(result.content).not.toContain("language-mermaid");
    });
});
