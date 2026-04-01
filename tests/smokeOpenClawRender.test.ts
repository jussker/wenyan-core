import { describe, expect, it } from "vitest";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { renderStyledContent } from "../src/node/render.js";

describe("OpenClaw article smoke render", () => {
  it("renders markdown end-to-end with mermaid/image pipeline", async () => {
    const articlePath = path.resolve(
      "../../tmp/OpenClaw 如何让龙虾员工相互交流/真正的龙虾员工, 会在工在群里主动讨论工作.md",
    );
    const articleDir = path.dirname(articlePath);
    const markdown = await readFile(articlePath, "utf-8");
    const themeCss = await readFile(path.resolve("src/assets/themes/default.css"), "utf-8");
    const hlThemeCss = await readFile(path.resolve("src/assets/highlight/styles/github.min.css"), "utf-8");

    const rendered = await renderStyledContent(
      markdown,
      {
        themeCss,
        hlThemeCss,
        isMacStyle: true,
        isAddFootnote: true,
        assetBaseDir: articleDir,
        mermaid: true,
        mermaidPpi: 76,
      },
    );

    expect(rendered.content).toContain('id="wenyan"');
    expect(rendered.content).not.toContain("__vite_ssr_dynamic_import__ is not defined");
    expect(rendered.content).not.toContain("Failed to fetch dynamically imported module");

    const dom = new JSDOM(`<body>${rendered.content}</body>`);
    const doc = dom.window.document;

    const images = doc.querySelectorAll("img");
    const wyImages = doc.querySelectorAll("img.wy-img");
    const mermaidCodeBlocks = doc.querySelectorAll("pre > code.language-mermaid");
    const mermaidImages = Array.from(images).filter((img) => img.getAttribute("alt") === "mermaid diagram");

    expect(images.length).toBeGreaterThan(0);
    expect(wyImages.length).toBeGreaterThan(0);
    if (mermaidCodeBlocks.length === 0) {
      expect(mermaidImages.length).toBeGreaterThan(0);
    }
  });
});
