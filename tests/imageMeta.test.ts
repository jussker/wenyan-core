import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { applyAdaptiveImageInteractions } from "../src/node/imageMeta.js";

describe("applyAdaptiveImageInteractions", () => {
    it("should mark long images and wrap them into vertical scroll container", async () => {
        const dom = new JSDOM(`<body><section id="wenyan"><img src="demo.png" width="300" height="900"></section></body>`);
        const wenyan = dom.window.document.getElementById("wenyan") as HTMLElement;

        await applyAdaptiveImageInteractions(wenyan);

        const image = wenyan.querySelector("img") as HTMLImageElement;
        const wrapper = image.parentElement as HTMLElement;

        expect(image.classList.contains("wy-img")).toBe(true);
        expect(image.classList.contains("wy-img-long")).toBe(true);
        expect(image.getAttribute("data-wy-ratio")).toBe("3.0000");
        expect(wrapper.classList.contains("wy-img-long-scroll")).toBe(true);
        expect(wrapper.style.overflowY).toBe("auto");
    });

    it("should mark normal images and keep max-width adaptive style", async () => {
        const dom = new JSDOM(
            `<body><section id="wenyan"><img src="demo.png" style="width:600px; height:500px"></section></body>`,
        );
        const wenyan = dom.window.document.getElementById("wenyan") as HTMLElement;

        await applyAdaptiveImageInteractions(wenyan);

        const image = wenyan.querySelector("img") as HTMLImageElement;

        expect(image.classList.contains("wy-img")).toBe(true);
        expect(image.classList.contains("wy-img-normal")).toBe(true);
        expect(image.classList.contains("wy-img-long")).toBe(false);
        expect(image.style.maxWidth).toBe("100%");
        expect(image.style.width).toBe("auto");
        expect(image.parentElement?.classList.contains("wy-img-long-scroll")).toBe(false);
    });

    it("should fallback to normal image when dimensions are unavailable", async () => {
        const dom = new JSDOM(`<body><section id="wenyan"><img src="https://example.com/demo.png"></section></body>`);
        const wenyan = dom.window.document.getElementById("wenyan") as HTMLElement;

        await applyAdaptiveImageInteractions(wenyan);

        const image = wenyan.querySelector("img") as HTMLImageElement;

        expect(image.classList.contains("wy-img-normal")).toBe(true);
        expect(image.hasAttribute("data-wy-width")).toBe(false);
        expect(image.hasAttribute("data-wy-height")).toBe(false);
        expect(image.hasAttribute("data-wy-ratio")).toBe(false);
    });

    it("should force all images into long-scroll mode when mode is always", async () => {
        const dom = new JSDOM(`<body><section id="wenyan"><img src="demo.png" width="600" height="500"></section></body>`);
        const wenyan = dom.window.document.getElementById("wenyan") as HTMLElement;

        await applyAdaptiveImageInteractions(wenyan, undefined, {
            mode: "always",
            maxHeightVh: 64,
        });

        const image = wenyan.querySelector("img") as HTMLImageElement;
        const wrapper = image.parentElement as HTMLElement;
        expect(image.classList.contains("wy-img-long")).toBe(true);
        expect(wrapper.classList.contains("wy-img-long-scroll")).toBe(true);
        expect(wrapper.style.maxHeight).toBe("64vh");
    });

    it("should disable long-scroll interaction when mode is off", async () => {
        const dom = new JSDOM(`<body><section id="wenyan"><img src="demo.png" width="300" height="900"></section></body>`);
        const wenyan = dom.window.document.getElementById("wenyan") as HTMLElement;

        await applyAdaptiveImageInteractions(wenyan, undefined, {
            mode: "off",
        });

        const image = wenyan.querySelector("img") as HTMLImageElement;
        expect(image.classList.contains("wy-img-normal")).toBe(true);
        expect(image.classList.contains("wy-img-long")).toBe(false);
        expect(image.parentElement?.classList.contains("wy-img-long-scroll")).toBe(false);
    });

    it("should respect custom ratio threshold in auto mode", async () => {
        const dom = new JSDOM(`<body><section id="wenyan"><img src="demo.png" width="500" height="1000"></section></body>`);
        const wenyan = dom.window.document.getElementById("wenyan") as HTMLElement;

        await applyAdaptiveImageInteractions(wenyan, undefined, {
            mode: "auto",
            ratioThreshold: 1.9,
        });

        const image = wenyan.querySelector("img") as HTMLImageElement;
        expect(image.classList.contains("wy-img-long")).toBe(true);
        expect(image.parentElement?.classList.contains("wy-img-long-scroll")).toBe(true);
    });
});
