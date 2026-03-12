export function addFootnotes(element: HTMLElement, listStyle: boolean = false): void {
    const footnotes: Array<[number, string, string]> = [];
    let footnoteIndex = 0;
    const links = element.querySelectorAll<HTMLAnchorElement>("a[href]"); // 获取所有带有 href 的 a 元素
    links.forEach((linkElement) => {
        if (isInMarkdownFootnoteDefinition(linkElement)) {
            return;
        }

        const title = linkElement.textContent || linkElement.innerText;
        const href = linkElement.getAttribute("href") || "";

        // 添加脚注并获取脚注编号
        footnotes.push([++footnoteIndex, title, href]);

        // 在链接后插入脚注标记
        const footnoteMarker = element.ownerDocument.createElement("sup");
        footnoteMarker.setAttribute("class", "footnote");
        footnoteMarker.innerHTML = `[${footnoteIndex}]`;
        linkElement.after(footnoteMarker);
    });
    if (footnoteIndex === 0) return;

    const footnotesHtml = listStyle ? renderListStyleFootnotes(footnotes) : renderParagraphStyleFootnotes(footnotes);

    element.insertAdjacentHTML("beforeend", footnotesHtml);
}

function isInMarkdownFootnoteDefinition(linkElement: HTMLAnchorElement): boolean {
    const paragraph = linkElement.closest("p");
    if (!paragraph) {
        return false;
    }

    const raw = paragraph.innerHTML.trim();
    return /^\[\^[^\]]+\]:/.test(raw);
}

export function normalizeMarkdownFootnotes(element: HTMLElement): void {
    const definitionById = collectMarkdownFootnoteDefinitions(element);
    if (definitionById.size === 0) {
        return;
    }

    const numberById = replaceMarkdownFootnoteReferences(element, definitionById);
    if (numberById.size === 0) {
        return;
    }

    appendMarkdownFootnotes(element, definitionById, numberById);
}

function collectMarkdownFootnoteDefinitions(element: HTMLElement): Map<string, string> {
    const definitionById = new Map<string, string>();
    const definitionNodes: HTMLParagraphElement[] = [];
    const paragraphs = element.querySelectorAll<HTMLParagraphElement>("p");

    paragraphs.forEach((paragraph) => {
        const raw = paragraph.innerHTML.trim();
        const markerRegex = /\[\^([^\]]+)\]:/g;
        const markers = [...raw.matchAll(markerRegex)];
        if (markers.length === 0) {
            return;
        }

        markers.forEach((match, index) => {
            const id = (match[1] || "").trim();
            const markerStart = match.index ?? 0;
            const markerEnd = markerStart + match[0].length;
            const nextStart = index < markers.length - 1 ? markers[index + 1].index ?? raw.length : raw.length;

            let contentHtml = raw.slice(markerEnd, nextStart).trim();
            contentHtml = trimEdgeBreaks(contentHtml);

            if (!id || !contentHtml) {
                return;
            }

            if (!definitionById.has(id)) {
                definitionById.set(id, contentHtml);
            }
        });

        definitionNodes.push(paragraph);
    });

    definitionNodes.forEach((node) => node.remove());
    return definitionById;
}

function trimEdgeBreaks(contentHtml: string): string {
    let result = contentHtml.trim();
    result = result.replace(/^(<br\s*\/?>\s*)+/i, "");
    result = result.replace(/(\s*<br\s*\/?>)+$/i, "");
    return result.trim();
}

function replaceMarkdownFootnoteReferences(
    element: HTMLElement,
    definitionById: Map<string, string>,
): Map<string, number> {
    const doc = element.ownerDocument;
    const numberById = new Map<string, number>();
    let nextNumber = getExistingFootnoteCount(element) + 1;
    const textNodeFilter = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
    const walker = doc.createTreeWalker(element, textNodeFilter);
    const targets: Text[] = [];

    while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (shouldSkipReferenceNode(node)) {
            continue;
        }
        if (/\[\^([^\]]+)\]/.test(node.textContent || "")) {
            targets.push(node);
        }
    }

    targets.forEach((textNode) => {
        const text = textNode.textContent || "";
        const regex = /\[\^([^\]]+)\]/g;
        let match: RegExpExecArray | null = null;
        let cursor = 0;
        const fragment = doc.createDocumentFragment();
        let replaced = false;

        while ((match = regex.exec(text)) !== null) {
            const marker = match[0];
            const id = (match[1] || "").trim();
            const start = match.index;

            if (start > cursor) {
                fragment.appendChild(doc.createTextNode(text.slice(cursor, start)));
            }

            if (!definitionById.has(id)) {
                fragment.appendChild(doc.createTextNode(marker));
                cursor = start + marker.length;
                continue;
            }

            const mapped = numberById.get(id);
            const number = mapped ?? nextNumber++;
            if (mapped === undefined) {
                numberById.set(id, number);
            }

            const sup = doc.createElement("sup");
            sup.className = "footnote";
            sup.textContent = `[${number}]`;
            fragment.appendChild(sup);
            replaced = true;
            cursor = start + marker.length;
        }

        if (!replaced) {
            return;
        }

        if (cursor < text.length) {
            fragment.appendChild(doc.createTextNode(text.slice(cursor)));
        }

        textNode.replaceWith(fragment);
    });

    return numberById;
}

function appendMarkdownFootnotes(
    element: HTMLElement,
    definitionById: Map<string, string>,
    numberById: Map<string, number>,
): void {
    const doc = element.ownerDocument;
    let container = element.querySelector<HTMLElement>("#footnotes");

    if (!container) {
        element.insertAdjacentHTML("beforeend", "<h3>引用链接</h3><section id=\"footnotes\"></section>");
        container = element.querySelector<HTMLElement>("#footnotes");
    }
    if (!container) {
        return;
    }

    const ordered = [...numberById.entries()].sort((a, b) => a[1] - b[1]);
    ordered.forEach(([id, number]) => {
        const contentHtml = definitionById.get(id);
        if (!contentHtml) {
            return;
        }

        const line = doc.createElement("p");
        line.innerHTML =
            `<span class="footnote-num">[${number}]</span>` +
            `<span class="footnote-txt">${contentHtml}</span>`;
        container.appendChild(line);
    });
}

function shouldSkipReferenceNode(node: Text): boolean {
    let current: Node | null = node.parentNode;
    while (current && current.nodeType === 1) {
        const tagName = (current as HTMLElement).tagName;
        if (["A", "CODE", "PRE", "SUP", "SCRIPT", "STYLE"].includes(tagName)) {
            return true;
        }
        if (tagName === "SECTION" && (current as HTMLElement).id === "footnotes") {
            return true;
        }
        current = current.parentNode;
    }
    return false;
}

function getExistingFootnoteCount(element: HTMLElement): number {
    const container = element.querySelector<HTMLElement>("#footnotes");
    if (!container) {
        return 0;
    }

    return container.querySelectorAll<HTMLElement>(".footnote-num").length;
}

function renderParagraphStyleFootnotes(footnotes: Array<[number, string, string]>): string {
    const items = footnotes.map(([index, title, href]) => {
        if (title === href) {
            return `<p><span class="footnote-num">[${index}]</span><span class="footnote-txt"><i>${title}</i></span></p>`;
        }
        return `<p><span class="footnote-num">[${index}]</span><span class="footnote-txt">${title}: <i>${href}</i></span></p>`;
    });

    return `<h3>引用链接</h3><section id="footnotes">${items.join("")}</section>`;
}

function renderListStyleFootnotes(footnotes: Array<[number, string, string]>): string {
    const items = footnotes.map(([index, title, href]) => {
        if (title === href) {
            return `<li id="footnote-${index}">[${index}]: <i>${title}</i></li>`;
        }
        return `<li id="footnote-${index}">[${index}] ${title}: <i>${href}</i></li>`;
    });

    return `<h3>引用链接</h3><div id="footnotes"><ul>${items.join("")}</ul></div>`;
}
