import { ApplyStylesOptions } from "../core/index.js";
import { GetInputContentFn, RenderContext, RenderOptions, StyledContent } from "./types.js";
import { MermaidDiagramRenderer, MermaidTempFileWriter } from "./mermaidScreenshot.js";
type NodeRenderStyleOptions = ApplyStylesOptions & {
    assetBaseDir?: string;
    mermaid?: boolean;
    mermaidPpi?: number;
    mermaidRenderer?: MermaidDiagramRenderer;
    mermaidTempFileWriter?: MermaidTempFileWriter;
};
export declare function renderWithTheme(markdownContent: string, options: RenderOptions, assetBaseDir?: string): Promise<StyledContent>;
export declare function renderStyledContent(content: string, options?: NodeRenderStyleOptions): Promise<StyledContent>;
export declare function prepareRenderContext(inputContent: string | undefined, options: RenderOptions, getInputContent: GetInputContentFn): Promise<RenderContext>;
export {};
