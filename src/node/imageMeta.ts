import fs from "node:fs/promises";
import { RuntimeEnv } from "./runtimeEnv.js";

const LONG_IMAGE_RATIO_THRESHOLD = 2.2;
const LONG_IMAGE_MAX_HEIGHT_VH = 72;

type ImageDimension = {
    width: number;
    height: number;
};

export async function applyAdaptiveImageInteractions(
    root: HTMLElement,
    relativePath?: string,
): Promise<void> {
    const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));

    for (const image of images) {
        image.classList.add("wy-img");
        const dimension = await resolveImageDimension(image, relativePath);
        if (!dimension) {
            image.classList.add("wy-img-normal");
            applyNormalImageStyle(image);
            continue;
        }

        const ratio = dimension.height / dimension.width;
        image.setAttribute("data-wy-width", String(dimension.width));
        image.setAttribute("data-wy-height", String(dimension.height));
        image.setAttribute("data-wy-ratio", ratio.toFixed(4));

        if (ratio >= LONG_IMAGE_RATIO_THRESHOLD) {
            image.classList.add("wy-img-long");
            applyLongImageInteraction(image);
        } else {
            image.classList.add("wy-img-normal");
            applyNormalImageStyle(image);
        }
    }
}

async function resolveImageDimension(
    image: HTMLImageElement,
    relativePath?: string,
): Promise<ImageDimension | null> {
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

function getDimensionFromAttributes(image: HTMLImageElement): ImageDimension | null {
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

function isNonLocalSource(src: string): boolean {
    return /^(https?:\/\/|data:|asset:\/\/)/i.test(src);
}

function parseNumber(value: string | null): number | null {
    if (!value) {
        return null;
    }
    const parsed = Number(value.trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function parsePixelValue(styleText: string, property: "width" | "height"): number | null {
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

function applyNormalImageStyle(image: HTMLImageElement): void {
    image.style.setProperty("max-width", "100%");
    image.style.setProperty("width", "auto");
    image.style.setProperty("height", "auto");
    image.style.setProperty("display", "block");
    image.style.setProperty("margin", "0 auto");
}

function applyLongImageInteraction(image: HTMLImageElement): void {
    let wrapper = image.parentElement;
    if (!wrapper || !wrapper.classList.contains("wy-img-long-scroll")) {
        wrapper = image.ownerDocument.createElement("div");
        wrapper.className = "wy-img-long-scroll";
        image.parentElement?.insertBefore(wrapper, image);
        wrapper.appendChild(image);
    }

    wrapper.style.setProperty("display", "block");
    wrapper.style.setProperty("margin", "0 auto");
    wrapper.style.setProperty("max-height", `${LONG_IMAGE_MAX_HEIGHT_VH}vh`);
    wrapper.style.setProperty("overflow-y", "auto");
    wrapper.style.setProperty("overflow-x", "hidden");
    wrapper.style.setProperty("-webkit-overflow-scrolling", "touch");

    image.style.setProperty("max-width", "100%");
    image.style.setProperty("width", "100%");
    image.style.setProperty("height", "auto");
    image.style.setProperty("display", "block");
    image.style.setProperty("margin", "0 auto");
}

function parseImageDimensionFromBuffer(buffer: Buffer): ImageDimension | null {
    return parsePngDimension(buffer) || parseJpegDimension(buffer) || parseGifDimension(buffer) || parseWebpDimension(buffer);
}

function parsePngDimension(buffer: Buffer): ImageDimension | null {
    if (buffer.length < 24) {
        return null;
    }
    const pngSignature = [0x89, 0x50, 0x4e, 0x47];
    for (let i = 0; i < pngSignature.length; i++) {
        if (buffer[i] !== pngSignature[i]) {
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

function parseGifDimension(buffer: Buffer): ImageDimension | null {
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

function parseJpegDimension(buffer: Buffer): ImageDimension | null {
    if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
        return null;
    }

    let offset = 2;
    while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) {
            offset++;
            continue;
        }

        const marker = buffer[offset + 1];
        if (marker === 0xda || marker === 0xd9) {
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

function isSofMarker(marker: number): boolean {
    return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
}

function parseWebpDimension(buffer: Buffer): ImageDimension | null {
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
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        return { width, height };
    }

    return null;
}
