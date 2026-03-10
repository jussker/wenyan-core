import { describe, expect, it, vi } from "vitest";
import { createWechatClient } from "../src/wechat.js";
import type { HttpAdapter } from "../src/http.js";

function createMockAdapter(responseBody: unknown = {}) {
    const fetch = vi.fn().mockImplementation(async () =>
        new Response(JSON.stringify(responseBody), {
            status: 200,
            headers: { "content-type": "application/json" },
        }),
    );

    const createMultipart = vi.fn().mockReturnValue({
        body: "multipart-body" as unknown as BodyInit,
        headers: { "content-type": "multipart/form-data; boundary=test" },
    });

    const adapter: HttpAdapter = { fetch, createMultipart };
    return { adapter, fetch, createMultipart };
}

describe("wechat client api coverage", () => {
    it("should call stable token endpoint with expected payload", async () => {
        const { adapter, fetch } = createMockAdapter({ access_token: "token", expires_in: 7200 });
        const client = createWechatClient(adapter);

        const result = await client.fetchStableAccessToken("appid", "secret", true);

        expect(result.access_token).toBe("token");
        expect(fetch).toHaveBeenCalledWith(
            "https://api.weixin.qq.com/cgi-bin/stable_token",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    grant_type: "client_credential",
                    appid: "appid",
                    secret: "secret",
                    force_refresh: true,
                }),
            }),
        );
    });

    it("should use uploadimg endpoint for article image upload", async () => {
        const { adapter, fetch, createMultipart } = createMockAdapter({ url: "http://test.img" });
        const client = createWechatClient(adapter);

        const result = await client.uploadImage(new Blob(["img"]), "a.jpg", "token");

        expect(createMultipart).toHaveBeenCalledWith("media", expect.any(Blob), "a.jpg");
        expect(fetch).toHaveBeenCalledWith(
            "https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=token",
            expect.objectContaining({ method: "POST" }),
        );
        expect(result.url).toBe("https://test.img");
    });

    it("should support draft add and publish submit endpoints", async () => {
        const { adapter, fetch } = createMockAdapter({ media_id: "draft-id" });
        const client = createWechatClient(adapter);

        const draft = await client.draftAdd("token", {
            title: "t",
            content: "c",
            thumb_media_id: "mid",
        });

        await client.freepublishSubmit("token", draft.media_id);

        expect(fetch).toHaveBeenNthCalledWith(
            1,
            "https://api.weixin.qq.com/cgi-bin/draft/add?access_token=token",
            expect.objectContaining({ method: "POST" }),
        );
        expect(fetch).toHaveBeenNthCalledWith(
            2,
            "https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=token",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ media_id: "draft-id" }),
            }),
        );
    });

    it("should not treat errcode 0 as error", async () => {
        const { adapter } = createMockAdapter({ errcode: 0, errmsg: "ok" });
        const client = createWechatClient(adapter);

        await expect(client.clearQuota("token", "appid")).resolves.toEqual({ errcode: 0, errmsg: "ok" });
    });
});
