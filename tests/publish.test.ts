import { describe, it, expect, vi, beforeEach } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fetchAccessToken = vi.fn().mockResolvedValue({
    access_token: "mock_token",
    expires_in: 7200,
});
const uploadMaterial = vi.fn().mockResolvedValue({
    media_id: "mock_media_id",
    url: "https://mock.url/image.jpg",
});
const publishArticle = vi.fn().mockResolvedValue({
    media_id: "mock_media_id",
});

vi.mock("../src/wechat.js", () => {
    return {
        createWechatClient: vi.fn(() => ({
            fetchAccessToken,
            uploadMaterial,
            publishArticle,
        })),
    };
});

describe("publish.ts tests", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const coverPath = join(__dirname, "wenyan.jpg");

    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("should publish article successfully", async () => {
        const { publishToDraft } = await import("../src/node/publish.js");
        const result = await publishToDraft("自动化测试", "<p>正文</p>", coverPath, {
            appId: "mock_app_id",
            appSecret: "mock_app_secret",
        });
        expect(result).toHaveProperty("media_id", "mock_media_id");
    });

    it("should throw error when no media_id returned", async () => {
        const { publishToDraft } = await import("../src/node/publish.js");
        publishArticle.mockResolvedValueOnce({});

        await expect(
            publishToDraft("失败测试", "<p>正文</p>", coverPath, {
                appId: "mock_app_id",
                appSecret: "mock_app_secret",
            })
        ).rejects.toThrow(/上传到公众号草稿失败/);
    });
});
