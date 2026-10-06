// 落盘：优先用 File System Access（能挑目录、边下边写、不整份占内存），
// 浏览器不支持时降级成 blob + <a download>（整份进内存，只能落进下载目录）。

function pageWindow() {
  return typeof unsafeWindow === 'undefined' ? window : unsafeWindow
}

// CDN 地址是带 token 签名的，不需要 cookie；反过来带上 credentials 反而会被
// `Access-Control-Allow-Origin: *` 拒掉——所以这里刻意用默认的 same-origin 语义。
function cdnFetch(url) {
  const fetchImpl = pageWindow().fetch || fetch
  return fetchImpl.call(pageWindow(), url)
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

export async function writeStreamToFile(directory, filename, urls, onProgress) {
  const fileHandle = await directory.getFileHandle(filename, { create: true })
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
    return received
  } catch (error) {
    await writable.abort().catch(() => {})
    throw error
  }
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
