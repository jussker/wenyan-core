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
export declare function resolveMermaidPpi(mermaidPpi?: number): number;
export declare function resolveMermaidRenderScale(mermaidRenderScale?: number): number;
export declare function computeMermaidTargetWidth(baseCssWidth: number, mermaidPpi: number): number;
export declare function replaceMermaidCodeBlocksWithImages(root: HTMLElement, options?: MermaidScreenshotOptions): Promise<void>;
export {};
