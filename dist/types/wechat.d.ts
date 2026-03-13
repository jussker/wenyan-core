import type { HttpAdapter } from "./http.js";
export interface WechatPublishOptions {
    title: string;
    author?: string;
    content: string;
    thumb_media_id: string;
    content_source_url?: string;
}
export interface WechatErrorResponse {
    errcode: number;
    errmsg: string;
}
export interface WechatUploadResponse {
    media_id: string;
    url: string;
}
export interface WechatTokenResponse {
    access_token: string;
    expires_in: number;
}
export interface WechatPublishResponse {
    media_id: string;
}
export interface WechatUploadImageResponse {
    url: string;
}
export declare function createWechatClient(adapter: HttpAdapter): {
    fetchAccessToken(appId: string, appSecret: string): Promise<WechatTokenResponse>;
    fetchStableAccessToken(appId: string, appSecret: string, forceRefresh?: boolean): Promise<WechatTokenResponse>;
    callbackCheck(accessToken: string, action?: string, checkOperator?: boolean): Promise<object>;
    getApiDomainIp(accessToken: string): Promise<object>;
    getCallbackIp(accessToken: string): Promise<object>;
    clearQuota(accessToken: string, appId: string): Promise<object>;
    getApiQuota(accessToken: string, cgiPath: string): Promise<object>;
    getRidInfo(accessToken: string, rid: string): Promise<object>;
    clearQuotaByAppSecret(appId: string, appSecret: string): Promise<object>;
    clearApiQuota(accessToken: string, cgiPath: string): Promise<object>;
    uploadMaterial(type: string, file: Blob, filename: string, accessToken: string): Promise<WechatUploadResponse>;
    uploadImage(file: Blob, filename: string, accessToken: string): Promise<WechatUploadImageResponse>;
    getMaterial(accessToken: string, mediaId: string): Promise<object>;
    getMaterialCount(accessToken: string): Promise<object>;
    batchGetMaterial(accessToken: string, type: string, offset: number, count: number): Promise<object>;
    deleteMaterial(accessToken: string, mediaId: string): Promise<object>;
    uploadTempMedia(type: string, file: Blob, filename: string, accessToken: string): Promise<WechatUploadResponse>;
    getMedia(accessToken: string, mediaId: string): Promise<Response>;
    getHdVoice(accessToken: string, mediaId: string): Promise<Response>;
    draftSwitch(accessToken: string, isPublishOpen: 0 | 1, checkOnly?: boolean): Promise<object>;
    draftUpdate(accessToken: string, mediaId: string, index: number, article: WechatPublishOptions): Promise<object>;
    draftBatchGet(accessToken: string, offset: number, count: number, noContent?: number): Promise<object>;
    draftAdd(accessToken: string, options: WechatPublishOptions): Promise<WechatPublishResponse>;
    draftCount(accessToken: string): Promise<object>;
    draftDelete(accessToken: string, mediaId: string): Promise<object>;
    getDraft(accessToken: string, mediaId: string): Promise<object>;
    getProductCardInfo(accessToken: string, productId: string): Promise<object>;
    freepublishBatchGet(accessToken: string, offset: number, count: number): Promise<object>;
    freepublishDelete(accessToken: string, articleId: string): Promise<object>;
    freepublishGet(accessToken: string, publishId: string): Promise<object>;
    freepublishGetArticle(accessToken: string, articleId: string): Promise<object>;
    freepublishSubmit(accessToken: string, mediaId: string): Promise<object>;
    /**
     * 渲染文章到公众号草稿箱（draftAdd 的语义别名）。
     *
     * @remarks 仅创建草稿，不触发群发/发布。发布草稿请使用 freepublishSubmit。
     * @remarks 直接使用闭包中的 adapter，避免解构赋值时 this 丢失。
     */
    createDraft(accessToken: string, options: WechatPublishOptions): Promise<WechatPublishResponse>;
};
export type WechatClient = ReturnType<typeof createWechatClient>;
