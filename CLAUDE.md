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

# 改一下保存就自动重建（配合油猴的 Track from disk）
pnpm watch

# 预览构建结果
pnpm serve

# 发布：构建 → 同步本机 nginx → 提交产物 → 推送（稳定了才跑）
pnpm ship

# 只把产物拷到本地 nginx（不带 git 那一段）
node publish.js
```

### 脚本怎么到油猴手里（别再手工复制粘贴）

**日常调试**：油猴的「File → Track from disk」（Chromium 系，5.5.0+；Firefox 不支持）直接盯磁盘上的产物，不需要任何服务器、也不需要第二条 URL：

1. `pnpm watch`（或改完手动 `pnpm build`）；
2. 油猴面板 → 「File」→「Track from disk」→ 选 `docs/nihility.umd.user.js`，装一次；
3. 之后文件一变它就跟着变。**已知限制：只有那个脚本的编辑器窗口开着时才跟踪**（维护者在 [gh:2794](https://github.com/Tampermonkey/tampermonkey/issues/2794) 确认），所以那个窗口留着。

**发布**：`pnpm ship` = 构建 → 同步本机 nginx → 提交产物 → 推送。推上去后 GitHub Pages 重新发布，油猴按脚本头部的 `@updateURL`（Pages 地址）自动拉新版本。

`@updateURL` 用 `file://` **不行**（油猴的更新检查不走 file://，见 [gh:977](https://github.com/Tampermonkey/tampermonkey/issues/977)）；`@require file://` 虽然可以（[FAQ Q402](https://www.tampermonkey.net/faq.php?q=Q402)），但要手动同步头部、且会让 `@run-at document-start` 变得不可靠——本脚本依赖 document-start，所以不走那条。

版本号 `年.月索引.月内秒.毫秒` 在**每次产出时**算（`vite.config.js` 的 `buildVersion`）：写在配置顶层的话 `--watch` 模式下每轮重建版本号都一样。

## Architecture

### 入口与模块加载

`src/main.js` 是入口。启动时用 `src/mappings/index.js` 中的 `MAPPINGS` 对象将当前 URL 匹配到对应的 Vue 视图组件（key 是 URL 正则字符串，value 是 `.vue` 组件）。匹配到的组件通过 `createApp().mount()` 挂载到动态插入的 `[data-id="nihility-entry"]` div 上。

### 目录结构

- **`src/views/`** — 每个目标网站一个视图组件。包含该网站的 DOM 操作逻辑、配置注入、自动点击等黑客脚本。核心视图如 `BilibiliVideo.vue`（最复杂，含视频倍速、网页全屏、自动续播、直播设置、B 站视频下载入口等）。
- **`src/components/`** — 可复用的配置面板 UI 组件：`Settings.vue`（可拖拽浮动面板容器）、`SettingsContent.vue`（**面板内容的唯一一份实现**，浮动面板与 `SettingsDialog.vue` 共用）、`SettingsDialog.vue`（居中的通用小弹窗：标题 + slot，Esc/点外面关闭）、`Switch.vue`、`Slider.vue`、`Upload.vue`、`Number.vue`、`VideoDownloadDialog.vue`（B 站下载列表弹窗）。
- **`src/utils/`** — 工具函数：`draggable.js`（`DraggableElement` 类 + 全局窗口 resize 自适应）、`bilibili.js`（B 站视频列表与 DASH 取流）、`bilibili-download.js`（File System Access 落盘与降级下载）、`logger.js`（彩色 console 日志）、`index.js`（DOM 样式/class 操作）、`loading.js`、`pagination.js`。
- **`src/styles/index.scss`** — 全局样式（滚动条、loading 动画）。
- **`src/mappings/index.js`** — URL → 视图组件映射表，也是新站点接入的注册点。

### B 站视频下载

两个入口打开 `VideoDownloadDialog.vue`：浮动面板里的「视频下载」按钮（仅 `www.bilibili.com`）与油猴面板菜单里的「视频下载」（见「面板菜单」一节）。它列出当前页的**完整视频**（单个 / 多 P / 合集，以及番剧的整季），每行可改文件名前缀、可单独下载，也可勾选后一键批量。列序固定为 `☑ / # / 文件名前缀 / 标题 / 状态 / 时长 / 操作`，状态列带进度条。

- **全屏时只有菜单能用**：本脚本自己会开网页全屏，那时浮动按钮是藏起来的。所以 `BilibiliVideo.vue` 的全屏 CSS **只藏按钮和面板，绝不能把整个 `[data-id=nihility-entry]` 一起 `display:none`**——否则菜单点了弹窗也不显示。
- **取流**：先请求 `/x/player/wbi/playurl`（普通视频，`qn=120&fnval=4048`）或 `/pgc/player/web/v2/playurl`（番剧），拿不到再退回 `window.__playinfo__`。请求一律用 `unsafeWindow.fetch`，靠页面世界的 cookie 与 Referer。
- **落盘**：优先 File System Access（`unsafeWindow.showDirectoryPicker`，边下边写、不整份占内存），不支持时降级为 blob + `<a download>`。目录句柄只在当页复用，刷新后要重新授权。
- **轨内并行、跨视频串行**：一个视频的**视频轨与音频轨并行下**（音频小一个量级，串行的话那段就是纯白等；进度条按合计字节走）；**多个视频仍是一个接一个**——批量并发会把同一站点的 HTTP 连接占满，后面的请求排队甚至被 CDN 拒。跨轨并行意味着任何时刻至少有 2 个在途请求，这是刻意的。
- **分片并发（可选，默认不分片）**：工具栏「并发」= 不分片 / 2 / 4，记在 `bilibili-download-concurrency`；它只管**单个文件内部**切不切 4MB 的段（轨间并行不受它影响）。选了分片就把文件切开、**摊到不同镜像 host**（`base_url` + `backup_url[]` 本来就是同一份文件的镜像，同 host 去重），**每个 host 最多 2 条**，实际并发 = `min(所选, 2 × 镜像数)`；分片请求带 `priority: 'low'`。为什么保守：跨域资源**读不到协议**（`nextHopProtocol` 无 `Timing-Allow-Origin` 时返回空串，B 站 CDN 实测没这个头），分不清对面是 h1.1（每 host 6 条，还要和正在播放的播放器抢）还是 h2/h3（一条连接多路复用）。所以**任何一片不是 206（403/416/200/超时）就整体退回不分片**重下（`writeStreamChunked` → `writeStreamSerial`）。分片写盘用 FSA 的**按偏移随机写**（`write({type:'write', position, data})`），不用在内存里按序拼装、也不用落临时分片；收尾 `truncate(total)`。
- **清晰度**：列表上方的下拉（`bilibili-download-quality` 持久化，默认「最高」）。请求一律 `qn=120` —— 拿的是"这个账号能给的最全一档"，响应里的 `dash.video[]` 是**整个阶梯**，所以选档位是**本地挑，零额外请求**。挑法＝"不高于所选、该集自己能给的最高档"（这条规则端口自扩展 `爱哔哔`，见 `pickVideoStream`）。因此**这是偏好不是保证**：某集没有 4K 会自动降级，状态列写「完成 · 1080P（此集没有 1080P60）」；列表里**看不出**哪集会退档——那要逐条解析（扩展同样如此，它也是点下载那一刻才解析那一集）。
- **命名**：规则只有一条 —— **页面上显示的是哪个字段就取哪个字段**，标题列与前缀列同源：
  - 单 P → `videoData.title`（**不是** `pages[].part`：那个常是投稿工具生成的编号，如 `studio_video_1791036734034`）；
  - 多 P → `pages[].part`；合集 → `episode.title`（依次 `long_title`、`arc.title`）；番剧 → `long_title` 那串。
  - 只有"页面上那个字段本身就是机器编号"时才兜底（`isPlaceholderName`，见 `bilibili.js`），兜底结果**必带 `item.nameAuto` 标记**，弹窗里以 ⚠ 显示（tooltip 说明原因）——**猜错了要让人看得见，不许静默给个错名字**。
  - 已知的脆弱点（整个下载功能都吃这套没文档的页面字段）：`__INITIAL_STATE__` / `pages[].part` / `ugc_season` / `__playinfo__` / 两个 playurl。B 站改结构时**不能悄悄给错结果**：字段整个没了会走 `collectVideoItems` 的可读报错（"拿不到这个页面的视频信息…"），只是改名/变形状则靠兜底 + ⚠ 暴露，用户随时能在前缀列改。
  - 弹窗里给用户看的合并入口是 **<https://littlearphone.github.io/ffmpeg-merge/>**（`MERGE_PAGE`，新开标签页）。**站内 UI 不提 oho**——那是我们自己的内部工具名，用户看到的是这个网页；下面那些 oho 的说法只属于代码注释/文档里的实现理由。
- **落盘**：两个文件**平铺**进用户选的目录：`<前缀>_1.m4s`（视频轨）+ `<前缀>_2.m4s`（音频轨），**不套子目录**。这是给 `chaos` 仓库的 oho（`mix` 能力）准备的：它按"同目录 + 同词干（去掉 `_\d+`）+ 轨道互补"配对；合并后的产物是同目录的 `<前缀>.mp4`。
- **`.m4s` 是"完成时才叫的名字"**（这条是和 oho 的时序契约，别改回去）：下载中写成 `<前缀>_1.part`，**这一对轨都下完才改名**（`publishDownloadedFile` → `FileSystemFileHandle.move`）。原因：`getFileHandle(name,{create:true})` 会立刻创建 0 字节的正式文件，而 oho 的自动任务按文件名正则扫目录（可能不锚定结尾），看到半截的 `.m4s` 就开跑，随后 `createWritable()` 的原子替换让那个名字短暂消失 → 报 "A requested file or directory could not be found at the time an operation was processed"。临时名**故意不含 `.m4s`/`.mp4`**（换成 `.part`），任何".m4s"正则都扫不到。落地顺序也有讲究：**音频先、视频后**——oho 只拿到音频轨时会"跳过并算成功"，只拿到视频轨会报"没找到配套的另一条轨"，所以中间态要留在"只有音频"那侧。下载失败时把临时文件删掉（重试本来就从头下）。
  - 一个已知边界：oho 找配偶时只扫**前 10 个**"以该词干开头"的候选，而词干是**砍掉末尾数字/下划线**得到的。所以集名只差末尾数字（`第1集`/`第2集`/…）时，第 10 集往后可能配不上对；名字里带字母/汉字结尾（`第1集 开场`、`太 君 买 瓜`）就没事。真遇到那种命名，在前缀列给它们各加一个字，或分批下到不同目录。
- **进度、收起与列表缓存**：状态与**列表**都放在 `bilibili-download-state.js` 的模块级 reactive（不是组件私有 ref）。列表放模块级是因为"关掉弹窗＝卸载组件"——不复用的话用户改过的前缀、勾选、上一轮进度全丢。现在只有**页面换了**（`pageKey` = pathname+search，bilibili 是 SPA）或点工具栏「刷新列表」才重读，且**下载中拒绝重读**（会把在跑的行换掉）。对用户来说「关闭」和「收起」是同一件事（把窗口弄走、别打断下载）：头部的 `×` / Esc / 点外面**一律只是收起**，要彻底结束会话才用空闲时那个「关掉」（下载中不显示，因为卸载组件＝循环没人管了）。

### 构建机制 (vite.config.js)

- Vite `lib` 模式，格式 UMD，入口 `src/main.js`。
- 自定义 rollup plugin `pack-css`（enforce: 'post'）：将编译出的 CSS 内联为 JS 自执行函数（`insertCommonStyle()`），并在文件头部注入 Tampermonkey `==UserScript==` 元数据块（`@name`、`@include`、`@grant` 等）。版本号由当前日期自动生成：`YYYY.MM.(当月已过秒数)`。
- `@include` 列表与 `MAPPINGS` 中的 URL 模式需保持一致（目前手动维护）。

### 开发时的 API 降级

Tampermonkey 的 `GM_setValue`/`GM_getValue` 在本地开发时不可用。`public/tampermonkey-functions.js` 提供基于 `sessionStorage` 的降级实现。构建产物中通过 `@require` 引入真正的 GM API。

### 其他文件

- **`ohohoho.js`** — 独立的 Tampermonkey 脚本（另一个项目），不参与 Vite 构建，**有意不入库**。
- **`_archive/`** — 归档的旧脚本（Tasker Android 自动化、小说爬虫等），已废弃。
- **`ship.mjs`** — `pnpm ship` 的实现：构建 → （本机存在 nginx 目录就）同步产物 → 提交产物 → 推送。里面的 nginx 路径是本机的，换台机器只是"少同步一步"，其余流程照跑，所以**入库**。它还会在 `src/` 有未提交改动时提醒一句——那种情况下产物和源码对不上。
- **`publish.js`** — 只把 `docs/nihility.umd.user.js` 复制到本地 nginx 静态目录（另有远端 SFTP 的用法），**按机器环境走的脚本，有意不入库**。
- **`tests/`** — 本机用的 Playwright 验证工具与参考截图，**不入库**。

### 面板菜单（`GM_registerMenuCommand`）

点油猴图标弹出的那个面板里显示什么，取决于**当前标签页里活跃脚本注册了什么** —— 所以"按页面注册不同条目"是天然支持的。

**能力边界决定了怎么用**：菜单项只能是"一行文本 + 一个回调"，没有子菜单、勾选框、输入框、滑块。所以这里的定位是**菜单负责把框叫出来、框里放控件**：

- 「视频下载」→ 下载列表弹窗（表格/输入框本来就只能在 DOM 里）；
- 「脚本设置」→ 与浮动面板**同一套控件**（`SettingsContent.vue`），全屏/真全屏时浮动按钮够不着就靠它。

实现要点：

- `src/utils/script-menu.js` 是唯一入口（`setMenuCommand(key, name, handler, options)`）：同一个 key 再调一次走 `id` 更新，不会越挂越多条；本地开发/Playwright 没有这个 API 时安静跳过。
- 注册在 `BilibiliVideo.vue`：只在**顶层窗口**且路径匹配 `/video/`、`/bangumi/play/` 时注册，带 `accessKey`（`d`/`s`）；下载中把「视频下载」的文案改成「视频下载（下载中 2/5）」当进度用。
- 回调会先 `exitFullscreen()`：**真·全屏**（Fullscreen API）时浏览器只把全屏元素画在最上层，我们的浮层在它底下，不退出来就是"点了没反应"；**网页全屏**（纯 CSS）不受影响。
- 两个坑：**SPA 跳转（bilibili 的 pushState）不会重跑脚本**，条目不会自己跟着 URL 变 —— 所以 `mounted()` 里会重新注册一次（那个函数本来就被 pushState 劫持调用）；**iframe 会各注册一份**，同名条目虽会合并，但回调默认在每个注册过的 frame 都跑 —— 所以只在 `window.top === window` 时注册，并带 `clickedFrame: true`。
- `@grant` 里加了 `GM_registerMenuCommand` / `GM.registerMenuCommand`：**更新已安装的脚本时油猴会多要一次权限确认**。

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