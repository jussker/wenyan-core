import { ApplyStylesOptions, createWenyanCore } from "../core/index.js";
import { configStore } from "./configStore.js";
import { GetInputContentFn, RenderContext, RenderOptions, StyledContent } from "./types.js";
import { getNormalizeFilePath, readFileContent } from "./utils.js";
import { JSDOM } from "jsdom";
import { applyAdaptiveImageInteractions } from "./imageMeta.js";
import {
    MermaidDiagramRenderer,
    MermaidTempFileWriter,
    replaceMermaidCodeBlocksWithImages,
} from "./mermaidScreenshot.js";

const wenyanCoreInstance = await createWenyanCore();

const ENV_DEFAULT_AUTHOR = "WECHAT_DEFAULT_AUTHOR";
const ENV_CTA_PRE_HEAD = "WECHAT_CTA_PRE_HEAD";
const ENV_CTA_POST_FOOTNOTE = "WECHAT_CTA_POST_FOOTNOTE";

type NodeRenderStyleOptions = ApplyStylesOptions & {
    assetBaseDir?: string;
    mermaid?: boolean;
    mermaidPpi?: number;
    mermaidRenderScale?: number;
    longImageMode?: "auto" | "always" | "off";
    longImageRatioThreshold?: number;
    longImageMaxHeightVh?: number;
    mermaidRenderer?: MermaidDiagramRenderer;
    mermaidTempFileWriter?: MermaidTempFileWriter;
};

export async function renderWithTheme(
    markdownContent: string,
    options: RenderOptions,
    assetBaseDir?: string,
): Promise<StyledContent> {
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
        longImageMaxHeightVh,
    } = options;

    let handledCustomTheme: string | undefined = customTheme;
    // 当用户传入自定义主题路径时，优先级最高
    if (customTheme) {
        const normalizePath = getNormalizeFilePath(customTheme);
        handledCustomTheme = await readFileContent(normalizePath);
    } else if (theme) {
        // 否则尝试读取配置中的自定义主题
        handledCustomTheme = await configStore.getThemeById(theme);
    }

    if (!handledCustomTheme && !theme) {
        throw new Error(`theme "${theme}" not found.`);
    }

    // 5. 执行核心渲染
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
        longImageMaxHeightVh,
    });

    return gzhContent;
}

export async function renderStyledContent(content: string, options: NodeRenderStyleOptions = {}): Promise<StyledContent> {
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
    const document = dom.window.document;
    const wenyan = document.getElementById("wenyan");
    await replaceMermaidCodeBlocksWithImages(wenyan!, {
        mermaid,
        mermaidPpi,
        mermaidRenderScale,
        renderer: mermaidRenderer,
        writeTempFile: mermaidTempFileWriter,
    });
    await applyAdaptiveImageInteractions(wenyan!, assetBaseDir, {
        mode: longImageMode,
        ratioThreshold: longImageRatioThreshold,
        maxHeightVh: longImageMaxHeightVh,
    });
    const result = await wenyanCoreInstance.applyStylesWithTheme(wenyan!, {
        ...styleOptions,
        preHeadCtaHtml,
        postFootnoteCtaHtml,
    });
    return {
        content: result,
        title: preHandlerContent.title,
        cover: preHandlerContent.cover,
        description: preHandlerContent.description,
        author: preHandlerContent.author,
        source_url: preHandlerContent.source_url,
    };
}

function getEnvSnippet(name: string): string {
    const value = process.env[name] || "";
    return value.trim().replace(/\\n/g, "\n");
}

function looksLikeHtmlSnippet(snippet: string): boolean {
    return /<\/?[a-z][\w-]*(\s[^>]*)?>/i.test(snippet);
}

async function resolveSnippetToHtml(snippet: string): Promise<string> {
    if (!snippet) {
        return "";
    }

    if (looksLikeHtmlSnippet(snippet)) {
        return snippet;
    }

    return await wenyanCoreInstance.renderMarkdown(snippet);
}

// --- 处理输入源、文件路径和主题 ---
export async function prepareRenderContext(
    inputContent: string | undefined,
    options: RenderOptions,
    getInputContent: GetInputContentFn,
): Promise<RenderContext> {
    const { content, absoluteDirPath } = await getInputContent(inputContent, options.file);
    const gzhContent = await renderWithTheme(content, options, absoluteDirPath);

    return { gzhContent, absoluteDirPath };
}
