# Wenyan WeChat Theme Specification

本文档用于指导在 `wenyan-core` 中创作新的微信文章主题（WeChat article theme）。

目标（Goal）：
- 让新主题在渲染链路中稳定生效（stable rendering）
- 保持与现有主题一致的结构兼容性（compatibility）
- 提供从设计到落地的完整规范（end-to-end spec）

---

## 1. 主题系统架构（Architecture）

主题能力分为两层：

1. 内置主题（Built-in Theme）
- 元信息注册：`src/core/theme/themeRegistry.ts`
- CSS 资产目录：`src/assets/themes/*.css`
- 在 `registerAllBuiltInThemes()` 中自动注册

2. 自定义主题（Custom Theme）
- 运行时管理：`src/node/theme.ts`
- 本地持久化：`src/node/configStore.ts`
- 通过 MCP 工具 `register_theme` / `remove_theme` 动态增删

渲染入口：`src/node/render.ts` -> `src/core/index.ts`。

---

## 2. 现有主题清单（Current Theme Catalog）

微信公众号内置主题（GZH Built-ins）：
- `default`
- `orangeheart`
- `rainbow`
- `lapis`
- `pie`
- `maize`
- `purple`
- `phycat`

其他平台主题（Non-GZH built-ins）：
- `juejin_default`
- `medium_default`
- `toutiao_default`
- `zhihu_default`

说明：新建“微信文章主题”优先对齐 GZH 主题风格与选择器覆盖范围。

---

## 3. 渲染链路约束（Rendering Constraints）

### 3.1 应用顺序（Apply Order）

核心顺序（见 `createWenyanCore().applyStylesWithTheme`）：
1. 解析主题 CSS（内置或自定义）
2. 解析代码高亮 CSS（highlight theme）
3. 对主题 CSS 做默认修正（CSS modifier）
4. 应用主题 CSS 到 `#wenyan`
5. 处理伪元素（pseudo elements）
6. 应用代码高亮样式
7. 微信后处理（wechat post render）

### 3.2 默认 CSS 修正（Auto Override）

运行时会覆盖部分字体相关规则：
- `#wenyan` 的 `font-family`
- `#wenyan pre` 的 `font-size`
- `#wenyan pre code` / `#wenyan p code` / `#wenyan li code` 的 `font-family`

含义：
- 你可以写字体，但最终会被框架修正（normalized）
- 主题创作应把重点放在布局、层级、配色、间距与组件形态

### 3.3 微信后处理（WeChat Post-processing）

`wechatPostRender` 会做以下结构改写：
- 公式节点 `mjx-container` 会被替换为 `svg`
- `pre code` 内换行与空格会被转换为 `br` 与 `nbsp`
- 每个 `li` 的子节点会被包进一个 `section`

主题应兼容以下结构：
- 列表内容建议覆盖 `#wenyan li > section`
- 代码行高建议在 `pre` 层定义，不依赖纯文本换行行为

---

## 4. 选择器覆盖规范（Selector Coverage Spec）

基于全部内置主题整理，推荐将选择器分为三层。

### 4.1 必须覆盖（Required）

这些是所有内置主题几乎一致覆盖的核心元素：
- `#wenyan`
- `#wenyan p`
- `#wenyan h1` ~ `#wenyan h6`
- `#wenyan ul` / `#wenyan ol` / `#wenyan li`
- `#wenyan img`
- `#wenyan table` / `#wenyan table th` / `#wenyan table td`
- `#wenyan blockquote`
- `#wenyan p code`
- `#wenyan pre` / `#wenyan pre code`
- `#wenyan hr`
- `#wenyan a`

### 4.2 微信脚注必须覆盖（Required for footnotes）

脚注由渲染器注入，建议固定支持：
- `#wenyan .footnote`
- `#wenyan #footnotes p`
- `#wenyan .footnote-num`
- `#wenyan .footnote-txt`

### 4.3 推荐覆盖（Recommended）

提高可读性与层次细节：
- `#wenyan strong` / `#wenyan em` / `#wenyan del`
- 嵌套列表：`#wenyan ul ul`, `#wenyan ol ol`
- 表格条纹：`#wenyan table tr:nth-child(even/odd)`
- 列表内行内代码：`#wenyan li code`

---

## 5. 伪元素规范（Pseudo Element Spec）

框架支持将部分 `::before` / `::after` 转换为真实节点。

### 5.1 支持范围（Supported Targets）

仅支持以下标签：
- `h1` ~ `h6`
- `blockquote`
- `pre`

不保证支持复杂目标：
- 类选择器伪元素，如 `.foo::before`
- 深层组合选择器上的伪元素

### 5.2 支持属性（Supported Properties）

- 常规样式会写入内联样式
- `content` 会写入插入节点文本
- `url(...)` 对以下格式有特殊处理：
  - `data:image/svg+xml;utf8,...`
  - `data:image/svg+xml;base64,...`
  - `http/https` 图片 URL

设计建议：
- 对伪元素内容尽量使用装饰性信息（decorative content）
- 避免承载语义关键信息（semantic-critical content）

---

## 6. 设计 Token 规范（Design Tokens）

建议每个主题在 `#wenyan` 上定义 token（CSS variables）：
- 文本色：`--text-color`
- 主色：`--primary-color`
- 次级主色：`--primary-weak`
- 背景色：`--bg-color`
- 边框色：`--border-color`
- 引用块背景：`--blockquote-bg`
- 行内代码前景/背景：`--inline-code-color` / `--inline-code-bg`

建议优先使用 token，而不是在大量规则中硬编码颜色。

---

## 7. 排版与可读性规范（Typography and Readability）

建议值（可按主题风格微调）：
- 正文 `line-height`: `1.7` ~ `1.85`
- 段落间距：`margin: 1em 0`
- 标题层级应明显区分 `h1/h2/h3`
- 行内代码必须具备背景对比（contrast）
- 表格必须具备边框与单元内边距
- 图片建议 `max-width: 100%` 并保持圆角或边框策略一致

可访问性建议（Accessibility）：
- 正文与背景对比度尽量 >= WCAG AA
- 链接颜色与普通文本需可辨识，避免仅靠下划线

---

## 8. 新主题开发流程（Authoring Workflow）

### 8.1 方案 A：运行时注册（推荐）

适合快速试验（rapid iteration）：
1. 本地准备 `*.css`
2. 调用 `register_theme(name, path)`
3. 调用 `list_themes` 确认
4. 用 `publish_article(theme_id=name)` 验证
5. 反复迭代

优点：无需改源码，无需发版。

### 8.2 方案 B：内置主题入库

适合长期维护（long-term maintenance）：
1. 在 `src/assets/themes/` 新增 `{id}.css`
2. 在 `themeRegistry.ts` 的 GZH 元信息数组中新增对应 meta
3. 构建并验证
4. 提交到仓库

要求：`id` 必须与 CSS 文件名严格一致。

---

## 9. 验收清单（Acceptance Checklist）

发布前建议逐项检查：

- 结构
  - 是否全部以 `#wenyan` 为作用域前缀
  - 是否覆盖“必须覆盖”选择器

- 视觉
  - 标题层级是否清晰
  - 引用、代码、表格是否可读
  - 图片与分隔线是否风格一致

- 兼容
  - 脚注样式是否可用
  - 列表在 `li > section` 结构下是否正常
  - 伪元素在目标标签上是否符合预期

- 质量
  - 无明显样式冲突（style collision）
  - 无不可读文本或溢出

---

## 10. 主题骨架模板（Starter Template）

```css
#wenyan {
  --text-color: #2a2a2a;
  --primary-color: #1769aa;
  --primary-weak: #e8f2fb;
  --bg-color: #ffffff;
  --border-color: #dfe5ec;
  --blockquote-bg: #f6f9fc;
  --inline-code-color: #0f5d9c;
  --inline-code-bg: #eef6fd;

  color: var(--text-color);
  line-height: 1.75;
}

#wenyan p { margin: 1em 0; }
#wenyan h1, #wenyan h2, #wenyan h3, #wenyan h4, #wenyan h5, #wenyan h6 { color: var(--primary-color); }
#wenyan ul, #wenyan ol { padding-left: 1.2em; }
#wenyan li { margin: 0.25em 0; }
#wenyan li > section { display: block; }

#wenyan a { color: var(--primary-color); text-decoration: underline; }
#wenyan blockquote {
  margin: 1.2em 0;
  padding: 0.6em 1em;
  border-left: 3px solid var(--primary-color);
  background: var(--blockquote-bg);
}

#wenyan p code, #wenyan li code {
  color: var(--inline-code-color);
  background: var(--inline-code-bg);
  padding: 0 0.25em;
  border-radius: 4px;
}

#wenyan pre {
  margin: 1em 0;
  padding: 0.8em;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow-x: auto;
}
#wenyan pre code { background: transparent; }

#wenyan img {
  max-width: 100%;
  border-radius: 6px;
}

#wenyan table {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
}
#wenyan table th,
#wenyan table td {
  border: 1px solid var(--border-color);
  padding: 8px 10px;
}

#wenyan .footnote { color: var(--primary-color); }
#wenyan #footnotes p { margin: 0.3em 0; }
#wenyan .footnote-num { margin-right: 0.25em; }
#wenyan .footnote-txt { color: var(--text-color); }
```

---

## 11. 常见问题（FAQ）

1. 为什么我设置的字体没有生效？
- 框架会对部分字体规则进行统一修正，这是预期行为。

2. 为什么伪元素不显示？
- 请确认目标是 `h1~h6` / `blockquote` / `pre`，并使用 `::before` 或 `::after`。

3. 为什么列表样式在微信里变了？
- 微信后处理会把 `li` 的内容包成 `section`，请同时考虑 `li` 与 `li > section`。

4. 为什么主题能注册但发布后效果不对？
- 先检查选择器是否都挂在 `#wenyan` 作用域下，再检查脚注与代码块覆盖是否完整。
