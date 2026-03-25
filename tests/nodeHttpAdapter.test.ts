import { describe, expect, it } from "vitest";
import { nodeHttpAdapter } from "../src/node/nodeHttpAdapter.js";

describe("nodeHttpAdapter multipart", () => {
    it("should include duplex half for stream body upload", () => {
        const multipart = nodeHttpAdapter.createMultipart("media", new Blob(["a"]), "a.txt");

        expect(multipart.duplex).toBe("half");
        expect(multipart.headers).toBeDefined();
        expect(multipart.body).toBeDefined();
    });
});
