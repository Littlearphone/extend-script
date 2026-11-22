// 面板入口、弹窗、下载循环共用同一份状态。
//
// 为什么不放在组件里：弹窗收起后组件仍在，但"下载中 n/m"要出现在浮动面板的入口按钮上；
// 弹窗一关（卸载）时下载循环还得能继续跑完，所以进度不能是组件的私有 ref。
import { reactive } from 'vue'

const QUALITY_KEY = 'bilibili-download-quality'
const CONCURRENCY_KEY = 'bilibili-download-concurrency'

function readQualityPreference() {
  if (typeof GM_getValue !== 'function') {
    return 120
  }
  return Number(GM_getValue(QUALITY_KEY, 120)) || 120
}

// 默认 1（单个文件不分片）。不默认开分片的原因：跨域资源读不到协议（h1.1 每 host 6 条连接，
// 还要和正在播放的播放器抢），所以只能让用户自己决定；分片失败会自动退回不分片。
function readConcurrencyPreference() {
  if (typeof GM_getValue !== 'function') {
    return 1
  }
  return Number(GM_getValue(CONCURRENCY_KEY, 1)) || 1
}

// 分片并发（不是"轨并发"：视频轨与音频轨**永远并行**下，因为音频小一个量级，
// 串行的话那段就是纯白等）。这里的值只决定**单个文件的内部**切不切分片。
// 上限按 host 算：和播放器同一个 host 只开 2 条，不同 host 放开到 5（见 bilibili-download.js）。
export const CONCURRENCY_OPTIONS = [
  { value: 1, label: '不分片' },
  { value: 2, label: '2' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  // 只在"有多个镜像 host"时才有意义：单个 host 最多 5 条，多出来的 worker 只是排队
  { value: 8, label: '8' },
]

// 可选的档位（与 bilibili.js 的 QUALITY_LABELS 对齐）：用户看到的是这一份，别再各写一份
export const QUALITY_OPTIONS = [
  { value: 120, label: '最高' },
  { value: 116, label: '1080P60' },
  { value: 112, label: '1080P+' },
  { value: 80, label: '1080P' },
  { value: 74, label: '720P60' },
  { value: 64, label: '720P' },
  { value: 32, label: '480P' },
  { value: 16, label: '360P' },
]

export const videoDownloadState = reactive({
  // 弹窗是否存在：true 时组件挂在页面上（可见，或收成右下角小条）
  dialogOpen: false,
  // 收起：窗口不见了但组件还在，下载继续
  collapsed: false,
  running: false,
  finished: 0,
  total: 0,
  // 想要的清晰度档位（qn）。120 = 要最高；其余按"不高于它、取最接近的一档"在本地挑
  // —— playurl 的响应本来就带整个阶梯，所以换档位不需要多发请求。
  quality: readQualityPreference(),
  // 单个文件的分片并发：1 = 不分片（整段一条流）。分片摊到不同镜像 host，每个 host 最多 2 条
  //（见 bilibili-download.js）；轨间并行不受它影响。
  concurrency: readConcurrencyPreference(),
})

export function setDownloadQuality(qn) {
  videoDownloadState.quality = Number(qn) || 120
  if (typeof GM_setValue === 'function') {
    GM_setValue(QUALITY_KEY, String(videoDownloadState.quality))
  }
}

export function setDownloadConcurrency(value) {
  videoDownloadState.concurrency = Number(value) || 1
  if (typeof GM_setValue === 'function') {
    GM_setValue(CONCURRENCY_KEY, String(videoDownloadState.concurrency))
  }
}

// 列表也放模块级（不是弹窗组件的私有 ref）：**关掉弹窗＝卸载组件**，再打开时如果不复用，
// 用户改过的前缀、勾选、以及上一轮的进度就全没了。只有页面换了（pageKey 不同）或用户点
// 「刷新列表」才重读。
export const videoDownloadList = reactive({
  title: '',
  rows: [],
  // 这份列表属于哪个页面（pathname+search）——bilibili 是 SPA，换片/换集时 URL 会变
  pageKey: '',
})

// 「打开 / 收起 / 展开」都能重复调用；「关掉」才卸载组件（列表随之丢掉，下次重新读）
export function openDownloadDialog() {
  videoDownloadState.dialogOpen = true
  videoDownloadState.collapsed = false
}

export function collapseDownloadDialog() {
  videoDownloadState.collapsed = true
}

export function expandDownloadDialog() {
  videoDownloadState.collapsed = false
}

// 卸载组件＝下载循环没人管了，所以下载中不允许“关掉”（调用方在小条上也不显示那个 ×）
export function closeDownloadDialog() {
  if (videoDownloadState.running) {
    videoDownloadState.collapsed = true
    return
  }
  videoDownloadState.dialogOpen = false
  videoDownloadState.collapsed = false
}
