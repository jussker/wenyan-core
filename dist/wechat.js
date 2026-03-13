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
function withAccessToken(url, accessToken) {
  return `${url}?access_token=${accessToken}`;
}
async function parseWechatResult(res) {
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  assertWechatSuccess(data);
  return data;
}
function createWechatClient(adapter) {
  return {
    async fetchAccessToken(appId, appSecret) {
      const res = await adapter.fetch(
        `${tokenUrl}?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
      );
      if (!res.ok) throw new Error(await res.text());
      return parseWechatResult(res);
    },
    async fetchStableAccessToken(appId, appSecret, forceRefresh = false) {
      const res = await adapter.fetch(stableTokenUrl, {
        method: "POST",
        body: JSON.stringify({
          grant_type: "client_credential",
          appid: appId,
          secret: appSecret,
          force_refresh: forceRefresh
        })
      });
      const data = await parseWechatResult(res);
      return data;
    },
    async callbackCheck(accessToken, action = "all", checkOperator = false) {
      const res = await adapter.fetch(withAccessToken(callbackCheckUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ action, check_operator: checkOperator })
      });
      return parseWechatResult(res);
    },
    async getApiDomainIp(accessToken) {
      const res = await adapter.fetch(withAccessToken(getApiDomainIpUrl, accessToken));
      return parseWechatResult(res);
    },
    async getCallbackIp(accessToken) {
      const res = await adapter.fetch(withAccessToken(getCallbackIpUrl, accessToken));
      return parseWechatResult(res);
    },
    async clearQuota(accessToken, appId) {
      const res = await adapter.fetch(withAccessToken(clearQuotaUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ appid: appId })
      });
      return parseWechatResult(res);
    },
    async getApiQuota(accessToken, cgiPath) {
      const res = await adapter.fetch(withAccessToken(getApiQuotaUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ cgi_path: cgiPath })
      });
      return parseWechatResult(res);
    },
    async getRidInfo(accessToken, rid) {
      const res = await adapter.fetch(withAccessToken(getRidInfoUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ rid })
      });
      return parseWechatResult(res);
    },
    async clearQuotaByAppSecret(appId, appSecret) {
      const res = await adapter.fetch(clearQuotaByAppSecretUrl, {
        method: "POST",
        body: JSON.stringify({ appid: appId, appsecret: appSecret })
      });
      return parseWechatResult(res);
    },
    async clearApiQuota(accessToken, cgiPath) {
      const res = await adapter.fetch(withAccessToken(clearApiQuotaUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ cgi_path: cgiPath })
      });
      return parseWechatResult(res);
    },
    async uploadMaterial(type, file, filename, accessToken) {
      const multipart = adapter.createMultipart("media", file, filename);
      const res = await adapter.fetch(`${withAccessToken(uploadMaterialUrl, accessToken)}&type=${type}`, {
        ...multipart,
        method: "POST"
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await parseWechatResult(res);
      if (data.url.startsWith("http://")) {
        data.url = data.url.replace(/^http:\/\//i, "https://");
      }
      return data;
    },
    async uploadImage(file, filename, accessToken) {
      const multipart = adapter.createMultipart("media", file, filename);
      const res = await adapter.fetch(withAccessToken(uploadImageUrl, accessToken), {
        ...multipart,
        method: "POST"
      });
      const data = await parseWechatResult(res);
      if (data.url.startsWith("http://")) {
        data.url = data.url.replace(/^http:\/\//i, "https://");
      }
      return data;
    },
    async getMaterial(accessToken, mediaId) {
      const res = await adapter.fetch(withAccessToken(getMaterialUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ media_id: mediaId })
      });
      return parseWechatResult(res);
    },
    async getMaterialCount(accessToken) {
      const res = await adapter.fetch(withAccessToken(getMaterialCountUrl, accessToken));
      return parseWechatResult(res);
    },
    async batchGetMaterial(accessToken, type, offset, count) {
      const res = await adapter.fetch(withAccessToken(batchGetMaterialUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ type, offset, count })
      });
      return parseWechatResult(res);
    },
    async deleteMaterial(accessToken, mediaId) {
      const res = await adapter.fetch(withAccessToken(deleteMaterialUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ media_id: mediaId })
      });
      return parseWechatResult(res);
    },
    async uploadTempMedia(type, file, filename, accessToken) {
      const multipart = adapter.createMultipart("media", file, filename);
      const res = await adapter.fetch(`${withAccessToken(uploadTempMediaUrl, accessToken)}&type=${type}`, {
        ...multipart,
        method: "POST"
      });
      return parseWechatResult(res);
    },
    async getMedia(accessToken, mediaId) {
      const res = await adapter.fetch(`${withAccessToken(getMediaUrl, accessToken)}&media_id=${mediaId}`);
      if (!res.ok) throw new Error(await res.text());
      return res;
    },
    async getHdVoice(accessToken, mediaId) {
      const res = await adapter.fetch(`${withAccessToken(getHdVoiceUrl, accessToken)}&media_id=${mediaId}`);
      if (!res.ok) throw new Error(await res.text());
      return res;
    },
    async draftSwitch(accessToken, isPublishOpen, checkOnly = false) {
      const res = await adapter.fetch(
        `${withAccessToken(draftSwitchUrl, accessToken)}&checkonly=${checkOnly ? 1 : 0}`,
        {
          method: "POST",
          body: JSON.stringify({ is_publish_open: isPublishOpen })
        }
      );
      return parseWechatResult(res);
    },
    async draftUpdate(accessToken, mediaId, index, article) {
      const res = await adapter.fetch(withAccessToken(draftUpdateUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ media_id: mediaId, index, articles: article })
      });
      return parseWechatResult(res);
    },
    async draftBatchGet(accessToken, offset, count, noContent = 0) {
      const res = await adapter.fetch(withAccessToken(draftBatchGetUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ offset, count, no_content: noContent })
      });
      return parseWechatResult(res);
    },
    async draftAdd(accessToken, options) {
      const res = await adapter.fetch(withAccessToken(draftAddUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({
          articles: [options]
        })
      });
      const data = await parseWechatResult(res);
      return data;
    },
    async draftCount(accessToken) {
      const res = await adapter.fetch(withAccessToken(draftCountUrl, accessToken));
      return parseWechatResult(res);
    },
    async draftDelete(accessToken, mediaId) {
      const res = await adapter.fetch(withAccessToken(draftDeleteUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ media_id: mediaId })
      });
      return parseWechatResult(res);
    },
    async getDraft(accessToken, mediaId) {
      const res = await adapter.fetch(withAccessToken(draftGetUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ media_id: mediaId })
      });
      return parseWechatResult(res);
    },
    async getProductCardInfo(accessToken, productId) {
      const res = await adapter.fetch(withAccessToken(getProductCardInfoUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ product_id: productId })
      });
      return parseWechatResult(res);
    },
    async freepublishBatchGet(accessToken, offset, count) {
      const res = await adapter.fetch(withAccessToken(freepublishBatchGetUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ offset, count })
      });
      return parseWechatResult(res);
    },
    async freepublishDelete(accessToken, articleId) {
      const res = await adapter.fetch(withAccessToken(freepublishDeleteUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ article_id: articleId })
      });
      return parseWechatResult(res);
    },
    async freepublishGet(accessToken, publishId) {
      const res = await adapter.fetch(withAccessToken(freepublishGetUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ publish_id: publishId })
      });
      return parseWechatResult(res);
    },
    async freepublishGetArticle(accessToken, articleId) {
      const res = await adapter.fetch(withAccessToken(freepublishGetArticleUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ article_id: articleId })
      });
      return parseWechatResult(res);
    },
    async freepublishSubmit(accessToken, mediaId) {
      const res = await adapter.fetch(withAccessToken(freepublishSubmitUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({ media_id: mediaId })
      });
      return parseWechatResult(res);
    },
    /**
     * 渲染文章到公众号草稿箱（draftAdd 的语义别名）。
     *
     * @remarks 仅创建草稿，不触发群发/发布。发布草稿请使用 freepublishSubmit。
     * @remarks 直接使用闭包中的 adapter，避免解构赋值时 this 丢失。
     */
    async createDraft(accessToken, options) {
      const res = await adapter.fetch(withAccessToken(draftAddUrl, accessToken), {
        method: "POST",
        body: JSON.stringify({
          articles: [options]
        })
      });
      const data = await parseWechatResult(res);
      return data;
    }
  };
}
function assertWechatSuccess(data) {
  if ("errcode" in data && data.errcode !== 0) {
    throw new Error(`${data.errcode}: ${data.errmsg}`);
  }
}
export {
  createWechatClient
};
