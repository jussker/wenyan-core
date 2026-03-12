/** 上传回调类型：接收 PNG Buffer 和文件名，返回可访问的图片 URL */
export type TableUploadCallback = (buffer: Buffer, filename: string) => Promise<string>;
/**
 * 将文章 HTML 中所有 <table> 元素截图并替换为 <img>。
 *
 * @param articleSectionHtml - 完整的 #wenyan section 的 outerHTML（含 inline styles）
 * @param upload - 上传回调，返回微信 CDN URL
 * @returns 修改后的 HTML（table 已替换为 img），或 Puppeteer 失败时返回原始 HTML
 */
export declare function replaceTablesWithScreenshots(articleSectionHtml: string, upload: TableUploadCallback): Promise<string>;
