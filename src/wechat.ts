import type { HttpAdapter } from "./http.js";

const tokenUrl = "https://api.weixin.qq.com/cgi-bin/token";
const stableTokenUrl = "https://api.weixin.qq.com/cgi-bin/stable_token";
const callbackCheckUrl = "https://api.weixin.qq.com/cgi-bin/callback/check";
const getApiDomainIpUrl = "https://api.weixin.qq.com/cgi-bin/get_api_domain_ip";
const getCallbackIpUrl = "https://api.weixin.qq.com/cgi-bin/getcallbackip";
const clearQuotaUrl = "https://api.weixin.qq.com/cgi-bin/clear_quota";
const clearQuotaByAppSecretUrl = "https://api.weixin.qq.com/cgi-bin/clear_quota/v2";
const getApiQuotaUrl = "https://api.weixin.qq.com/cgi-bin/openapi/quota/get";
const clearApiQuotaUrl = "https://api.weixin.qq.com/cgi-bin/openapi/quota/clear";
const getRidInfoUrl = "https://api.weixin.qq.com/cgi-bin/openapi/rid/get";
const uploadMaterialUrl = "https://api.weixin.qq.com/cgi-bin/material/add_material";
const uploadImageUrl = "https://api.weixin.qq.com/cgi-bin/media/uploadimg";
const getMaterialUrl = "https://api.weixin.qq.com/cgi-bin/material/get_material";
const getMaterialCountUrl = "https://api.weixin.qq.com/cgi-bin/material/get_materialcount";
const batchGetMaterialUrl = "https://api.weixin.qq.com/cgi-bin/material/batchget_material";
const deleteMaterialUrl = "https://api.weixin.qq.com/cgi-bin/material/del_material";
const uploadTempMediaUrl = "https://api.weixin.qq.com/cgi-bin/media/upload";
const getMediaUrl = "https://api.weixin.qq.com/cgi-bin/media/get";
const getHdVoiceUrl = "https://api.weixin.qq.com/cgi-bin/media/get/jssdk";
const draftSwitchUrl = "https://api.weixin.qq.com/cgi-bin/draft/switch";
const draftUpdateUrl = "https://api.weixin.qq.com/cgi-bin/draft/update";
const draftBatchGetUrl = "https://api.weixin.qq.com/cgi-bin/draft/batchget";
const draftAddUrl = "https://api.weixin.qq.com/cgi-bin/draft/add";
const draftCountUrl = "https://api.weixin.qq.com/cgi-bin/draft/count";
const draftDeleteUrl = "https://api.weixin.qq.com/cgi-bin/draft/delete";
const draftGetUrl = "https://api.weixin.qq.com/cgi-bin/draft/get";
const getProductCardInfoUrl = "https://api.weixin.qq.com/channels/ec/service/product/getcardinfo";
const freepublishBatchGetUrl = "https://api.weixin.qq.com/cgi-bin/freepublish/batchget";
const freepublishDeleteUrl = "https://api.weixin.qq.com/cgi-bin/freepublish/delete";
const freepublishGetUrl = "https://api.weixin.qq.com/cgi-bin/freepublish/get";
const freepublishGetArticleUrl = "https://api.weixin.qq.com/cgi-bin/freepublish/getarticle";
const freepublishSubmitUrl = "https://api.weixin.qq.com/cgi-bin/freepublish/submit";

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

type WechatApiResult<T extends object> = T | WechatErrorResponse;

function withAccessToken(url: string, accessToken: string) {
    return `${url}?access_token=${accessToken}`;
}

async function parseWechatResult<T extends object>(res: Response): Promise<T> {
    if (!res.ok) throw new Error(await res.text());
    const data: WechatApiResult<T> = await res.json();
    assertWechatSuccess(data);
    return data;
}

export function createWechatClient(adapter: HttpAdapter) {
    return {
        async fetchAccessToken(appId: string, appSecret: string): Promise<WechatTokenResponse> {
            const res = await adapter.fetch(
                `${tokenUrl}?grant_type=client_credential&appid=${appId}&secret=${appSecret}`,
            );
            if (!res.ok) throw new Error(await res.text());

            return parseWechatResult(res);
        },

        async fetchStableAccessToken(
            appId: string,
            appSecret: string,
            forceRefresh = false,
        ): Promise<WechatTokenResponse> {
            const res = await adapter.fetch(stableTokenUrl, {
                method: "POST",
                body: JSON.stringify({
                    grant_type: "client_credential",
                    appid: appId,
                    secret: appSecret,
                    force_refresh: forceRefresh,
                }),
            });

            const data: WechatTokenResponse = await parseWechatResult(res);
            return data;
        },

        async callbackCheck(accessToken: string, action = "all", checkOperator = false): Promise<object> {
            const res = await adapter.fetch(withAccessToken(callbackCheckUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ action, check_operator: checkOperator }),
            });
            return parseWechatResult(res);
        },

        async getApiDomainIp(accessToken: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(getApiDomainIpUrl, accessToken));
            return parseWechatResult(res);
        },

        async getCallbackIp(accessToken: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(getCallbackIpUrl, accessToken));
            return parseWechatResult(res);
        },

        async clearQuota(accessToken: string, appId: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(clearQuotaUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ appid: appId }),
            });
            return parseWechatResult(res);
        },

        async getApiQuota(accessToken: string, cgiPath: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(getApiQuotaUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ cgi_path: cgiPath }),
            });
            return parseWechatResult(res);
        },

        async getRidInfo(accessToken: string, rid: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(getRidInfoUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ rid }),
            });
            return parseWechatResult(res);
        },

        async clearQuotaByAppSecret(appId: string, appSecret: string): Promise<object> {
            const res = await adapter.fetch(clearQuotaByAppSecretUrl, {
                method: "POST",
                body: JSON.stringify({ appid: appId, appsecret: appSecret }),
            });
            return parseWechatResult(res);
        },

        async clearApiQuota(accessToken: string, cgiPath: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(clearApiQuotaUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ cgi_path: cgiPath }),
            });
            return parseWechatResult(res);
        },

        async uploadMaterial(
            type: string,
            file: Blob,
            filename: string,
            accessToken: string,
        ): Promise<WechatUploadResponse> {
            const multipart = adapter.createMultipart("media", file, filename);

            const res = await adapter.fetch(`${withAccessToken(uploadMaterialUrl, accessToken)}&type=${type}`, {
                ...multipart,
                method: "POST",
            });

            if (!res.ok) throw new Error(await res.text());

            const data: WechatUploadResponse = await parseWechatResult(res);

            if (data.url.startsWith("http://")) {
                data.url = data.url.replace(/^http:\/\//i, "https://");
            }

            return data;
        },

        async uploadImage(
            file: Blob,
            filename: string,
            accessToken: string,
        ): Promise<WechatUploadImageResponse> {
            const multipart = adapter.createMultipart("media", file, filename);
            const res = await adapter.fetch(withAccessToken(uploadImageUrl, accessToken), {
                ...multipart,
                method: "POST",
            });
            const data: WechatUploadImageResponse = await parseWechatResult(res);
            if (data.url.startsWith("http://")) {
                data.url = data.url.replace(/^http:\/\//i, "https://");
            }
            return data;
        },

        async getMaterial(accessToken: string, mediaId: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(getMaterialUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ media_id: mediaId }),
            });
            return parseWechatResult(res);
        },

        async getMaterialCount(accessToken: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(getMaterialCountUrl, accessToken));
            return parseWechatResult(res);
        },

        async batchGetMaterial(accessToken: string, type: string, offset: number, count: number): Promise<object> {
            const res = await adapter.fetch(withAccessToken(batchGetMaterialUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ type, offset, count }),
            });
            return parseWechatResult(res);
        },

        async deleteMaterial(accessToken: string, mediaId: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(deleteMaterialUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ media_id: mediaId }),
            });
            return parseWechatResult(res);
        },

        async uploadTempMedia(
            type: string,
            file: Blob,
            filename: string,
            accessToken: string,
        ): Promise<WechatUploadResponse> {
            const multipart = adapter.createMultipart("media", file, filename);
            const res = await adapter.fetch(`${withAccessToken(uploadTempMediaUrl, accessToken)}&type=${type}`, {
                ...multipart,
                method: "POST",
            });
            return parseWechatResult(res);
        },

        async getMedia(accessToken: string, mediaId: string): Promise<Response> {
            const res = await adapter.fetch(`${withAccessToken(getMediaUrl, accessToken)}&media_id=${mediaId}`);
            if (!res.ok) throw new Error(await res.text());
            return res;
        },

        async getHdVoice(accessToken: string, mediaId: string): Promise<Response> {
            const res = await adapter.fetch(`${withAccessToken(getHdVoiceUrl, accessToken)}&media_id=${mediaId}`);
            if (!res.ok) throw new Error(await res.text());
            return res;
        },

        async draftSwitch(
            accessToken: string,
            isPublishOpen: 0 | 1,
            checkOnly = false,
        ): Promise<object> {
            const res = await adapter.fetch(
                `${withAccessToken(draftSwitchUrl, accessToken)}&checkonly=${checkOnly ? 1 : 0}`,
                {
                    method: "POST",
                    body: JSON.stringify({ is_publish_open: isPublishOpen }),
                },
            );
            return parseWechatResult(res);
        },

        async draftUpdate(
            accessToken: string,
            mediaId: string,
            index: number,
            article: WechatPublishOptions,
        ): Promise<object> {
            const res = await adapter.fetch(withAccessToken(draftUpdateUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ media_id: mediaId, index, articles: article }),
            });
            return parseWechatResult(res);
        },

        async draftBatchGet(
            accessToken: string,
            offset: number,
            count: number,
            noContent = 0,
        ): Promise<object> {
            const res = await adapter.fetch(withAccessToken(draftBatchGetUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ offset, count, no_content: noContent }),
            });
            return parseWechatResult(res);
        },

        async draftAdd(accessToken: string, options: WechatPublishOptions): Promise<WechatPublishResponse> {
            const res = await adapter.fetch(withAccessToken(draftAddUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({
                    articles: [options],
                }),
            });

            const data: WechatPublishResponse = await parseWechatResult(res);
            return data;
        },

        async draftCount(accessToken: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(draftCountUrl, accessToken));
            return parseWechatResult(res);
        },

        async draftDelete(accessToken: string, mediaId: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(draftDeleteUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ media_id: mediaId }),
            });
            return parseWechatResult(res);
        },

        async getDraft(accessToken: string, mediaId: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(draftGetUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ media_id: mediaId }),
            });
            return parseWechatResult(res);
        },

        async getProductCardInfo(accessToken: string, productId: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(getProductCardInfoUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ product_id: productId }),
            });
            return parseWechatResult(res);
        },

        async freepublishBatchGet(accessToken: string, offset: number, count: number): Promise<object> {
            const res = await adapter.fetch(withAccessToken(freepublishBatchGetUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ offset, count }),
            });
            return parseWechatResult(res);
        },

        async freepublishDelete(accessToken: string, articleId: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(freepublishDeleteUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ article_id: articleId }),
            });
            return parseWechatResult(res);
        },

        async freepublishGet(accessToken: string, publishId: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(freepublishGetUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ publish_id: publishId }),
            });
            return parseWechatResult(res);
        },

        async freepublishGetArticle(accessToken: string, articleId: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(freepublishGetArticleUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ article_id: articleId }),
            });
            return parseWechatResult(res);
        },

        async freepublishSubmit(accessToken: string, mediaId: string): Promise<object> {
            const res = await adapter.fetch(withAccessToken(freepublishSubmitUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({ media_id: mediaId }),
            });
            return parseWechatResult(res);
        },

        /**
         * 渲染文章到公众号草稿箱（draftAdd 的语义别名）。
         *
         * @remarks 仅创建草稿，不触发群发/发布。发布草稿请使用 freepublishSubmit。
         * @remarks 直接使用闭包中的 adapter，避免解构赋值时 this 丢失。
         */
        async createDraft(accessToken: string, options: WechatPublishOptions): Promise<WechatPublishResponse> {
            const res = await adapter.fetch(withAccessToken(draftAddUrl, accessToken), {
                method: "POST",
                body: JSON.stringify({
                    articles: [options],
                }),
            });
            const data: WechatPublishResponse = await parseWechatResult(res);
            return data;
        },
    };
}

function assertWechatSuccess<T extends object>(data: T | WechatErrorResponse): asserts data is T {
    if ("errcode" in data && data.errcode !== 0) {
        throw new Error(`${data.errcode}: ${data.errmsg}`);
    }
}

export type WechatClient = ReturnType<typeof createWechatClient>;
