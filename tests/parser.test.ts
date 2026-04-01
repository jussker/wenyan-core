import { describe, it, expect } from "vitest";
import { createWenyanCore } from "../src/core";

const markdown = `# title

paragraph

\`\`\`python
import sys
\`\`\`
`;

const instance = await createWenyanCore();

describe("createWenyanCore", async () => {
    it("should render markdown with custom heading and syntax highlighting", async () => {
        const result = await instance.renderMarkdown(markdown);

        // 1. 验证标题渲染逻辑
        expect(result).toContain("<h1><span>title</span></h1>");

        // 2. 验证普通段落
        expect(result).toContain("<p>paragraph</p>");

        // 3. 验证 highlight.js 是否正确挂载了类名
        // 检查是否包含 hljs 和对应的语言类名
        expect(result).toContain('class="hljs language-python"');

        // 4. 验证语法高亮是否真正工作
        // 检查 'import' 关键字是否被包裹在 span 中且具有正确的 token 类名
        expect(result).toContain('<span class="hljs-keyword">import</span>');

        // 5. 验证代码内容是否保留
        expect(result).toContain("sys");

    });

    it("should render markdown with image", async () => {
        const md = "![](C:/Users/lei/Downloads/1_0D7dkNntY-hlvNXAHzHr2g.jpg){x=100}";
        const result = await instance.renderMarkdown(md);

        // 验证图片标签是否正确渲染
        expect(result).toContain('src="C:/Users/lei/Downloads/1_0D7dkNntY-hlvNXAHzHr2g.jpg');

        // 验证自定义属性是否正确渲染
        expect(result).toContain('style="x:100px"');

    });

    it("should render wiki image syntax as img", async () => {
        const md = "![[多Agent相互对话案例演示.jpg]]";
        const result = await instance.renderMarkdown(md);

        expect(result).toContain('src="多Agent相互对话案例演示.jpg"');
        expect(result).toContain('alt=""');
    });

    it("should render wiki image syntax with alt text", async () => {
        const md = "![[a/b.png|示例图]]";
        const result = await instance.renderMarkdown(md);

        expect(result).toContain('src="a/b.png"');
        expect(result).toContain('alt="示例图"');
        expect(result).toContain('title="示例图"');
    });

    it("should keep inner fenced code as plain text when wrapped by a longer fence", async () => {
        const md = ["``````markdown", "```python", "print('inner')", "```", "``````"].join("\n");
        const result = await instance.renderMarkdown(md);

        expect(result).toContain('class="hljs language-markdown"');
        expect(result).not.toContain('class="hljs language-python"');
        expect(result).toContain("print");
    });
});
