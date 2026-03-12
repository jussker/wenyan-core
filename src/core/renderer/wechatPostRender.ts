// Issue 4: 语言名格式化映射（用于 language badge 显示）
function formatLangName(lang: string): string {
    const map: Record<string, string> = {
        javascript: "JavaScript",
        typescript: "TypeScript",
        python: "Python",
        bash: "Shell",
        shell: "Shell",
        sh: "Shell",
        css: "CSS",
        html: "HTML",
        json: "JSON",
        sql: "SQL",
        go: "Go",
        rust: "Rust",
        java: "Java",
        cpp: "C++",
        "c++": "C++",
        c: "C",
        yaml: "YAML",
        toml: "TOML",
        xml: "XML",
        markdown: "Markdown",
        md: "Markdown",
        dockerfile: "Dockerfile",
        plaintext: "",
        text: "",
    };
    const lower = lang.toLowerCase();
    if (lower in map) return map[lower];
    // capitalize first letter
    return lang.charAt(0).toUpperCase() + lang.slice(1);
}

function buildLanguageBadgeSection(document: Document, displayName: string, compact: boolean): HTMLElement {
    const section = document.createElement("section");
    section.style.cssText =
        "display:block;text-align:right;" +
        (compact ? "padding:2px 10px 6px 10px;" : "padding:6px 10px 6px 10px;") +
        "line-height:1;";

    const chip = buildLanguageBadgeChip(document, displayName, false);

    section.appendChild(chip);
    return section;
}

function buildLanguageBadgeChip(document: Document, displayName: string, compact: boolean): HTMLElement {
    const chip = document.createElement("span");
    chip.textContent = displayName;
    chip.style.cssText =
        "display:inline-block;border-radius:999px;" +
        (compact ? "padding:1px 8px;" : "padding:2px 8px;") +
        "font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;" +
        "font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;" +
        "line-height:1.25;border:1px solid rgba(148,163,184,0.35);" +
        "color:inherit;opacity:0.68;";
    return chip;
}

export function wechatPostRender(element: HTMLElement): void {
    // 1. 处理公式
    const mathElements = element.querySelectorAll<HTMLElement>("mjx-container");

    mathElements.forEach((mathContainer) => {
        // 精确指定 SVG 类型
        const svg = mathContainer.querySelector<SVGSVGElement>("svg");

        // 类型保护：确保 svg 存在
        if (!svg) return;

        // 获取属性，getAttribute 可能返回 null
        svg.style.width = svg.getAttribute("width") || "";
        svg.style.height = svg.getAttribute("height") || "";

        svg.removeAttribute("width");
        svg.removeAttribute("height");

        const parent = mathContainer.parentElement;

        // 类型保护：确保 parent 存在
        if (parent) {
            mathContainer.remove();
            parent.appendChild(svg);

            if (parent.classList.contains("block-equation")) {
                parent.setAttribute("style", "text-align: center; margin-bottom: 1rem;");
            }
        }
    });

    // 2. 处理代码块
    const codeElements = element.querySelectorAll<HTMLElement>("pre code");

    codeElements.forEach((codeEl) => {
        codeEl.innerHTML = codeEl.innerHTML
            .replace(/\n/g, "<br>")
            .replace(/(>[^<]+)|(^[^<]+)/g, (str: string) => str.replace(/\s/g, "&nbsp;"));
    });

    // 3. 列表
    const listElements = element.querySelectorAll<HTMLLIElement>("li");

    listElements.forEach((li) => {
        const doc = element.ownerDocument;
        const section = doc.createElement("section");

        // 将 li 的所有子节点移动进 section
        while (li.firstChild) {
            section.appendChild(li.firstChild);
        }
        // Issue 2: WeChat 默认 justify 导致文字分散，强制 left 对齐
        section.style.setProperty("display", "block");
        section.style.setProperty("text-align", "left");
        li.appendChild(section);
    });

    // 4. Issue 4: 为代码块注入 language badge（CSS 伪元素在微信端无效）
    const preElements = element.querySelectorAll<HTMLElement>("pre");

    preElements.forEach((pre) => {
        const codeEl = pre.querySelector<HTMLElement>("code");
        if (!codeEl) return;

        // 从 class 中提取 language-xxx
        const langClass = Array.from(codeEl.classList).find(
            (cls) => cls.startsWith("language-"),
        );
        if (!langClass) return;

        const lang = langClass.replace("language-", "");
        const displayName = formatLangName(lang);
        if (!displayName) return;

        const doc = pre.ownerDocument;

        // 检查是否有 macStyle 生成的 header section（firstElementChild 是 SECTION）
        const firstChild = pre.firstElementChild;
        const hasMacHeader =
            firstChild !== null &&
            firstChild.tagName === "SECTION" &&
            firstChild !== codeEl;

        if (hasMacHeader) {
            // 与 Mac 顶栏同一行对齐，确保三圆点与语言标签视觉基线一致
            const header = firstChild as HTMLElement;
            header.style.setProperty("display", "flex");
            header.style.setProperty("align-items", "center");
            header.style.setProperty("justify-content", "space-between");
            header.style.setProperty("box-sizing", "border-box");
            header.style.setProperty("padding-top", "12px");
            header.style.setProperty("padding-bottom", "6px");
            header.style.setProperty("padding-right", "12px");
            header.style.setProperty("min-height", "24px");
            header.style.setProperty("background-position", "left center");

            const badge = buildLanguageBadgeChip(doc, displayName, true);
            header.appendChild(badge);
        } else {
            // 无 mac header，在 code 前插入独立 badge section
            const badgeSection = buildLanguageBadgeSection(doc, displayName, false);
            pre.insertBefore(badgeSection, codeEl);
        }
    });
}
