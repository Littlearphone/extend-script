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

两个入口打开 `VideoDownloadDialog.vue`：浮动面板里的「视频下载」按钮（仅 `www.bilibili.com`）与油猴面板菜单里的「视频下载」（见「面板菜单」一节）。它列出当前页的**完整视频**（单个 / 多 P / 合集，以及番剧的整季），每行可改文件名前缀、可单独下载，也可勾选后一键批量。列序固定为 `☑ / # / 文件名前缀 / 状态 / 时长 / 操作`，状态列带进度条。**只有一列名字**：前缀本来就是从标题来的（前缀 = `safeFileName(标题)`），分成两列是同一份信息占两份宽度，把状态列挤到显示不下。标题留在前缀输入框的 `title`/`placeholder` 里（悬停可看全），只有用户手改过前缀时才在下面补一行 11px 的「原标题：…」。

- **全屏时只有菜单能用**：本脚本自己会开网页全屏，那时浮动按钮是藏起来的。所以 `BilibiliVideo.vue` 的全屏 CSS **只藏按钮和面板，绝不能把整个 `[data-id=nihility-entry]` 一起 `display:none`**——否则菜单点了弹窗也不显示。
- **取流**：先请求 `/x/player/wbi/playurl`（普通视频，`qn=120&fnval=4048`）或 `/pgc/player/web/v2/playurl`（番剧），拿不到再退回 `window.__playinfo__`。请求一律用 `unsafeWindow.fetch`，靠页面世界的 cookie 与 Referer。
- **落盘**：优先 File System Access（`unsafeWindow.showDirectoryPicker`，边下边写、不整份占内存），不支持时降级为 blob + `<a download>`。**目录句柄存进 IndexedDB**（`nihility-script` / `directories` / `download-dir`）：下次打开页面 `recallDirectory()` 捞回来，只弹一次「允许编辑文件」，用户选过"每次访问都允许"的话连这次都没有。顺序是 **本页缓存 → IndexedDB 里记住的 → 实在没有再弹选择器**。`pickDirectory()` 选完立刻存。否则每次下东西都要重走一遍"选目录 + 确认 + 授权"。**工具栏有个「目录：xxx」按钮**（`peekDirectoryInfo()` 只读地读 IndexedDB，不申请权限、不弹框），点它就重选并覆盖记住的那个——不然目录记死了用户既不知道下到哪、也没法改。下载中禁用。**磁盘根目录（`E:\`）的 `handle.name` 只有一个 `\`**（Chromium 的取法），而浏览器出于隐私**不暴露完整路径**，盘符拿不回来，所以这种名字统一显示成「磁盘根目录」（`applyDirectoryName`），别再挂个反斜杠在界面上。**权限状态只有三态**（`granted` / `denied` / `prompt`），`peekDirectoryInfo()` 用 `queryPermission` 只读地查一次，按钮的 `title` 把此刻状态写出来（已授权 / 会再确认 / 被拒绝）——但**不要承诺"长期有效"**：`granted` 能维持多久是浏览器自己的策略（弹框里的"每次访问都允许"只是它记多久的选项），API 里根本没有这个信息。**不要按"下了几个视频"决定走不走目录**：一次下载永远是两条轨两个文件，走浏览器默认下载反而多弹一次"允许下载多个文件"，确认次数只多不少（这条踩过）。走浏览器下载时 `readAllToBlob` 会**每 16MB 封一个 Blob 再丢引用**（Chromium 把 Blob 落到磁盘），否则一条 4K 轨几百 MB 会整份压在 JS 堆里。
- **轨内并行、跨视频串行**：一个视频的**视频轨与音频轨并行下**（音频小一个量级，串行的话那段就是纯白等；进度条按合计字节走）；**多个视频仍是一个接一个**——批量并发会把同一站点的 HTTP 连接占满，后面的请求排队甚至被 CDN 拒。跨轨并行意味着任何时刻至少有 2 个在途请求，这是刻意的。
- **分片并发（可选，默认不分片）**：工具栏「并发」= 不分片 / 2 / 4 / 5 / 8，记在 `bilibili-download-concurrency`；它只管**单个文件内部**切不切 4MB 的段（轨间并行不受它影响）。选了分片就把文件切开、**摊到不同镜像 host**（`base_url` + `backup_url[]` 本来就是同一份文件的镜像，同 host 去重），**每个 host 开几条看它是不是播放器正在用的那个**：和播放器同 host 只开 2 条，不同 host 放开到 5 条（6 条里留 1 条给播放和页面请求）。"播放器的 host"（`playingStreamHosts()`）**只取 `__playinfo__` 里清晰度阶梯的第一条视频 + 第一条音频，且不认 `backup_url`**——`dash.video[]` 是整个阶梯（4K 十档）、每档都带一堆 backup，全收进来就有几十个 host，而下载地址本来就取自同一批镜像，于是"下载 host 是不是播放器 host"几乎永远命中，并发被永久压在 2 条。名额是**按 host 的全局信号量**（`acquireSlot` / `releaseSlot`，表是全局的、但按 host 分桶，不同集的 CDN 各算各的），**视频轨、音频轨、所有分片、退回整段的那条流共用同一份名额**——不能按"每个文件算一个上限"：两条轨是并行的，DASH 的 video/audio 各自一套镜像，地址甚至不在同一个 host 上，各算各的就会出现同一个 host 上 5+5=10 条。抄不到 `__playinfo__` 时按保守的 2 算（不敢假设"不是同一个池"）；名额在**读到流结尾**后才归还，不是请求一返回就还。**不要给分片请求加 `priority: 'low'`**：实测低优先级会让我们的流被压在后面（同一个视频 IDM 能到近百 MB/s，我们 4 条连接只有一百多 KB/s）；保播放器是靠 host 名额，不靠请求优先级。每个文件下完会打一条吞吐日志（`logThroughput`：大小/耗时/平均速度/连接数），出"明明 4 连接却只有一百多 K"时先看它。另外每块读有 15s 空闲超时（`readWithTimeout`）——有些节点会把连接吊住（TCP 通但几乎不吐数据），超时按失败处理、换镜像重试。**镜像要按实测速度挑，不能轮询**（真机实测同一视频 4 并发：快节点 20.3MB/s、慢节点 1.5MB/s，差 7 倍；慢节点加压也几乎不涨，所以"多开连接"不如"别用慢节点"）：`recordHostRate` 记每个 host 的 bytes/ms（指数衰减），`chooseMirror` 按速度**平方**加权随机（慢节点份额降到千分之几但仍有 5% 探测），并且**每个 host 只探一次**（`sampledHosts` 在派发时就标记）——踩过的坑：按"还没测出速度的 host"来派，慢节点要跑一秒多才出速度，这期间新派发会反复挑中它，一个慢镜像能吃掉 25% 的分片。为什么保守：跨域资源**读不到协议**（`nextHopProtocol` 无 `Timing-Allow-Origin` 时返回空串，B 站 CDN 实测没这个头），分不清对面是 h1.1（每 host 6 条，还要和正在播放的播放器抢）还是 h2/h3（一条连接多路复用）。**某一片失败先换镜像重试**（几个 backup 就是同一份文件的镜像，一个节点抽风不该罚整个文件），重试预算是**固定的 `CHUNK_ATTEMPTS`（4 次），不是"镜像数"**——只有一个镜像时拿镜像数当预算等于不重试，一次 503 就会让整个文件退回整段重下。重试**不退计数、不重下**：每片记着"已经写到哪了"（`progressOfChunk`），下次从这个偏移继续要 Range（断点续传），所以进度条不会因为一次重试往回跳；服务端 206 但没给满（`offset <= end`）也算失败，否则文件里会留空洞。4 次都失败才把这一片交给**串行补齐**（`fillMissingSerially`：已写的分片一个不扔，只把缺的按序一条一条补），真正退回整段重下只在连串行都失败时才发生。**忽略 `Range` 直接回 200 的 host 会被记进 `rangeIgnoringHosts`**（本页有效），后面的文件连试都不试——这类 host 分不了片，再试一次就是"先下一段、再掉回 0"。分片写盘用 FSA 的**按偏移随机写**（`write({type:'write', position, data})`），不用在内存里按序拼装、也不用落临时分片；收尾 `truncate(total)`。弹窗里状态行末尾的「N 连接」来自 `connectionStats()`（按 host 汇总的全局在途数），用来判断并发到底有没有跑起来——设置里的档位不是实际并发。下载是**跨视频串行**的，所以全局数就等于当前那一行的数。
- **清晰度**：列表上方的下拉（`bilibili-download-quality` 持久化，默认「最高」）。请求一律 `qn=120` —— 拿的是"这个账号能给的最全一档"，响应里的 `dash.video[]` 是**整个阶梯**，所以选档位是**本地挑，零额外请求**。挑法＝"不高于所选、该集自己能给的最高档"（这条规则端口自扩展 `爱哔哔`，见 `pickVideoStream`）。因此**这是偏好不是保证**：某集没有 4K 会自动降级，状态列写「完成 · 1080P（此集没有 1080P60）」；列表里**看不出**哪集会退档——那要逐条解析（扩展同样如此，它也是点下载那一刻才解析那一集）。
- **命名**：规则只有一条 —— **页面上显示的是哪个字段就取哪个字段**，文件名前缀 = 那个字段（仅把文件名非法字符换成 `_`）：
  - 单 P → `videoData.title`（**不是** `pages[].part`：那个常是投稿工具生成的编号，如 `studio_video_1791036734034`）；
  - 多 P → `pages[].part`；合集 → `episode.title`（依次 `long_title`、`arc.title`）；番剧 → `long_title` 那串。
  - 只有"页面上那个字段本身就是机器编号"时才兜底（`isPlaceholderName`，见 `bilibili.js`），兜底结果**必带 `item.nameAuto` 标记**，弹窗里以 ⚠ 显示（tooltip 说明原因）——**猜错了要让人看得见，不许静默给个错名字**。
  - 已知的脆弱点（整个下载功能都吃这套没文档的页面字段）：`__INITIAL_STATE__` / `pages[].part` / `ugc_season` / `__playinfo__` / 两个 playurl。B 站改结构时**不能悄悄给错结果**：字段整个没了会走 `collectVideoItems` 的可读报错（"拿不到这个页面的视频信息…"），只是改名/变形状则靠兜底 + ⚠ 暴露，用户随时能在前缀列改。
  - 弹窗里给用户看的合并入口是 **<https://littlearphone.github.io/ffmpeg-merge/>**（`MERGE_PAGE`，新开标签页）。**站内 UI 不提 oho**——那是我们自己的内部工具名，用户看到的是这个网页；下面那些 oho 的说法只属于代码注释/文档里的实现理由。
- **落盘**：两个文件**平铺**进用户选的目录：`<前缀>_1.m4s`（视频轨）+ `<前缀>_2.m4s`（音频轨），**不套子目录**。这是给 `chaos` 仓库的 oho（`mix` 能力）准备的：它按"同目录 + 同词干（去掉 `_\d+`）+ 轨道互补"配对；合并后的产物是同目录的 `<前缀>.mp4`。
- **`.m4s` 是"完成时才叫的名字"**（这条是和 oho 的时序契约，别改回去）：下载中写成 `<前缀>_1.part`，**这一对轨都下完才改名**（`publishDownloadedFile` → `FileSystemFileHandle.move`）。原因：`getFileHandle(name,{create:true})` 会立刻创建 0 字节的正式文件，而 oho 的自动任务按文件名正则扫目录（可能不锚定结尾），看到半截的 `.m4s` 就开跑，随后 `createWritable()` 的原子替换让那个名字短暂消失 → 报 "A requested file or directory could not be found at the time an operation was processed"。临时名**故意不含 `.m4s`/`.mp4`**（换成 `.part`），任何".m4s"正则都扫不到。落地顺序也有讲究：**音频先、视频后**——oho 只拿到音频轨时会"跳过并算成功"，只拿到视频轨会报"没找到配套的另一条轨"，所以中间态要留在"只有音频"那侧。下载失败时把临时文件删掉（重试本来就从头下）。
  - 一个已知边界：oho 找配偶时只扫**前 10 个**"以该词干开头"的候选，而词干是**砍掉末尾数字/下划线**得到的。所以集名只差末尾数字（`第1集`/`第2集`/…）时，第 10 集往后可能配不上对；名字里带字母/汉字结尾（`第1集 开场`、`太 君 买 瓜`）就没事。真遇到那种命名，在前缀列给它们各加一个字，或分批下到不同目录。
- **进度、收起与列表缓存**：状态与**列表**都放在 `bilibili-download-state.js` 的模块级 reactive（不是组件私有 ref）。列表放模块级是因为"关掉弹窗＝卸载组件"——不复用的话用户改过的前缀、勾选、上一轮进度全丢。现在只有**页面换了**（`pageKey` = pathname+search，bilibili 是 SPA）或点工具栏「刷新列表」才重读，且**下载中拒绝重读**（会把在跑的行换掉）。对用户来说「关闭」和「收起」是同一件事（把窗口弄走、别打断下载）：头部的 `×` / Esc / 点外面**一律只是收起**，要彻底结束会话才用空闲时那个「关掉」（下载中不显示，因为卸载组件＝循环没人管了）。状态列在下载中显示 `视频+音频 47.0% · 3.4 MB/s · 5 连接`：百分比按两条轨的**合计字节**算，速度是 300ms 采样 + 指数平滑（分片并发下瞬时值抖得厉害）；字节数不占行内宽度，挪到悬停提示里（`statusDetail`）。**点完「下载」会自动收成右下角小条**（`collapseDownloadDialog()`）：用户接下来大概是去看视频，弹窗挡着没道理；小条上带 `下载中 1/3 · 45% · 3.4 MB/s`（`miniText`）和**「停止」**（弹窗已经收了，不能让用户为了停止再点开）。**停止必须在读流循环里生效**：`shouldStop` 从 `saveTrack` 一路传到 `writeStreamToFile` / `saveStreamAsDownload`，在里面逐块检查并抛 `AbortError`——只在"两个视频之间"检查的话，按下去要等当前这一集（几分钟）下完才有反应，会被当成没反应。中止后这一行退回"待下载"（不是 error），**把窗口重新展开**（`expandDownloadDialog()`：不展开的话它还停在上一步自动收起的状态，看起来像"下载按钮都没了"），并且**删掉已经写了一半的 `.part`**（`directory.removeEntry(tempName)`），不留给 oho 当垃圾。检查点要避开"用户停止"路径上的自动重试：`AbortError` 既不触发分片→整段的回退，也不触发换镜像重试。**总量没凑齐时进度条不画任何填充**——以前用的是一个 40% 宽、`margin-left` 在 0↔60% 摆动的"未知"滑块，它的右边缘会从 40% 扫到 100% 再扫回来，看起来就是"先涨到 100% 又退回 0"，被当成假进度投诉过；现在宁可空着（状态行有字节数和速度），`tracksKnown` 为真才显示真实宽度。**百分比必须等"每条轨都报出自己的总量"之后才算**（`expectedTracks` / `tracksKnown`）：只报了一部分轨时，分母里缺了还没报到的那条，音频自己下到 100% 就会被画成"整行 100%"，等视频轨报数再掉回去——这就是用户反复看到的"先有一段蓝条、开始有速度以后又退回"。视频轨比音频轨晚报到是常态（它要多走 `getFileHandle` → `createWritable` → 分片探针 → 等首块）。总量未知期间状态行显示**字节数**而不是百分比，进度条保持 0。playurl 里的 `size` 如果给了就顺手预置一下（`trackProgress.set`），能提早进入百分比状态；**但不能指望它**——实测常常是 0/缺失，所以真判据是"各轨自己报回的总量"。

### V2EX 列表与弹窗（`V2exList.vue`）

`v2ex.com` 的列表页（`/`、`/?tab=`、`/go/*`、`/recent`）走这个视图，做三件事：

- **卡片化 = 纯 CSS**，不改 V2EX 的 DOM：给 `#Main .cell.item` 加圆角/阴影/hover 位移，把内层 `table` 的边框背景清掉，`.count_livid` 做成回复数徽标。这样分页、排序、Tab 全都还是原生的（V2Next 那套是接管整个列表重渲染，代价大得多，没必要）。视图挂载时给 `body` 打 `v2ex-view=list|topic`，样式用 `html:has([v2ex-view=list])` 限定。
- **点标题开弹窗，不跳转**：拦截列表页里 `/t/{id}` 的点击（新标签/修饰键点击放行；作者、节点链接不拦），`fetch('/t/{id}')` 拿 HTML 自己解析——**回复不在 `/api/topics/show.json` 里**（那个只有正文），所以只能解析页面：标题 `.header h1`、正文 `.topic_content`、楼层 `.cell[id^="r_"]`（作者 `.dark`、楼层 `.no`、时间 `.ago[title]`、内容 `.reply_content`）。**只渲染第一页回复**，底部给"在原页面查看全部"。**头像要一起解析**（标题处 `img.avatar` 73px、每楼 `img.avatar` 32px），否则一整列纯文字看着像没加载完；**楼主要标出来**（作者名与标题作者一致时给「楼主」徽标）——光靠缩略头像认人不可靠。
- **图片**：V2EX 把 markdown 图片渲染成 `<img src="https://imgur.com/QiaXYZs">`——**src 是网页地址不是图**（`i.imgur.com/<id>` 返回 HTML，`i.imgur.com/<id>.png` 才是图，扩展名写 `.png`/`.jpg` 都行，实测两种都返回原图）。所以先 `directImageUrl()` 把 imgur 短链归一成 `https://i.imgur.com/<id>.<ext>`，**直链 + `referrerpolicy=no-referrer` 直接加载**（V2EX 自己贴图也是这么干的）；直链挂了才退到 `https://img.noobzone.ru/getimg.php?url=`（前缀拼**直链**，别 encode、别拼网页地址）；代理也挂才换成一条原链接。不补这一步的话，代理会把 HTML 当图片返回，加载失败 → 最后退化成一个文字链接，看着就是"图片地址没被处理"。正文里**纯文本**的图片地址（V2EX 不会自动转链接）也要走一遍 TextNode 换掉，`<a>` 文字等于地址的同样处理；但相册/画廊（`imgur.com/a/...`、`/gallery/...`）和 `<pre>/<code>` 里的地址不能动。
- **选中文字解 base64**：`mouseup` 时若选区能匹配 `[A-Za-z0-9+/=]{8,}`，在光标旁浮一个小条，**点了才解码**。解码必须 `atob → Uint8Array → Blob → .text()`，直接 `atob` 出来的中文是乱码。
- **主题**：**页面黑底是 V2EX 自带的整站主题，不是我们改的**——它用 `localStorage.siteTheme`（light/dark/auto）+ 全局函数 `setSiteThemeMedia()` 切换 `night.css` 的 `media` 属性。所以右侧贴边那个浮动按钮直接驱动**站点这套**（`pageWindow().setSiteThemeMedia(mode)`，mode 也写回 `localStorage.siteTheme`），否则点"深色"只有我们自己的卡片变、页面纹丝不动，看着像坏的。颜色**一律用 V2EX 的 CSS 变量**（`--box-background-color` / `--box-foreground-color` / `--box-border-color` / `--color-gray` / `--link-color`），两套主题都在 `:root` 定义了同名变量（浅色 `#fff` / 深色 `#18222d`），跟着站点自动对齐，不要再自己写死一套暗色。拿不到 `setSiteThemeMedia`（V2EX 改版）时退回"量页面背景亮度 + prefers-color-scheme"。
- **V2EX 开了 Trusted Types**（`innerHTML` 赋字符串直接抛异常）：所以内置样式的注入必须用 `textContent`（见 `vite.config.js` 的 `inlineCss`），`utils/index.js` 的 `addStyle` 同理。`v-html` 渲染弹窗内容在 V2EX 上是能用的（Vue 走的是 `el.innerHTML = value`，页面有 TT 策略时由浏览器裁决；真被拦就把策略加进 `trustedTypes.createPolicy`）。


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