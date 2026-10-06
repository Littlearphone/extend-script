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

// 必须在用户点击的那一次调用里执行：浏览器只认手势带来的授权。
export async function pickDirectory() {
  const picker = directoryPicker()
  if (typeof picker !== 'function') return null
  const host = pageWindow().showDirectoryPicker ? pageWindow() : window
  cachedDirectory = await picker.call(host, { mode: 'readwrite', startIn: 'downloads' })
  return cachedDirectory
}

async function fetchFirstResponse(urls) {
  let lastError = null
  for (const url of urls) {
    try {
      const response = await cdnFetch(url)
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
      return response
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('没有可用的下载地址')
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
export async function writeStreamToFile(directory, filename, urls, onProgress, { concurrency = 1 } = {}) {
  if (concurrency > 1) {
    try {
      return await writeStreamChunked(directory, filename, urls, onProgress, concurrency)
    } catch (error) {
      // 分片不可用（服务端忽略 Range / 镜像 403 / 超时 / 可用镜像不足）就悄悄退回"整段一条流"：
      // 用户要的是"下下来"，不是"必须并发"。
      log(`并发分片改用整段：${error.message}`)
      onProgress?.({ received: 0, total: 0 })
    }
  }
  return writeStreamSerial(directory, filename, urls, onProgress)
}

function log(message) {
  if (typeof logger !== 'undefined' && logger?.debug) {
    logger.debug(message)
  }
}

async function writeStreamSerial(directory, filename, urls, onProgress) {
  const tempName = tempNameFor(filename)
  const fileHandle = await directory.getFileHandle(tempName, { create: true })
  const writable = await fileHandle.createWritable()
  try {
    const response = await fetchFirstResponse(urls)
    const total = Number(response.headers.get('content-length')) || 0
    const reader = response.body.getReader()
    let received = 0
    onProgress?.({ received, total })
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      await writable.write(value)
      received += value.byteLength
      onProgress?.({ received, total })
    }
    await writable.close()
    return { fileHandle, directory, tempName, filename }
  } catch (error) {
    await writable.abort().catch(() => {})
    throw error
  }
}

// ---- 并发分片下载 ----
//
// 保守设计的原因：跨域资源**读不到协议**（`nextHopProtocol` 在没有 `Timing-Allow-Origin` 时
// 返回空串，B 站 CDN 实测没带这个头），所以分不清对面是 h1.1（每 host 6 条连接，还要和正在
// 播放的播放器抢）还是 h2/h3（一条连接多路复用）。所以只能靠"每 host 最多开几条"来兜住：
//   - 分片摊到**不同镜像 host**（`base_url` + `backup_url[]` 本来就是同一份文件的镜像）；
//   - 每个 host 最多 MAX_CONNECTIONS_PER_HOST 条，实际并发 = min(用户选的, 2 × 镜像数)；
//   - 分片请求带 `priority: 'low'`，尽量不抢播放器的带宽；
//   - 任何一片不是 206（403/200/416/超时）→ 抛错，由 writeStreamToFile 退回整段。
const CHUNK_SIZE = 4 * 1024 * 1024
const MAX_CONNECTIONS_PER_HOST = 2

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

// 用 1 字节的 Range 问出总大小；服务端不认 Range（回 200）就返回 0 = 不能分片
async function probeTotalSize(urls) {
  for (const url of urls) {
    try {
      const response = await cdnFetch(url, { headers: { Range: 'bytes=0-0' } })
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
    }
  }
  return 0
}

async function writeStreamChunked(directory, filename, urls, onProgress, concurrency) {
  const mirrors = mirrorUrls(urls)
  const workers = Math.min(concurrency, MAX_CONNECTIONS_PER_HOST * mirrors.length)
  if (workers < 2) throw new Error('可用镜像不足')
  const total = await probeTotalSize(mirrors)
  if (!total) throw new Error('服务端不支持 Range')
  if (total < CHUNK_SIZE * 2) throw new Error('文件太小，不值得分片')

  const tempName = tempNameFor(filename)
  const fileHandle = await directory.getFileHandle(tempName, { create: true })
  const writable = await fileHandle.createWritable()
  const chunkCount = Math.ceil(total / CHUNK_SIZE)
  let received = 0
  let nextIndex = 0
  let failed = null

  const runWorker = async workerIndex => {
    while (!failed) {
      const index = nextIndex++
      if (index >= chunkCount) return
      const start = index * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, total) - 1
      // 按 worker 错开起点，让同一时刻的请求尽量落在不同镜像 host 上
      const url = mirrors[(index + workerIndex) % mirrors.length]
      const response = await cdnFetch(url, {
        headers: { Range: `bytes=${start}-${end}` },
        priority: 'low',
      })
      if (response.status !== 206 || !response.body) {
        throw new Error(`分片 ${index} 返回 ${response.status}`)
      }
      const reader = response.body.getReader()
      let offset = start
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        // 各片写各自的偏移：不用在内存里按序拼装，也不用落临时分片
        await writable.write({ type: 'write', position: offset, data: value })
        offset += value.byteLength
        received += value.byteLength
        onProgress?.({ received, total })
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: workers }, (_, index) => runWorker(index).catch(error => {
      failed = failed || error
    })))
    if (failed) throw failed
    await writable.truncate(total)
    await writable.close()
    return { fileHandle, directory, tempName, filename }
  } catch (error) {
    await writable.abort().catch(() => {})
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

async function readAllToBlob(urls, onProgress) {
  const response = await fetchFirstResponse(urls)
  const total = Number(response.headers.get('content-length')) || 0
  const reader = response.body.getReader()
  const chunks = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    onProgress?.({ received, total })
  }
  return new Blob(chunks, { type: response.headers.get('content-type') || 'application/octet-stream' })
}

// 降级路径：没有 File System Access（如 Firefox）时，整份读进内存再交给浏览器下载。
export async function saveStreamAsDownload(filename, urls, onProgress) {
  const blob = await readAllToBlob(urls, onProgress)
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
