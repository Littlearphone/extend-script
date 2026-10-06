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

- **`src/views/`** — 每个目标网站一个视图组件。包含该网站的 DOM 操作逻辑、配置注入、自动点击等黑客脚本。核心视图如 `BilibiliVideo.vue`（最复杂，含视频倍速、网页全屏、自动续播、直播设置、B 站视频下载入口等）。
- **`src/components/`** — 可复用的配置面板 UI 组件：`Settings.vue`（可拖拽浮动面板容器）、`Switch.vue`、`Slider.vue`、`Upload.vue`、`Number.vue`、`VideoDownloadDialog.vue`（B 站下载列表弹窗）。
- **`src/utils/`** — 工具函数：`draggable.js`（`DraggableElement` 类 + 全局窗口 resize 自适应）、`bilibili.js`（B 站视频列表与 DASH 取流）、`bilibili-download.js`（File System Access 落盘与降级下载）、`logger.js`（彩色 console 日志）、`index.js`（DOM 样式/class 操作）、`loading.js`、`pagination.js`。
- **`src/styles/index.scss`** — 全局样式（滚动条、loading 动画）。
- **`src/mappings/index.js`** — URL → 视图组件映射表，也是新站点接入的注册点。

### B 站视频下载

浮动面板里的「视频下载」按钮（仅 `www.bilibili.com`）打开 `VideoDownloadDialog.vue`：列出当前页的**完整视频**（单个 / 多 P / 合集，以及番剧的整季），每行可改文件名前缀、可单独下载，也可勾选后一键批量。

- **取流**：先请求 `/x/player/wbi/playurl`（普通视频，`qn=120&fnval=4048`）或 `/pgc/player/web/v2/playurl`（番剧），拿不到再退回 `window.__playinfo__`。请求一律用 `unsafeWindow.fetch`，靠页面世界的 cookie 与 Referer。
- **落盘**：优先 File System Access（`unsafeWindow.showDirectoryPicker`，边下边写、不整份占内存），不支持时降级为 blob + `<a download>`。目录句柄只在当页复用，刷新后要重新授权。
- **命名**：每个视频一个子目录，里面 `<前缀>_1.m4s`（视频轨）+ `<前缀>_2.m4s`（音频轨）。这是给 `chaos` 仓库的 oho（`mix` 能力）准备的：它按"同目录 + 同词干（去掉 `_\d+`）+ 轨道互补"配对，**子目录是必须的**——它的候选文件最多只看 10 个，同前缀平铺会从第 6 集起配不上对。合并后的产物是 `<前缀>/<前缀>.mp4`。

### 构建机制 (vite.config.js)

- Vite `lib` 模式，格式 UMD，入口 `src/main.js`。
- 自定义 rollup plugin `pack-css`（enforce: 'post'）：将编译出的 CSS 内联为 JS 自执行函数（`insertCommonStyle()`），并在文件头部注入 Tampermonkey `==UserScript==` 元数据块（`@name`、`@include`、`@grant` 等）。版本号由当前日期自动生成：`YYYY.MM.(当月已过秒数)`。
- `@include` 列表与 `MAPPINGS` 中的 URL 模式需保持一致（目前手动维护）。

### 开发时的 API 降级

Tampermonkey 的 `GM_setValue`/`GM_getValue` 在本地开发时不可用。`public/tampermonkey-functions.js` 提供基于 `sessionStorage` 的降级实现。构建产物中通过 `@require` 引入真正的 GM API。

### 其他文件

- **`ohohoho.js`** — 独立的 Tampermonkey 脚本（另一个项目），不参与 Vite 构建，**有意不入库**。
- **`_archive/`** — 归档的旧脚本（Tasker Android 自动化、小说爬虫等），已废弃。
- **`publish.js`** — 构建后将 `docs/nihility.umd.user.js` 复制到本地 nginx 静态目录（另有远端 SFTP 的用法），**按机器环境走的脚本，有意不入库**。
- **`tests/`** — 本机用的 Playwright 验证工具与参考截图，**不入库**。

### 版本控制口径

`.gitignore` 是**默认入库、点名忽略**（不要改回 `*` + `!目录/` 的白名单写法：那样只放行目录本身，新文件会被静默忽略——`DouyinVideo.vue`、`DouyuFollow.vue`、`tests/`、`publish.js` 就这么漏了好一阵）。

- `src/`、`public/`、`pnpm-workspace.yaml` 全部入库；
- `docs/` 是 GitHub Pages 发布目录，只跟踪构建产物本体 `docs/nihility.umd.user.js`（`public/` 被 vite 拷进来的副本不跟踪）；
- 忽略：`node_modules/`、`.idea/`、`tests/`、`publish.js`、`ohohoho.js`；
- 远端仓库是**公开**的（`littlearphone.github.io/extend-script`），往里加文件前先想一下它会不会被公开。

## Key Patterns

- `logger.debug/info/warn/error` 支持回调函数作为第二个参数，用于延迟执行昂贵的调试操作（如 `console.trace`）。
- Vue 组件使用 `<script setup lang="ts">` + SCSS。
- 各视图组件通过 `GM_getValue`/`GM_setValue` 持久化用户配置。
- 拖拽组件使用 Pointer Events API，挂载时需调用 `addGlobalDraggableElement()` 注册以支持窗口 resize 自适应。
- 目标网站 body 会被设置 `[hostname]` 属性（如 `www-bilibili-com`），CSS 选择器通过 `html:has([www-bilibili-com])` 限定样式作用域。
- `[data-id="nihility-entry"]` 的 `position: fixed` 和 `z-index` 必须用 JS 内联设置（`main.js` 中 `Object.assign(nihilityEntry.style, ...)`），因为该 div 由原生 DOM 创建，Vue 组件内的 CSS 选择器无法可靠匹配。

## Testing

### 构建后注入测试

`tests/verify.js` — 基于 Playwright 的交互式验证工具。

```bash
pnpm build                                    # 先构建
node tests/verify.js                          # 启动本地 Edge，注入脚本
```

**工作方式**：
1. 启动本地 Edge（最大化窗口，`viewport: null` 跟随屏幕）
2. 通过 `addInitScript` 注入：jQuery → GM polyfills → 构建产物
3. 用户在浏览器中手动导航到目标站点
4. `framenavigated` 事件捕获 URL 变化，匹配 `@include` 规则后自动验证 DOM 注入并截图

**GM Polyfills** (`tests/gm-polyfills.js`)：用 sessionStorage 模拟 `GM_setValue`/`GM_getValue`，fetch 模拟 `GM_xmlhttpRequest`，直接操作 DOM 模拟 `GM_addStyle`。

**注意事项**：
- `viewport` 必须设为 `null` + `--start-maximized`，否则固定 1440×900 会与屏幕实际缩放不一致，导致按钮定位偏移
- `page.on('framenavigated')` 能捕获 SPA 的 `pushState` 导航，轮询 `page.url()` 不行