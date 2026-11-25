// 落盘：优先用 File System Access（能挑目录、边下边写、不整份占内存），
// 浏览器不支持时降级成 blob + <a download>（整份进内存，只能落进下载目录）。
//
// 支持并发分片（可选，见 writeStreamChunked）：分段 Range 并发拉、各写各的偏移。

function pageWindow() {
  return typeof unsafeWindow === 'undefined' ? window : unsafeWindow
}

// CDN 地址是带 token 签名的，不需要 cookie；反过来带上 credentials 反而会被
// `Access-Control-Allow-Origin: *` 拒掉——所以这里刻意用默认的 same-origin 语义。
function cdnFetch(url, init) {
  const fetchImpl = pageWindow().fetch || fetch
  return fetchImpl.call(pageWindow(), url, init)
}

// 沙箱（Tampermonkey）里 window 是代理对象，新的 Web API 不一定挂上去，两个 realm 都看一眼。
function directoryPicker() {
  return pageWindow().showDirectoryPicker || window.showDirectoryPicker
}

export function supportsDirectoryPicker() {
  return typeof directoryPicker() === 'function'
}

let cachedDirectory = null

export function getCachedDirectory() {
  return cachedDirectory
}

// ---- 记住上次选的目录 ----
//
// 目录句柄可以存进 IndexedDB（结构化克隆），下次打开页面捞回来只要 `queryPermission`
// 一次就够，通常只弹一个「允许编辑文件」；用户选过"每次访问都允许"的话连这一次都没有。
// 不然每次下东西都要重新走一遍 showDirectoryPicker（选目录 + 确认 + 授权）。
const HANDLE_DB = 'nihility-script'
const HANDLE_STORE = 'directories'
const HANDLE_KEY = 'download-dir'

function openHandleDB() {
  const factory = pageWindow().indexedDB || indexedDB
  return new Promise((resolve, reject) => {
    const request = factory.open(HANDLE_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(HANDLE_STORE)) db.createObjectStore(HANDLE_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readStoredHandle() {
  try {
    const db = await openHandleDB()
    return await new Promise((resolve, reject) => {
      const request = db.transaction(HANDLE_STORE, 'readonly').objectStore(HANDLE_STORE).get(HANDLE_KEY)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    return null
  }
}

async function storeHandle(handle) {
  try {
    const db = await openHandleDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE, 'readwrite')
      tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (error) {
    // 存不下就算了（隐私模式等），下次重新选目录，不影响本次下载
  }
}

// 必须在用户点击的那一次调用里执行：浏览器只认手势带来的授权。
export async function pickDirectory() {
  const picker = directoryPicker()
  if (typeof picker !== 'function') return null
  const host = pageWindow().showDirectoryPicker ? pageWindow() : window
  cachedDirectory = await picker.call(host, { mode: 'readwrite', startIn: 'downloads' })
  // 选一次就用一辈子（直到用户清站点数据）：下次不必再选
  await storeHandle(cachedDirectory)
  return cachedDirectory
}

// 只读地看一眼记住的目录：**不申请权限、不弹任何框**（queryPermission 只读状态）。
// name 为 null = 根本没记住；空串 = 记住了但 name 为空（根目录的另一种形态）。
// 这两种必须分开：否则"记着根目录"会被界面显示成"没选过"。
//
// permission 只能反映**此刻**的状态（granted / denied / prompt），"能维持多久"是浏览器
// 自己的策略，API 里没有这个信息，别试图在界面上承诺"长期有效"。
export async function peekDirectoryInfo() {
  const remembered = await readStoredHandle()
  if (!remembered) return { name: null, permission: 'none' }
  const name = typeof remembered.name === 'string' ? remembered.name : ''
  let permission = 'unknown'
  try {
    if (typeof remembered.queryPermission === 'function') {
      permission = await remembered.queryPermission({ mode: 'readwrite' })
    }
  } catch (error) {
    // 查不到就当未知，不影响下载时再要权限
  }
  return { name, permission }
}

// 捞回上次那个目录，并确保还有写权限。拿不到 / 权限被拒就返回 null，调用方再退回选目录。
export async function recallDirectory() {
  const remembered = await readStoredHandle()
  if (!remembered) return null
  try {
    if (typeof remembered.queryPermission === 'function') {
      let state = await remembered.queryPermission({ mode: 'readwrite' })
      // 'prompt' 时可以在这里直接要一次权限（我们从点击事件里过来的）
      if (state === 'prompt' && typeof remembered.requestPermission === 'function') {
        state = await remembered.requestPermission({ mode: 'readwrite' })
      }
      if (state !== 'granted') return null
    }
    cachedDirectory = remembered
    return remembered
  } catch (error) {
    return null
  }
}

// ---- 每个 host 的连接预算（全局信号量）----
//
// 为什么必须是"按 host 记的全局名额"、而不是"每个文件算出一个上限"：
// 视频轨与音频轨**是并行的**，两条轨的镜像甚至可能落在不同 host 上（DASH 的 video/audio
// 各自一套 base_url + backup_url）。如果每条轨、每次调用各自算一份预算，同一个 host 上就会
// 出现 5 + 5 = 10 条连接 —— 预算形同虚设。所以谁要发请求谁先拿名额，拿不到就排队。
const hostSlots = new Map()

function hostSlot(host) {
  let slot = hostSlots.get(host)
  if (!slot) {
    slot = { active: 0, waiters: [] }
    hostSlots.set(host, slot)
  }
  return slot
}

// 返回 release 函数。名额在"释放 → 移交"时同步转手（active 不先减再加），
// 中间不会插进别的调用者，所以不会超发。
function acquireSlot(host, limit) {
  const slot = hostSlot(host)
  if (slot.active < limit) {
    slot.active++
    return Promise.resolve(() => releaseSlot(slot))
  }
  return new Promise(resolve => slot.waiters.push(resolve))
}

function releaseSlot(slot) {
  const next = slot.waiters.shift()
  if (next) {
    next(() => releaseSlot(slot))
    return
  }
  slot.active--
}

// 当前真正在途的 CDN 请求数（按 host 汇总）。弹窗靠它显示"在途 N 条"——
// 用户要能看出并发到底有没有跑起来，光看设置里的数字不算数。
export function connectionStats() {
  let total = 0
  const byHost = {}
  for (const [host, slot] of hostSlots) {
    if (!slot.active) continue
    byHost[host] = slot.active
    total += slot.active
  }
  return { total, byHost }
}

// 一次下载开始时抄一遍播放器的 host（页面换集/换 CDN 后 __playinfo__ 会变）。
// 同一个 host 下所有请求（两条轨、所有分片、以及退回整段的那条流）共用这几个名额。
function makeConnectionLimit() {
  const playingHosts = playingStreamHosts()
  return url => {
    // 抄不到播放器的 host 就不敢假设"不是同一个池"，按保守的算
    if (!playingHosts.size) return CONNECTIONS_ON_PLAYING_HOST
    return playingHosts.has(hostOf(url)) ? CONNECTIONS_ON_PLAYING_HOST : CONNECTIONS_ON_MIRROR_HOST
  }
}

// 拿到名额再发请求；返回的是"读到流结尾之后才该调用"的 release（不是请求返回后）。
async function openFirstStream(urls, limitFor) {
  let lastError = null
  for (const url of urls) {
    const release = await acquireSlot(hostOf(url), limitFor(url))
    try {
      const response = await cdnFetch(url)
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
      return { response, release }
    } catch (error) {
      release()
      lastError = error
    }
  }
  throw lastError || new Error('没有可用的下载地址')
}

// 「停止」用的中止信号：抛 AbortError，让上层能区分"用户按了停止"和"真的下失败了"。
// 检查点放在**每次读块**里——只检查"两个视频之间"的话，按下停止要等当前这一集下完才生效。
function abortError() {
  const error = new Error('已停止')
  error.name = 'AbortError'
  return error
}

function throwIfStopped(shouldStop) {
  if (shouldStop?.()) throw abortError()
}

// 读一块最长等多久。有些 CDN 节点会把连接"吊住"（TCP 通着、但几十毫秒才吐一点），
// 几条连接都这样就成了"看着在跑、速度只有一百多 K"。超时按失败处理 → 换镜像重试。
const READ_IDLE_TIMEOUT = 15_000

function readWithTimeout(reader) {
  let timer = null
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('读取超时：15 秒没有新数据')), READ_IDLE_TIMEOUT)
  })
  return Promise.race([reader.read(), timeout]).finally(() => clearTimeout(timer))
}

// ---- 镜像 host 的实测吞吐 ----
//
// B 站给的 `base_url` + `backup_url[]` 是同一个文件的多个镜像，但它们**不是一样快**：
// 常见情况是一个节点几十 MB/s、另一个只有几百 KB/s。以前是死板轮询，慢的那个会一直
// 拖着一半的分片（videos 又大，看着就是"4 条连接只有一百多 K"）。现在按实测速度挑。
const hostRates = new Map()   // host → { bytes, ms }（指数衰减，只代表最近的样本）

function recordHostRate(host, bytes, ms) {
  if (!bytes || ms <= 0) return
  const current = hostRates.get(host) || { bytes: 0, ms: 0 }
  current.bytes = current.bytes * 0.6 + bytes
  current.ms = current.ms * 0.6 + ms
  hostRates.set(host, current)
}

function rateOf(host) {
  const stat = hostRates.get(host)
  return stat && stat.ms > 0 ? stat.bytes / stat.ms : 0   // bytes per ms
}

// 选一个镜像：重试按轮转（别再压刚失败的那个）；首次下发按**实测速度的平方加权**随机。
//
// 为什么是平方而不是线性：一个 20MB/s 的节点和一个 1.2MB/s 的节点，线性加权还会给慢的
// 4% 左右分片，可它一片 4MB 要下 3 秒，等于白白占住一个 worker；平方之后慢节点的份额
// 掉到千分之几，同时又保留"它万一恢复了还能被重新采样"的可能。另外留 5% 纯随机探底。
//
// `sampled` 记着"已经派过活"的 host：**每个 host 只探一次**。以前是拿"当前还没测出速度的
// host 列表"来派，可是慢节点要跑 1 秒多才出速度，这期间每次新派发都会再挑中它 —— 结果
// 一个慢镜像能吃掉 25% 的分片。
function chooseMirror(mirrors, sampled, index, attemptOffset, attempt) {
  if (mirrors.length === 1) return mirrors[0]
  if (attempt > 0) return mirrors[(index + attemptOffset + attempt) % mirrors.length]
  const fresh = mirrors.find(url => !sampled.has(hostOf(url)))
  if (fresh) {
    sampled.add(hostOf(fresh))
    return fresh
  }
  if (Math.random() < 0.05) return mirrors[Math.floor(Math.random() * mirrors.length)]
  const weights = mirrors.map(url => rateOf(hostOf(url)) ** 2)
  const sum = weights.reduce((total, weight) => total + weight, 0)
  if (!sum) return mirrors[Math.floor(Math.random() * mirrors.length)]
  let pick = Math.random() * sum
  for (let i = 0; i < mirrors.length; i++) {
    pick -= weights[i]
    if (pick <= 0) return mirrors[i]
  }
  return mirrors[mirrors.length - 1]
}

// 每个文件下完打一条吞吐日志：出问题时（比如"4 连接只有一百多 K"）能直接看出是
// 连接没开起来、还是单条本来就慢、还是中途重试/超时了。
function logThroughput(filename, bytes, startedAt, links) {
  const seconds = Math.max((performance.now() - startedAt) / 1000, 0.001)
  log(`${filename}：${formatBytes(bytes)} / ${seconds.toFixed(1)}s = ${formatBytes(bytes / seconds)}/s（${links} 条连接）`)
}

export async function existsWithContent(directory, filename) {
  try {
    const handle = await directory.getFileHandle(filename)
    const file = await handle.getFile()
    return file.size > 0
  } catch (error) {
    return false
  }
}

// 下载中的临时名：**故意不含 `.m4s`/`.mp4`**。
//
// 为什么非这样不可：`getFileHandle(name, {create: true})` 会**立刻创建一个 0 字节的正式文件**，
// 而 oho 的自动任务是拿文件名正则去扫目录的（可能不锚定结尾）——它会看到一个 0 字节/半截的
// `.m4s` 就开跑，随后 `createWritable()` 的原子替换又让那个名字短暂消失，于是报
// "A requested file or directory could not be found at the time an operation was processed"。
// 去掉扩展名换成 `.part`，名字里根本没有 `.m4s`，任何".m4s"正则都扫不到它。
export function tempNameFor(filename) {
  const dot = filename.lastIndexOf('.')
  return `${dot > 0 ? filename.slice(0, dot) : filename}.part`
}

// 写到临时名，**返回一个待发布的句柄**；正式名字由调用方在"这一对轨都下完"之后才落地。
export async function writeStreamToFile(directory, filename, urls, onProgress, { concurrency = 1, shouldStop } = {}) {
  // 名额表跟着这一次下载走：播放器换集/换 CDN 之后，哪些 host 算"播放器正在用的"会变
  const limitFor = makeConnectionLimit()
  if (concurrency > 1) {
    try {
      return await writeStreamChunked(directory, filename, urls, onProgress, concurrency, limitFor, shouldStop)
    } catch (error) {
      // 用户按了停止：**不要**再退回整段重下，直接往上抛
      if (error?.name === 'AbortError') throw error
      // 分片不可用（服务端忽略 Range / 镜像 403 / 超时 / 可用镜像不足）就悄悄退回"整段一条流"：
      // 用户要的是"下下来"，不是"必须并发"。
      log(`并发分片改用整段：${error.message}`)
      onProgress?.({ received: 0, total: 0 })
    }
  }
  return writeStreamSerial(directory, filename, urls, onProgress, limitFor, shouldStop)
}

function log(message) {
  if (typeof logger !== 'undefined' && logger?.debug) {
    logger.debug(message)
  }
}

async function writeStreamSerial(directory, filename, urls, onProgress, limitFor, shouldStop) {
  const startedAt = performance.now()
  const tempName = tempNameFor(filename)
  const fileHandle = await directory.getFileHandle(tempName, { create: true })
  const writable = await fileHandle.createWritable()
  let release = null
  try {
    const opened = await openFirstStream(urls, limitFor)
    const { response } = opened
    release = opened.release
    const total = Number(response.headers.get('content-length')) || 0
    const reader = response.body.getReader()
    let received = 0
    onProgress?.({ received, total })
    for (;;) {
      throwIfStopped(shouldStop)
      const { done, value } = await readWithTimeout(reader)
      if (done) break
      await writable.write(value)
      received += value.byteLength
      onProgress?.({ received, total })
    }
    await writable.close()
    logThroughput(filename, total, startedAt, 1)
    return { fileHandle, directory, tempName, filename }
  } catch (error) {
    await writable.abort().catch(() => {})
    // 停掉/失败的临时文件别留在目录里（0 字节的 .part 也是垃圾）
    await directory.removeEntry(tempName).catch(() => {})
    throw error
  } finally {
    // 名额在"读到流结尾"之后才还（不是请求一返回就还）：连接实际被占着的是整段读取期间
    release?.()
  }
}

// ---- 并发分片下载 ----
//
// 保守设计的原因：跨域资源**读不到协议**（`nextHopProtocol` 在没有 `Timing-Allow-Origin` 时
// 返回空串，B 站 CDN 实测没带这个头），所以分不清对面是 h1.1（每 host 6 条连接，还要和正在
// 播放的播放器抢）还是 h2/h3（一条连接多路复用）。所以只能靠"每 host 最多开几条"来兜住：
//   - 分片摊到**不同镜像 host**（`base_url` + `backup_url[]` 本来就是同一份文件的镜像）；
//   - 每个 host 能开几条看它**是不是播放器正在用的那个 host**，名额按 host 全局排队
//     （见 acquireSlot：视频轨/音频轨/所有分片共用同一份名额）；
//   - 分片请求**不加** `priority: 'low'`：实测低优先级会让 CDN/浏览器把我们的流压在后面，
//     4 条连接只跑到一百多 KB/s（IDM 同一个视频能到近百 MB/s）；播放器优先是靠 host 名额保的，
//     不靠请求优先级。
//   - 某一片失败先**换镜像重试**，全都失败才抛错、由 writeStreamToFile 退回整段。
const CHUNK_SIZE = 4 * 1024 * 1024
// 一片最多试几次。**不能**用"镜像数"当预算：只有一个镜像时那等于一次都不重试，
// 一次 503 就会让整个文件退回整段重下（进度条回退的元凶）。失败时轮流换镜像，轮完再循环。
const CHUNK_ATTEMPTS = 4
// 和播放器同一个 host：h1.1 每 host 只有 6 条，播放器自己要占，留宽一点只敢开 2 条。
const CONNECTIONS_ON_PLAYING_HOST = 2
// 和播放器不在同一个 host：不抢同一条连接池，放开到 5（6 条里留 1 条余量给播放与页面请求）。
const CONNECTIONS_ON_MIRROR_HOST = 5

function hostOf(url) {
  try {
    return new URL(url).host
  } catch (error) {
    return url
  }
}

// 同一 host 只留一条：这才是"摊并发"的落点（多个 backup 常常在同一个 host 上）
function mirrorUrls(urls) {
  const seen = new Set()
  const mirrors = []
  for (const url of urls) {
    const host = hostOf(url)
    if (seen.has(host)) continue
    seen.add(host)
    mirrors.push(url)
  }
  return mirrors
}

// 播放器**正在用**的那条流的 host：抄页面自己的 `__playinfo__`（免费、无请求）。
//
// 只认清晰度阶梯里的**第一条**（视频 + 音频各一条），**不认 backup_url**。
// 为什么不能全收：`__playinfo__` 里的 `dash.video[]` 是**整个清晰度阶梯**（4K 有十档），
// 每档都带 base_url + 一堆 backup_url，B 站还会给不同档位分不同 CDN —— 全收进来就有几十个
// host，而下载地址本来就取自同一批镜像，于是"下载 host 是不是播放器 host"几乎永远命中，
// 名额被永久压在 2 条。只留第一条，才能真正区分"是不是同一个连接池"。
export function playingStreamHosts() {
  const hosts = new Set()
  let raw = null
  try {
    raw = pageWindow().__playinfo__
  } catch (error) {
    return hosts
  }
  // 普通视频是 { data: { dash } }，番剧是 { result: { video_info } }，两种都认
  const data = raw?.data?.dash || raw?.data?.durl ? raw.data : (raw?.result?.video_info || raw?.result)
  const pick = stream => {
    const url = stream?.base_url || stream?.url
    if (typeof url === 'string' && url.startsWith('http')) hosts.add(hostOf(url))
  }
  pick(data?.dash?.video?.[0])
  pick(data?.dash?.audio?.[0])
  pick(data?.durl?.[0])
  return hosts
}

// 有些 CDN 节点会**忽略 Range 直接回 200**（或者干脆不给分片）。这类 host 永远分不了片，
// 记下来：后面的文件连试都不试。否则每个文件都要"先切几 MB → 失败 → 退回整段重下"，
// 那正是"进度条先走一段再掉回 0"的来源，白白浪费一次。
const rangeIgnoringHosts = new Set()

// 用 1 字节的 Range 问出总大小；服务端不认 Range（回 200）就返回 0 = 不能分片
async function probeTotalSize(urls, limitFor) {
  for (const url of urls) {
    // 探针也是一次真实请求，一样占名额
    const release = await acquireSlot(hostOf(url), limitFor(url))
    try {
      const response = await cdnFetch(url, { headers: { Range: 'bytes=0-0' } })
      if (response.status === 200) {
        rangeIgnoringHosts.add(hostOf(url))
      }
      if (response.status !== 206) {
        try {
          await response.body?.cancel()
        } catch (error) { /* 忽略 */ }
        continue
      }
      const total = Number((response.headers.get('content-range') || '').split('/')[1]) || 0
      try {
        await response.body?.cancel()
      } catch (error) { /* 忽略 */ }
      if (total > 0) return total
    } catch (error) {
      // 换个镜像再问
    } finally {
      release()
    }
  }
  return 0
}

async function writeStreamChunked(directory, filename, urls, onProgress, concurrency, limitFor, shouldStop) {
  const startedAt = performance.now()
  const mirrors = mirrorUrls(urls).filter(url => !rangeIgnoringHosts.has(hostOf(url)))
  if (!mirrors.length) throw new Error('这些镜像不支持 Range（已记下，本页不再尝试分片）')
  const total = await probeTotalSize(mirrors, limitFor)
  if (!total) throw new Error('服务端不支持 Range')
  if (total < CHUNK_SIZE * 2) throw new Error('文件太小，不值得分片')

  const tempName = tempNameFor(filename)
  const fileHandle = await directory.getFileHandle(tempName, { create: true })
  const writable = await fileHandle.createWritable()
  const chunkCount = Math.ceil(total / CHUNK_SIZE)
  // worker 数量**不再**按"预算"折算：名额是全局按 host 排队的（两条轨共用），
  // 多开几个 worker 只是排在信号量上等着，不会真的多占连接。
  const workers = Math.min(concurrency, chunkCount)
  if (workers < 2) throw new Error('可用镜像不足')
  let received = 0
  let nextIndex = 0
  let failReason = null
  const done = new Set()
  // 每片"已经写到哪了"。失败重试时从这里继续要 Range，而不是从片头重下——
  // 这样已写入的字节不用退回计数，进度条也就不会因为一次重试往回跳。
  const progressOfChunk = new Map()
  // 已经派过活的 host：每个镜像只探一次。以前是"看谁还没测出速度就派给谁"，
  // 但慢节点要跑一秒多才出速度，这期间新派发会反复挑中它。
  const sampledHosts = new Set()

  // 下载一片；成功返回 true。失败时保留断点，下一次调用会接着要。
  const fetchChunk = async (index, attemptOffset) => {
    const chunkStart = index * CHUNK_SIZE
    const end = Math.min(chunkStart + CHUNK_SIZE, total) - 1
    let lastError = null
    // 这一片失败就先换镜像重试：几个 backup 本来就是同一份文件的镜像，一个节点抽风不该让
    // 整个文件退回整段重下。每轮错开起点，让请求摊到不同 host 上。
    for (let attempt = 0; attempt < CHUNK_ATTEMPTS; attempt++) {
      throwIfStopped(shouldStop)
      const from = progressOfChunk.get(index) ?? chunkStart
      if (from > end) return true
      const url = chooseMirror(mirrors, sampledHosts, index, attemptOffset, attempt)
      // 名额按 host 拿：两条轨的分片都排同一个 host 的队，所以同 host 的并发是精确的
      const release = await acquireSlot(hostOf(url), limitFor(url))
      const fetchStartedAt = performance.now()
      let fetchedBytes = 0
      try {
        const response = await cdnFetch(url, {
          headers: { Range: `bytes=${from}-${end}` },
        })
        if (response.status === 200) {
          // Range 被无视了：这个 host 以后别想分片，换下一个镜像
          rangeIgnoringHosts.add(hostOf(url))
          throw new Error(`分片 ${index} 返回 200（该 host 忽略 Range）`)
        }
        if (response.status !== 206 || !response.body) {
          throw new Error(`分片 ${index} 返回 ${response.status}`)
        }
        const reader = response.body.getReader()
        let offset = from
        for (;;) {
          throwIfStopped(shouldStop)
          const { done: finished, value } = await readWithTimeout(reader)
          if (finished) break
          // 各片写各自的偏移：不用在内存里按序拼装，也不用落临时分片
          await writable.write({ type: 'write', position: offset, data: value })
          offset += value.byteLength
          received += value.byteLength
          fetchedBytes += value.byteLength
          progressOfChunk.set(index, offset)
          onProgress?.({ received, total })
        }
        // 服务端给短了（206 但没给满）：不能当成功，否则文件里会留一处空洞
        if (offset <= end) throw new Error(`分片 ${index} 只到 ${offset}/${end}`)
        return true
      } catch (error) {
        if (error?.name === 'AbortError') throw error
        lastError = error
        log(`分片 ${index} 走 ${hostOf(url)} 失败（${attempt + 1}/${CHUNK_ATTEMPTS}）：${error.message}`)
      } finally {
        // 用"这批实际读到的字节 / 这段实际耗时"记这个 host 的实测吞吐
        recordHostRate(hostOf(url), fetchedBytes, performance.now() - fetchStartedAt)
        release()
      }
    }
    throw lastError || new Error(`分片 ${index} 下载失败`)
  }

  const runWorker = async workerIndex => {
    while (!failReason) {
      throwIfStopped(shouldStop)
      const index = nextIndex++
      if (index >= chunkCount) return
      try {
        await fetchChunk(index, workerIndex)
        done.add(index)
      } catch (error) {
        // 不立刻放弃：先把已写的字节留住，等这一轮并发跑完再由下面串行补齐
        failReason = failReason || error
        return
      }
    }
  }

  // 并发失败后的降级：**已写的分片一个不扔**，只把缺的按序、一条一条补回来。
  // 这样进度只会原地停一下，不会掉回 0（用户能看见的唯一一次回退就来自整体重下）。
  const fillMissingSerially = async () => {
    for (let index = 0; index < chunkCount; index++) {
      throwIfStopped(shouldStop)
      if (done.has(index)) continue
      await fetchChunk(index, 0)
      done.add(index)
    }
  }

  try {
    await Promise.all(Array.from({ length: workers }, (_, index) => runWorker(index)))
    if (failReason) {
      log(`分片并发中止（${failReason.message}），改为串行补齐剩余分片（已下的字节保留）`)
      await fillMissingSerially()
    }
    await writable.truncate(total)
    await writable.close()
    logThroughput(filename, total, startedAt, workers)
    return { fileHandle, directory, tempName, filename }
  } catch (error) {
    await writable.abort().catch(() => {})
    // 停掉/失败的临时文件别留在目录里（0 字节的 .part 也是垃圾）
    await directory.removeEntry(tempName).catch(() => {})
    throw error
  }
}

// 把临时文件改成正式名字（同目录改名）。改名是元数据操作，几乎瞬时，oho 看到 `.m4s` 时文件已经完整。
export async function publishDownloadedFile({ fileHandle, directory, tempName, filename }) {
  if (typeof fileHandle.move === 'function') {
    await fileHandle.move(filename)
    return
  }
  // 老浏览器没有 FileSystemFileHandle.move()：搬内容再用正式名，最后删掉临时文件
  const target = await directory.getFileHandle(filename, { create: true })
  const writable = await target.createWritable()
  try {
    await fileHandle.getFile().stream().pipeTo(writable)
  } catch (error) {
    await writable.abort().catch(() => {})
    throw error
  }
  await directory.removeEntry(tempName).catch(() => {})
}

export async function discardDownloadedFile({ directory, tempName }) {
  await directory.removeEntry(tempName).catch(() => {})
}

async function readAllToBlob(urls, onProgress, shouldStop) {
  // 降级路径同样是两条轨并行下，一样走 host 名额
  const { response, release } = await openFirstStream(urls, makeConnectionLimit())
  try {
    const total = Number(response.headers.get('content-length')) || 0
    const reader = response.body.getReader()
    // 攒到 ~16MB 就封一个 Blob 再丢掉引用：Chromium 会把 Blob 落到磁盘，JS 堆里只留句柄。
    // 单个视频下载走的正是这条路（不弹目录选择器），一条 4K 轨几百 MB，整份压在堆里会出事。
    const BATCH = 16 * 1024 * 1024
    const parts = []
    let batch = []
    let batched = 0
    let received = 0
    for (;;) {
      throwIfStopped(shouldStop)
      const { done, value } = await readWithTimeout(reader)
      if (done) break
      batch.push(value)
      batched += value.byteLength
      received += value.byteLength
      onProgress?.({ received, total })
      if (batched >= BATCH) {
        parts.push(new Blob(batch))
        batch = []
        batched = 0
      }
    }
    if (batch.length) parts.push(new Blob(batch))
    return new Blob(parts, { type: response.headers.get('content-type') || 'application/octet-stream' })
  } finally {
    release()
  }
}

// 降级路径：没有 File System Access（如 Firefox）时，整份读进内存再交给浏览器下载。
export async function saveStreamAsDownload(filename, urls, onProgress, shouldStop) {
  const blob = await readAllToBlob(urls, onProgress, shouldStop)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return blob.size
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = value / 1024
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index++
  }
  return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[index]}`
}

export function formatPercent(received, total) {
  if (!total) return formatBytes(received)
  return `${((received / total) * 100).toFixed(1)}% (${formatBytes(received)} / ${formatBytes(total)})`
}

// 速度：0 或未知一律给空串，让调用方自己决定省掉那一段（别显示 "0 B/s" 骗人）
export function formatSpeed(bytesPerSecond) {
  const value = Number(bytesPerSecond) || 0
  if (value <= 0) return ''
  return `${formatBytes(value)}/s`
}
