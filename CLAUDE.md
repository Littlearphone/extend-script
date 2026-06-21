# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

这是一个 **Tampermonkey 用户脚本** 项目，使用 Vue 3 + Vite 构建。编译后生成单个 UMD 文件 (`docs/nihility.umd.user.js`)，通过 Tampermonkey/Violentmonkey 注入到多个目标网站（B站、CSDN、知乎、百度、Google 等），实现页面增强、广告清理、自动操作等功能。

## Commands

```bash
# 开发模式（端口 4567，localhost 自动加载 BilibiliVideo 模块用于调试）
pnpm dev

# 构建用户脚本（输出到 docs/nihility.umd.user.js）
pnpm build

# 预览构建结果
pnpm serve

# 构建后复制到本地 nginx 目录
node publish.js
```

## Architecture

### 入口与模块加载

`src/main.js` 是入口。启动时用 `src/mappings/index.js` 中的 `MAPPINGS` 对象将当前 URL 匹配到对应的 Vue 视图组件（key 是 URL 正则字符串，value 是 `.vue` 组件）。匹配到的组件通过 `createApp().mount()` 挂载到动态插入的 `[data-id="nihility-entry"]` div 上。

### 目录结构

- **`src/views/`** — 每个目标网站一个视图组件。包含该网站的 DOM 操作逻辑、配置注入、自动点击等黑客脚本。核心视图如 `BilibiliVideo.vue`（最复杂，含视频倍速、网页全屏、自动续播、直播设置等）。
- **`src/components/`** — 可复用的配置面板 UI 组件：`Settings.vue`（可拖拽浮动面板容器）、`Switch.vue`、`Slider.vue`、`Upload.vue`、`Number.vue`。
- **`src/utils/`** — 工具函数：`draggable.js`（`DraggableElement` 类 + 全局窗口 resize 自适应）、`logger.js`（彩色 console 日志）、`index.js`（DOM 样式/class 操作）、`loading.js`、`pagination.js`。
- **`src/styles/index.scss`** — 全局样式（滚动条、loading 动画）。
- **`src/mappings/index.js`** — URL → 视图组件映射表，也是新站点接入的注册点。

### 构建机制 (vite.config.js)

- Vite `lib` 模式，格式 UMD，入口 `src/main.js`。
- 自定义 rollup plugin `pack-css`（enforce: 'post'）：将编译出的 CSS 内联为 JS 自执行函数（`insertCommonStyle()`），并在文件头部注入 Tampermonkey `==UserScript==` 元数据块（`@name`、`@include`、`@grant` 等）。版本号由当前日期自动生成：`YYYY.MM.(当月已过秒数)`。
- `@include` 列表与 `MAPPINGS` 中的 URL 模式需保持一致（目前手动维护）。

### 开发时的 API 降级

Tampermonkey 的 `GM_setValue`/`GM_getValue` 在本地开发时不可用。`public/tampermonkey-functions.js` 提供基于 `sessionStorage` 的降级实现。构建产物中通过 `@require` 引入真正的 GM API。

### 其他文件

- **`ohohoho.js`** — 独立的 Tampermonkey 脚本（另一个项目），不参与 Vite 构建。
- **`_archive/`** — 归档的旧脚本（Tasker Android 自动化、小说爬虫等），已废弃。
- **`publish.js`** — 构建后将 `docs/nihility.umd.user.js` 复制到本地 nginx 静态目录，用于 GitHub Pages 发布。

## Key Patterns

- `logger.debug/info/warn/error` 支持回调函数作为第二个参数，用于延迟执行昂贵的调试操作（如 `console.trace`）。
- Vue 组件使用 `<script setup lang="ts">` + SCSS。
- 各视图组件通过 `GM_getValue`/`GM_setValue` 持久化用户配置。
- 拖拽组件使用 Pointer Events API，挂载时需调用 `addGlobalDraggableElement()` 注册以支持窗口 resize 自适应。
- 目标网站 body 会被设置 `[hostname]` 属性（如 `www-bilibili-com`），CSS 选择器通过 `html:has([www-bilibili-com])` 限定样式作用域。