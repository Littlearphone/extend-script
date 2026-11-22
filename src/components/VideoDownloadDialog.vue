<template>
  <!-- 收起形态：只留一个小条，页面照常操作，下载不停 -->
  <div class="nihility-download-mini" v-if="state.collapsed" @click="expandDownloadDialog">
    <span class="mini-dot" :class="{ 'is-running': state.running }"></span>
    <span class="mini-text">{{ miniText }}</span>
    <span class="mini-action">展开</span>
    <!-- 下载中不给"彻底关掉"：那会把循环一起带走 -->
    <span class="mini-close" v-if="!state.running" title="关掉（会丢掉这次的列表）" @click.stop="closeDownloadDialog">×</span>
  </div>

  <div class="nihility-download-mask" v-else @pointerdown="handleMaskPointerDown" @click.self="handleMaskClick">
    <div class="nihility-download-dialog">
      <header class="download-header">
        <div class="download-title">
          <span class="download-title-text">{{ listTitle || '视频下载' }}</span>
          <span class="download-title-sub" v-if="!loading && !loadError">共 {{ rows.length }} 个视频</span>
        </div>
        <!-- 「关闭」和「收起」对用户是同一件事：把窗口弄走、别打断下载。
             所以只留一个 ×（＝收起），要彻底结束这次会话时用底部那个「关闭」。 -->
        <button class="download-header-button is-close" title="收起（下载继续）"
                @click="collapseDownloadDialog">×</button>
      </header>

      <div class="download-loading display-flex-center" v-if="loading">正在读取视频列表…</div>
      <div class="download-loading download-error display-flex-center" v-else-if="loadError">{{ loadError }}</div>

      <template v-else>
        <div class="download-toolbar">
          <label class="download-select-all">
            <input type="checkbox" :checked="allChecked" @change="toggleAll($event.target.checked)"/>
            <span>全选</span>
          </label>
          <span class="download-selected">已选 {{ selectedCount }} 个</span>
          <!-- 清晰度：请求一律要"这个账号能给的最全一档"，所以换这个选择**不会多发任何请求**，
               只是在响应带回来的整个阶梯里本地挑（挑"不高于它、最接近的一档"）。 -->
          <label class="download-quality"
                 title="按“不高于此档、该集自己能给的最高档”下载：某集没有 4K 会自动降到它的最高档，不会失败。这是偏好不是保证，实际拿到哪一档看状态列。">
            <span>清晰度</span>
            <select :value="state.quality" :disabled="state.running"
                    @change="setDownloadQuality($event.target.value)">
              <option v-for="option in QUALITY_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="download-quality" title="单个文件的**分片**并发：把文件切成 4MB 的段并发拉，各段摊到不同镜像 host 上。和播放器**同一个 host** 时每个 host 最多 2 条连接（h1.1 每 host 6 条，播放器还要用），**不同 host** 时放开到 5 条（留 1 条给播放与页面请求）。分不清对面是 h1.1 还是 h2，所以默认不分片；某一片失败会先换镜像重试，全都失败才退回整段重下。注意：视频轨与音频轨**本来就并行**下，这个选项不管它们。">
            <span>并发</span>
            <select :value="state.concurrency" :disabled="state.running"
                    @change="setDownloadConcurrency($event.target.value)">
              <option v-for="option in CONCURRENCY_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <!-- 记住的目录得能改：不点它的话用户没法知道下到哪、也没法换 -->
          <button class="download-dir" :disabled="state.running" @click="changeDirectory" :title="directoryTitle">
            {{ directoryName ? `目录：${directoryName}` : '选择目录' }}
          </button>
          <span class="download-hint">
            直接存进所选目录：<code>&lt;前缀&gt;_1.m4s</code> 视频轨、<code>&lt;前缀&gt;_2.m4s</code> 音频轨；合并用
            <a class="download-hint-link" :href="MERGE_PAGE" target="_blank" rel="noreferrer">ffmpeg-merge</a>
          </span>
          <button class="download-refresh" :disabled="state.running"
                  title="重新读取这一页的视频列表（会丢掉勾选、前缀改动和进度）" @click="load">刷新列表</button>
        </div>

        <div class="download-table-wrap">
          <table class="download-table">
            <colgroup>
              <col style="width: 34px"/>
              <col style="width: 42px"/>
              <col/>
              <col style="width: 340px"/>
              <col style="width: 58px"/>
              <col style="width: 66px"/>
            </colgroup>
            <thead>
            <tr>
              <th></th>
              <th>#</th>
              <th>文件名前缀</th>
              <th>状态</th>
              <th>时长</th>
              <th>操作</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="(row, index) in rows" :key="row.item.key" :class="`is-${row.phase}`">
              <td>
                <input type="checkbox" v-model="row.checked" style="margin-left: 8px;"/>
              </td>
              <td class="cell-index">{{ index + 1 }}</td>
              <td>
                <div class="prefix-cell">
                  <input class="download-prefix" type="text" v-model="row.prefix" :disabled="row.phase === 'running'"
                         :title="row.item.title" :placeholder="row.item.title"/>
                  <!-- 名字是兜底来的（页面上那个字段是投稿工具生成的编号）→ 显式提醒核对，别静默给个错名字 -->
                  <span class="prefix-warn" v-if="row.item.nameAuto"
                        title="页面上那一集显示的名字像是投稿工具生成的编号，这里已退回用视频标题/序号，建议核对">⚠</span>
                </div>
                <!-- 前缀本来就是从标题来的（title === name，prefix === safeFileName(name)），
                     所以平时不重复渲染标题；只有手改过前缀才把原标题补在下面，免得改完忘了原来叫什么 -->
                <div class="prefix-origin" v-if="row.prefix !== row.item.prefix" :title="row.item.title">
                  原标题：{{ row.item.title }}
                </div>
              </td>
              <td class="cell-status">
                <div class="status-text" :class="`is-${row.phase}`" :title="statusDetail(row)">
                  <span class="status-quality" v-if="row.quality && row.phase === 'running'">{{ row.quality }}</span>
                  {{ statusText(row) }}
                </div>
                <div class="status-bar" v-if="row.phase === 'running'">
                  <!-- 总量还没凑齐时**不画填充**：以前这里画的是"40% 宽的滑块左右扫"（is-unknown），
                       它的右边缘会从 40% 扫到 100% 再扫回来，看起来就是"先涨到 100% 又退回 0"。
                       没有真实百分比就不给假进度，宁可空着（状态行有字节数和速度）。 -->
                  <div class="status-bar-fill" v-if="row.tracksKnown"
                       :style="{ width: `${(row.percent * 100).toFixed(1)}%` }"></div>
                </div>
              </td>
              <td class="cell-duration">{{ formatDuration(row.item.duration) }}</td>
              <td>
                <button class="download-row-button" :disabled="state.running" @click="downloadRows([row])">
                  下载
                </button>
              </td>
            </tr>
            </tbody>
          </table>
        </div>

        <footer class="download-footer">
          <span class="download-notice" :class="{ 'is-warn': !!notice }">{{ notice || defaultNotice }}</span>
          <div class="download-actions">
            <button class="download-button" :disabled="!selectedCount || state.running" @click="downloadSelected">
              {{ state.running ? `下载中… (${state.finished}/${state.total})` : `下载选中 (${selectedCount})` }}
            </button>
            <button class="download-button is-plain" v-if="state.running" @click="stopRequested = true">停止</button>
            <button class="download-button is-plain" v-else @click="closeDownloadDialog">关闭</button>
          </div>
        </footer>
      </template>
    </div>
  </div>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { collectVideoItems, formatDuration, resolveStreams, safeFileName } from '../utils/bilibili.js'
import {
  discardDownloadedFile,
  existsWithContent,
  formatBytes,
  formatPercent,
  formatSpeed,
  connectionStats,
  getCachedDirectory,
  peekDirectoryInfo,
  pickDirectory,
  recallDirectory,
  publishDownloadedFile,
  saveStreamAsDownload,
  supportsDirectoryPicker,
  writeStreamToFile,
} from '../utils/bilibili-download.js'
import {
  closeDownloadDialog,
  collapseDownloadDialog,
  CONCURRENCY_OPTIONS,
  expandDownloadDialog,
  QUALITY_OPTIONS,
  setDownloadConcurrency,
  setDownloadQuality,
  videoDownloadList,
  videoDownloadState as state,
} from '../utils/bilibili-download-state.js'

// 合并入口：给用户看的那个网页版工具（站内 UI 不提内部工具名，只指向它）
const MERGE_PAGE = 'https://littlearphone.github.io/ffmpeg-merge/'

// 列表来自模块级（videoDownloadList），关掉再打开还在；组件只是它的一个视图
const rows = ref(videoDownloadList.rows)
const listTitle = computed(() => videoDownloadList.title)
const loading = ref(true)
const loadError = ref('')
const notice = ref('')
const stopRequested = ref(false)

const selectedCount = computed(() => rows.value.filter(row => row.checked).length)
const allChecked = computed(() => rows.value.length > 0 && rows.value.every(row => row.checked))
const miniText = computed(() => {
  if (!state.running) return `已下载 ${state.finished} 个`
  // 收起后也要能看出进度/速度，否则用户还得再点开才知道快不快
  const current = rows.value.find(row => row.phase === 'running')
  const percent = current?.tracksKnown && current.total
    ? `${((current.received / current.total) * 100).toFixed(0)}%`
    : ''
  const speed = formatSpeed(current?.speed)
  const extra = [percent, speed].filter(Boolean).join(' ')
  return `下载中 ${state.finished}/${state.total}${extra ? ` · ${extra}` : ''}`
})
// 在途连接数（全局按 host 汇总）：让"并发到底跑没跑满"看得见。
// 名额是按 host 的，所以选 5 也可能只有 2 条在途（和播放器同一个 host 时上限就是 2）。
const liveConnections = ref(0)
// 当前下载目录的名字（只是显示用；权限到点下载时才申请）
const directoryName = ref('')
// 选的是磁盘根目录（E:\）时 Chromium 只给 name="\"，而浏览器**不暴露完整路径**，
// 盘符拿不回来。这时候给个能读的占位，别让界面上挂一个反斜杠。
const directoryIsDiskRoot = ref(false)
// 只反映**此刻**的权限状态：granted / prompt / denied / none / unknown。
// 「能维持多久」是浏览器自己的策略，API 里查不到，所以界面上不承诺"长期有效"。
const directoryPermission = ref('unknown')
let liveTimer = null

function applyDirectoryName(name) {
  const raw = String(name ?? '')
  // 目录名只能是路径的最后一段，而目录名里不允许出现路径分隔符 —— 所以"只有分隔符"
  // 或者"干脆是空的"只可能是**某个卷的根**。具体哪个盘符拿不到（浏览器不暴露完整路径）。
  directoryIsDiskRoot.value = !raw || /^[\\/]+$/.test(raw)
  directoryName.value = directoryIsDiskRoot.value ? '磁盘根目录' : raw
}

// 按钮的悬停提示：目录名 + 此刻的权限状态（只陈述现状，不猜能维持多久）
const directoryTitle = computed(() => {
  if (!directoryName.value) return '选择下载目录（选一次就会记住）'
  const root = directoryIsDiskRoot.value ? '（浏览器不暴露盘符）' : ''
  const hint = {
    granted: '已授权，下载时直接写入',
    prompt: '下载时会再确认一次',
    denied: '权限已被拒绝，需要重选',
  }[directoryPermission.value] || ''
  return `当前下载目录：${directoryName.value}${root}${hint ? ` · ${hint}` : ''}，点击更换`
})
const defaultNotice = computed(() => supportsDirectoryPicker()
  ? '首次下载选一次目录，之后就记住它（可能只需确认一次「允许编辑文件」）'
  : '当前浏览器不支持选择目录，文件会直接进下载目录（两个文件请手动放到同一个文件夹）')

function toggleAll(checked) {
  rows.value.forEach(row => row.checked = checked)
}

function statusText(row) {
  if (row.phase === 'running') {
    const speed = formatSpeed(row.speed)
    // 有轨还没报到总量时只报字节数：分母不完整，百分比会先冲高再回落
    const amount = row.tracksKnown && row.total
      ? `${((row.received / row.total) * 100).toFixed(1)}%`
      : formatBytes(row.received)
    // 在途连接数跟着这一行显示（下载是跨视频串行的，所以全局数就等于这一行的数）：
    // 光看设置里选的档位看不出到底跑没跑起来
    const links = liveConnections.value > 0 ? ` · ${liveConnections.value} 连接` : ''
    return `${row.label || '准备中'} ${amount}${speed ? ` · ${speed}` : ''}${links}`
  }
  if (row.phase === 'done') {
    const note = row.qualityNote ? `（${row.qualityNote}）` : ''
    return `完成 · ${row.quality}${note}${row.skipped ? ' · 已存在跳过' : ''}`
  }
  if (row.phase === 'error') return row.message
  return '待下载'
}

// 行内那行要窄（状态列 340px，还得给速度留位置），所以字节数只放在悬停提示里
function statusDetail(row) {
  if (row.phase !== 'running') return statusText(row)
  const speed = formatSpeed(row.speed)
  // 每条连接的速度：总速度上不去时，先看是"连接开得少"还是"每条本身就这么快"
  const perLink = row.speed && liveConnections.value > 0
    ? ` · 每条 ${formatSpeed(row.speed / liveConnections.value)}`
    : ''
  return `${row.label || '准备中'} ${formatPercent(row.received, row.total)}${speed ? ` · ${speed}` : ''}${perLink}`
}

// click 的 target 是"按下与松开两处的共同祖先"：在输入框里按下、拖到弹窗外松手，
// 事件也会落在遮罩上（以前这样一拖弹窗就没了）。所以必须记住"按下时到底按在哪"。
let maskPressTarget = null

function handleMaskPointerDown(event) {
  maskPressTarget = event.target
}

function handleMaskClick(event) {
  if (maskPressTarget !== event.currentTarget) return
  maskPressTarget = null
  // 点外面 = 收起（同一个 ×）：下载中更不能把窗口一关就把循环带走
  collapseDownloadDialog()
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  collapseDownloadDialog()
}

// 这份列表属于哪个页面：SPA 换片/换集时 URL 会变，变了才需要重读
function currentPageKey() {
  return `${location.pathname}${location.search}`
}

async function load() {
  // 下载中绝不重读：会把正在跑的那几行整个换掉
  if (state.running) {
    notice.value = '下载中不刷新列表'
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    const result = await collectVideoItems()
    const newRows = result.items.map(item => ({
      item,
      checked: false,
      prefix: item.prefix,
      quality: '',
      // 实际档位低于所选时的说明（"此集没有 4K"），见 statusText
      qualityNote: '',
      phase: 'idle',
      message: '',
      label: '',
      percent: 0,
      speed: 0,
      tracksKnown: false,
      received: 0,
      total: 0,
      skipped: false,
    }))
    // 只有一条时直接勾上，省得再点一次
    if (newRows.length === 1) newRows[0].checked = true
    videoDownloadList.title = result.title
    videoDownloadList.rows = newRows
    videoDownloadList.pageKey = currentPageKey()
    rows.value = newRows
  } catch (error) {
    loadError.value = error.message || String(error)
    logger.warn('读取 B 站视频列表失败', error)
  } finally {
    loading.value = false
  }
}

function validate(targets) {
  const prefixes = targets.map(row => safeFileName(row.prefix))
  const duplicated = prefixes.find((prefix, index) => prefixes.indexOf(prefix) !== index)
  if (duplicated) return `前缀重复：${duplicated}，同一个目录里会互相覆盖`
  if (prefixes.some(prefix => !prefix)) return '文件名前缀不能为空'
  return ''
}

async function downloadSelected() {
  await downloadRows(rows.value.filter(row => row.checked))
}

// 换下载目录：选完立刻写进 IndexedDB，下次打开就是新目录
async function changeDirectory() {
  if (state.running) return
  try {
    const handle = await pickDirectory()
    if (handle) {
      // 按钮上的名字变了就是反馈，不必再写进 notice（那是给警告/错误用的位置）
      applyDirectoryName(handle.name)
      directoryPermission.value = 'granted'
    }
  } catch (error) {
    // 用户点了取消：什么都不做，别用红字吓人
    if (error?.name !== 'AbortError') {
      notice.value = '更换目录失败'
    }
  }
}

async function downloadRows(targets) {
  if (state.running) return
  const list = (targets || []).filter(row => row && row.phase !== 'running')
  if (!list.length) return
  const invalid = validate(list)
  if (invalid) {
    notice.value = invalid
    return
  }
  notice.value = ''
  // 目录选择必须发生在这次点击的同步路径里，否则浏览器不给授权。
  // 顺序：本页已缓存的 → 上次记住的（只要一次权限确认）→ 实在没有再弹选择器。
  // 注意**不能**按"下了几个视频"来决定走不走目录：一次下载永远是两条轨（视频+音频）
  // 两个文件，走浏览器默认下载反而会多弹一次"允许下载多个文件"，确认次数只多不少。
  let directory = getCachedDirectory()
  if (!directory) {
    directory = await recallDirectory()
  }
  if (!directory && supportsDirectoryPicker()) {
    try {
      directory = await pickDirectory()
    } catch (error) {
      notice.value = '没有选择目录，已取消下载'
      return
    }
  }
  // 界面上那个「目录」按钮跟着走
  if (directory) {
    applyDirectoryName(directory.name)
    directoryPermission.value = 'granted'
  }
  state.running = true
  state.finished = 0
  state.total = list.length
  state.dialogOpen = true
  stopRequested.value = false
  // 点完「下载」就把窗口收起来：用户接下来大概率是去看视频，弹窗挡在那儿没道理。
  // 收成右下角小条后仍然显示进度和速度（miniText），想展开/停止点一下小条就行。
  collapseDownloadDialog()
  try {
    // **跨视频串行**：一个视频下完再下一个（单个视频内部：视频轨与音频轨并行、各自可再分片）。
    // 一次提交多个视频会同时打同一站点，把 HTTP 连接占满，后面的请求排队甚至被 CDN 拒。
    for (const row of list) {
      if (stopRequested.value) {
        notice.value = `已停止，还剩 ${state.total - state.finished} 个没下`
        break
      }
      await downloadRow(row, directory)
      state.finished++
    }
  } finally {
    state.running = false
    state.dialogOpen = true
  }
}

async function downloadRow(row, directory) {
  row.phase = 'running'
  row.label = '取流地址'
  row.percent = 0
  row.speed = 0
  const pending = []
  // 两条轨各自报进度，进度条按**合计字节**走（视频比音频大一个量级，分别显示会一个飞快一个龟速）
  const trackProgress = new Map()
  // 这一集应该有几个人在报数（DASH = 视频 + 音频，整段流 = 1）。
  // 只报了几条轨的字节时算百分比是**假**的：分母里缺了还没报到的那条轨，
  // 音频自己下到 100% 就会被画成"整行 100%"，等视频轨报数再掉回去 —— 用户看到的蓝条回退。
  let expectedTracks = 1
  // 速度：按两次采样的字节差算，再指数平滑（瞬时值跳得厉害，尤其分片并发时各 worker 互相穿插）。
  // 采样间隔 300ms：比这更密的话小数太少、抖动全被放大。
  let sampledAt = 0
  let sampledBytes = 0
  // 进度回调是**每读一块（64KB 级）就来一次**的。全速跑起来一秒几百次，每次都改 reactive
  // 状态就等于一秒重渲染表格几百次——这部分开销在并发高时不该赔进去。所以把「改状态」
  // 节流到 10Hz；速度采样本身也是 300ms 一次，不受影响。
  let lastEmitAt = 0
  const reportOf = label => progress => {
    trackProgress.set(label, progress)
    const now = performance.now()
    if (now - lastEmitAt < 100) return
    lastEmitAt = now
    let received = 0
    let total = 0
    for (const item of trackProgress.values()) {
      received += item.received
      total += item.total
    }
    // 每条轨都报出自己的总量之后，分子分母才是同一个整体
    const known = [...trackProgress.values()].filter(item => (item.total || 0) > 0).length
    const allKnown = known >= expectedTracks
    row.received = received
    row.total = total
    row.tracksKnown = allKnown
    row.percent = allKnown && total ? received / total : 0
    row.label = trackProgress.size > 1 ? '视频+音频' : label
    if (!sampledAt) {
      sampledAt = now
      sampledBytes = received
    } else if (now - sampledAt >= 300) {
      const instant = (received - sampledBytes) / ((now - sampledAt) / 1000)
      // 从 0 起步时直接取瞬时值，否则头一秒会被平滑成一个小得离谱的数字
      row.speed = row.speed > 0 ? row.speed * 0.65 + instant * 0.35 : instant
      sampledAt = now
      sampledBytes = received
    }
  }
  try {
    const streams = await resolveStreams(row.item, { preferQn: state.quality })
    row.quality = streams.quality
    // 实际档位低于所选时说明原因：这是"偏好"不是保证，某集没有那一档会自动降级
    const wanted = QUALITY_OPTIONS.find(option => option.value === Number(state.quality))?.label
    row.qualityNote = wanted && wanted !== '最高' && streams.quality !== wanted ? `此集没有 ${wanted}` : ''
    const prefix = safeFileName(row.prefix)
    row.skipped = false
    // 直接落在用户选的目录里，**不再套一层"每片一个子目录"**——文件本身就叫
    // `<前缀>_1.m4s` / `<前缀>_2.m4s`，oho 认的是"同目录 + 同词干 + 轨道互补"，平铺一样能配对。
    //
    // 但**下完之前不许叫 `.m4s`**：oho 的自动任务按文件名扫目录，看到半截文件就开跑
    // （0 字节的正式名 + createWritable 的原子替换会让它报 "file or directory could not be found"）。
    // 所以每条轨先写成 `<前缀>_1.part`，等**这一对都下完**再改名。
    //
    // **两条轨并行下**：视频比音频大一个量级，串行的话那段音频时间就是纯白等
    //（省下的只是音频那一截，视频那条该多久还是多久；跨视频仍是串行）。
    const tasks = []
    // **先把两条轨的总大小占上**（playurl 的响应里本来就带 `size`）。
    // 不占的话，在视频轨报到之前，`trackProgress` 里只有音频轨一家 —— 音频下到 15% 就会
    // 被当成"整行 15%"画出来，等视频轨一报数（200MB 对 15MB）立刻掉回 1%。
    // 用户看到的就是"先有一段蓝条、开始有速度以后又退回去"。
    if (streams.mode === 'progressive') {
      expectedTracks = 1
      trackProgress.set('整段', { received: 0, total: streams.progressive.size || 0 })
    } else {
      expectedTracks = streams.audio ? 2 : 1
      trackProgress.set('视频', { received: 0, total: streams.video.size || 0 })
      if (streams.audio) trackProgress.set('音频', { received: 0, total: streams.audio.size || 0 })
    }
    const seededTotal = [...trackProgress.values()].reduce((sum, item) => sum + (item.total || 0), 0)
    if (seededTotal) {
      row.total = seededTotal
      row.percent = 0
    }
    if (streams.mode === 'progressive') {
      // 只有整段流：它本身已经音视频齐全，存成 mp4，没什么可合并的。
      tasks.push(saveTrack(row, directory, `${prefix}.mp4`, streams.progressive.urls, '整段', reportOf('整段')))
    } else {
      tasks.push(saveTrack(row, directory, `${prefix}_1.m4s`, streams.video.urls, '视频', reportOf('视频')))
      if (streams.audio) {
        tasks.push(saveTrack(row, directory, `${prefix}_2.m4s`, streams.audio.urls, '音频', reportOf('音频')))
      }
    }
    // allSettled：一条挂了另一条也让它跑完（否则会留下没人管的在途请求），最后统一处理失败
    const settled = await Promise.allSettled(tasks)
    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) pending.push(result.value)
    }
    const failed = settled.find(result => result.status === 'rejected')
    if (failed) throw failed.reason
    // **音频先落地、视频后落地**：两次改名之间只有几毫秒，但万一 oho 恰好在这时扫到目录——
    // 只看到音频它会"当音频轨跳过并算成功"（无害），只看到视频它会报"没找到配套的另一条轨"
    // 并把那个视频文件记成已处理（要人工清）。跟下载速度无关，纯保险。
    for (const task of [...pending].reverse()) {
      await publishDownloadedFile(task)
    }
    row.phase = 'done'
    row.percent = 1
    // 节流会漏掉最后一次上报，这里补齐，免得悬停提示里停在 44/45 MB
    row.received = row.total
    row.speed = 0
  } catch (error) {
    // 半截的临时文件不留：重试本来就是从头下，留着只是垃圾
    for (const task of pending) {
      await discardDownloadedFile(task).catch(() => {})
    }
    row.phase = 'error'
    row.speed = 0
    row.message = error.message || String(error)
    logger.warn(`下载失败：${row.item.title}`, error)
  }
}

// 下一条轨；返回"待发布的临时文件"（跳过或降级路径返回 null）。
// 进度由调用方给的 report 处理（两条轨并行时要合计，不能各写各的）
async function saveTrack(row, directory, filename, urls, label, report) {
  row.label = label
  if (!directory) {
    // 降级路径（没有 File System Access）：只能直接交给浏览器下载，没法先临时名再改名
    await saveStreamAsDownload(filename, urls, report)
    return null
  }
  if (await existsWithContent(directory, filename)) {
    row.skipped = true
    return null
  }
  return writeStreamToFile(directory, filename, urls, report, { concurrency: state.concurrency })
}

onMounted(() => {
  // 页面没换、列表还在 → 直接复用（勾选、改过的前缀、上一轮的进度都留着），不重读。
  // 想强制重读就点工具栏的「刷新列表」。
  if (videoDownloadList.rows.length && videoDownloadList.pageKey === currentPageKey()) {
    loading.value = false
  } else {
    load()
  }
  window.addEventListener('keydown', handleKeydown)
  // 只读地显示"记得的目录"，不申请权限、不弹框（queryPermission 只读状态）
  peekDirectoryInfo().then(info => {
    // null = 没记过；空串 = 记着根目录，也要显示出来
    if (info.name !== null && !directoryName.value) applyDirectoryName(info.name)
    directoryPermission.value = info.permission
  })
  // 400ms 一抽样就够了：连接数是给人看趋势的，不必跟着每个字节跳
  liveTimer = setInterval(() => {
    liveConnections.value = state.running ? connectionStats().total : 0
  }, 400)
})
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  clearInterval(liveTimer)
})
</script>
<style lang="scss" scoped>
.nihility-download-mini {
  right: 24px;
  bottom: 24px;
  display: flex;
  z-index: 200;
  color: #f0f0f0;
  cursor: pointer;
  font-size: 13px;
  padding: .5em 1em;
  position: fixed;
  border-radius: 999px;
  pointer-events: all;
  align-items: center;
  gap: .5em;
  background-color: #16161af2;
  box-shadow: 0 6px 24px #000000aa;

  &:hover {
    background-color: #1f1f28;
  }

  .mini-dot {
    width: .55em;
    height: .55em;
    border-radius: 50%;
    background-color: #8ee08e;

    &.is-running {
      background-color: #409eff;
      animation: download-pulse 1s ease-in-out infinite;
    }
  }

  .mini-action {
    color: #b5dcff;
  }

  .mini-close {
    color: #fff6;
    padding: 0 .1em;
    font-size: 15px;
    line-height: 1;

    &:hover {
      color: #fff;
    }
  }
}

.nihility-download-mask {
  inset: 0;
  display: flex;
  z-index: 200;
  position: fixed;
  pointer-events: all;
  align-items: center;
  justify-content: center;
  background-color: #00000080;
  backdrop-filter: blur(4px);
}

.nihility-download-dialog {
  width: min(1240px, 94vw);
  display: flex;
  color: #f0f0f0;
  overflow: hidden;
  max-height: 84vh;
  font-size: 13px;
  border-radius: 12px;
  flex-direction: column;
  background-color: #16161af2;
  box-shadow: 0 12px 48px #000000aa;

  .download-header {
    display: flex;
    flex: none;
    padding: .8em 1em;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #ffffff1a;

    .download-title {
      display: flex;
      gap: .6em;
      align-items: baseline;
      min-width: 0;

      .download-title-text {
        font-size: 15px;
        font-weight: bold;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .download-title-sub {
        color: #ffffff80;
        white-space: nowrap;
      }
    }

    .download-header-button {
      border: 0;
      color: #fff9;
      cursor: pointer;
      padding: .25em .6em;
      border-radius: 4px;
      background-color: #ffffff14;

      &:hover:not(:disabled) {
        color: #fff;
        background-color: #ffffff26;
      }

      &.is-close {
        font-size: 18px;
        line-height: 1.1;
        background: none;

        &:disabled {
          cursor: not-allowed;
          opacity: .3;
        }
      }
    }
  }

  .download-loading {
    flex: 1;
    padding: 3em;
    color: #fff9;

    &.download-error {
      color: #ff9a9a;
    }
  }

  .download-toolbar {
    gap: .8em;
    display: flex;
    flex: none;
    padding: .6em 1em;
    align-items: center;
    border-bottom: 1px solid #ffffff1a;

    .download-select-all {
      gap: .3em;
      display: flex;
      cursor: pointer;
      align-items: center;
      white-space: nowrap;
    }

    .download-selected {
      color: #b5dcff;
      white-space: nowrap;
    }

    .download-hint {
      color: #ffffff66;
      overflow: hidden;
      margin-left: auto;
      white-space: nowrap;
      text-overflow: ellipsis;

      code {
        padding: 0 .3em;
        color: #b5dcff;
        border-radius: 3px;
        background-color: #ffffff14;
      }

      .download-hint-link {
        color: #b5dcff;
        text-decoration: underline;
        text-underline-offset: 2px;

        &:hover {
          color: #fff;
        }
      }
    }

    // 「目录：xxx」：记住的目录得看得见、也得能换，否则用户不知道下到哪
    .download-dir {
      flex: none;
      overflow: hidden;
      max-width: 12em;
      color: #fff9;
      cursor: pointer;
      white-space: nowrap;
      text-overflow: ellipsis;
      padding: .25em .6em;
      border-radius: 4px;
      border: 0;
      background-color: #ffffff14;

      &:hover:not(:disabled) {
        color: #fff;
        background-color: #ffffff26;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: .4;
      }
    }

    .download-refresh {
      flex: none;
      color: #fff9;
      cursor: pointer;
      padding: .25em .6em;
      border-radius: 4px;
      border: 0;
      background-color: #ffffff14;

      &:hover:not(:disabled) {
        color: #fff;
        background-color: #ffffff26;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: .4;
      }
    }

    .download-quality {
      flex: none;
      gap: .35em;
      display: flex;
      color: #ffffff99;
      align-items: center;

      select {
        color: #f0f0f0;
        cursor: pointer;
        padding: .2em .3em;
        border-radius: 4px;
        border: 1px solid #ffffff33;
        background-color: #ffffff14;

        &:disabled {
          cursor: not-allowed;
          opacity: .5;
        }

        option {
          color: #1a1a1a;
        }
      }
    }
  }

  .download-table-wrap {
    flex: 1;
    overflow: auto;
  }

  .download-table {
    width: 100%;
    border-spacing: 0;
    table-layout: fixed;

    th, td {
      padding: .4em .5em;
      text-align: left;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      border-bottom: 1px solid #ffffff0f;
    }

    thead th {
      top: 0;
      z-index: 1;
      color: #ffffff99;
      position: sticky;
      font-weight: normal;
      background-color: #1e1e24;
    }

    tbody tr:hover {
      background-color: #ffffff0a;
    }

    .cell-index,
    .cell-duration {
      color: #ffffff80;
    }

    .cell-duration {
      text-align: left;
    }

    .download-prefix {
      flex: 1;
      min-width: 0;
      color: #f0f0f0;
      padding: .25em .4em;
      // 给右侧的 ⚠ 留固定位置：它走绝对定位（否则会把输入框挤窄，带警告的行和不带的
      // 行宽度就不一样了），所以这里**无论有没有警告**都留出同样的一截，右边界整齐。
      padding-right: 1.25em;
      border-radius: 4px;
      border: 1px solid #ffffff33;
      background-color: #ffffff0f;

      &:focus {
        outline: none;
        border-color: #409eff;
      }
    }

    .prefix-cell {
      gap: .3em;
      display: flex;
      position: relative;
      align-items: center;
    }

    .prefix-origin {
      color: #ffffff66;
      overflow: hidden;
      font-size: 11px;
      margin-top: .2em;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .prefix-warn {
      top: 50%;
      right: .45em;
      cursor: help;
      color: #ffb36b;
      position: absolute;
      transform: translateY(-50%);
    }

    .cell-status {
      .status-quality {
        color: #ffd479;
        margin-right: .4em;
        padding: 0 .3em;
        border-radius: 3px;
        background-color: #ffd47922;
      }

      .status-text {
        color: #ffffff99;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;

        &.is-done {
          color: #8ee08e;
        }

        &.is-error {
          color: #ff9a9a;
        }

        &.is-running {
          color: #b5dcff;
        }
      }

      .status-bar {
        height: 3px;
        margin-top: .3em;
        overflow: hidden;
        border-radius: 2px;
        background-color: #ffffff1f;

        .status-bar-fill {
          height: 100%;
          background-color: #409eff;
          transition: width .2s linear;
        }
      }
    }

    .download-row-button {
      cursor: pointer;
      color: #b5dcff;
      padding: .25em .6em;
      border-radius: 4px;
      border: 1px solid #409eff66;
      background-color: #409eff1f;

      &:hover:not(:disabled) {
        background-color: #409eff3d;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: .5;
      }
    }
  }

  .download-footer {
    gap: 1em;
    display: flex;
    flex: none;
    padding: .7em 1em;
    align-items: center;
    border-top: 1px solid #ffffff1a;

    .download-notice {
      color: #ffffff80;

      &.is-warn {
        color: #ffb36b;
      }
    }

    .download-actions {
      gap: .6em;
      display: flex;
      flex: none;
      margin-left: auto;
    }

    .download-button {
      cursor: pointer;
      color: #fff;
      padding: .45em 1.1em;
      border-radius: 6px;
      border: 1px solid transparent;
      background-color: #409eff;

      &:hover:not(:disabled) {
        background-color: #66b1ff;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: .5;
      }

      &.is-plain {
        color: #fff9;
        background-color: #ffffff14;

        &:hover {
          color: #fff;
          background-color: #ffffff26;
        }
      }
    }
  }
}

@keyframes download-pulse {
  0%, 100% {
    opacity: .3;
  }
  50% {
    opacity: 1;
  }
}

</style>
