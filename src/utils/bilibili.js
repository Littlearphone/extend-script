// B 站取流：只做两件事——列出"完整的视频"，拿到它的 DASH 音视频地址。
// 合并交给 oho（tools/oho 的 mix 能力）：两条轨按 <前缀>_1.m4s / <前缀>_2.m4s 落在同一个目录里，
// oho 按"同词干 + 轨道互补"自动配对。所以这里只保证"一集 = 一条视频 + 一条音频"。

const QUALITY_LABELS = {
  126: '杜比视界', 125: 'HDR', 120: '4K', 116: '1080P60', 112: '1080P+', 100: '智能修复',
  80: '1080P', 74: '720P60', 64: '720P', 32: '480P', 16: '360P', 6: '240P',
}

// 音频轨按码率从高到低：30280 (192K) / 30232 (132K) / 30216 (64K)。
// 30250 是杜比全景声（EC-3），只在没有普通轨时才用——它不是所有播放器都认。
const AUDIO_IDS = [30280, 30232, 30216]

function pageWindow() {
  return typeof unsafeWindow === 'undefined' ? window : unsafeWindow
}

// 必须走页面世界的 fetch：同源请求自带 cookie，Referer 也自动是当前页，B 站的 API 与 CDN 才认。
function pageFetch(url, init) {
  const fetchImpl = pageWindow().fetch || fetch
  return fetchImpl.call(pageWindow(), url, init)
}

export function safeFileName(name) {
  return String(name ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || '未命名'
}

function toSeconds(duration) {
  const value = Number(duration) || 0
  // 普通视频的 pages[].duration 是秒，番剧 epList[].duration 是毫秒，只能按量级猜。
  return value > 24 * 3600 ? Math.round(value / 1000) : Math.round(value)
}

export function formatDuration(duration) {
  const total = toSeconds(duration)
  if (!total) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = value => String(value).padStart(2, '0')
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

export function isBangumiPage() {
  return /\/bangumi\/play\//.test(location.pathname)
}

// 当前页面正在播的是哪一条：只有它才能白拿 __playinfo__（其余条目得问接口）。
export function currentPlayingKey() {
  const epId = location.pathname.match(/\/bangumi\/play\/ep(\d+)/)?.[1]
  if (epId) return `b_${epId}`
  const params = new URLSearchParams(location.search)
  const bvid = location.pathname.match(/\/video\/(BV[0-9A-Za-z]+)/)?.[1] || params.get('bvid')
  if (!bvid) return ''
  return `v_${Number(params.get('p') || 1)}_${bvid}`
}

function flattenSeason(season) {
  const episodes = []
  for (const section of season?.sections || []) {
    for (const episode of section.episodes || []) {
      const page = episode.page || {}
      episodes.push({
        bvid: episode.bvid || page.bvid,
        aid: episode.aid ?? page.aid,
        cid: episode.cid ?? page.cid,
        page: page.page,
        part: page.part || episode.arc?.title || '',
        duration: page.duration || episode.arc?.duration,
      })
    }
  }
  return episodes
}

function collectUgcItems(state) {
  const videoData = state?.videoData
  if (!videoData?.bvid) {
    throw new Error('拿不到这个页面的视频信息（__INITIAL_STATE__ 不在，试试刷新页面）')
  }
  // 合集（ugc_season）里每一集都是**独立视频**，比"当前视频的分 P"更全，优先用它。
  const episodes = flattenSeason(videoData.ugc_season)
  const usingSeason = episodes.length > 1
  const title = (usingSeason && videoData.ugc_season?.title) || videoData.title || document.title
  const list = usingSeason
    ? episodes
    : (videoData.pages || []).map(page => ({
      bvid: page.bvid || videoData.bvid,
      aid: page.aid ?? videoData.aid,
      cid: page.cid,
      page: page.page,
      part: page.part || '',
      duration: page.duration,
    }))
  const multiple = list.length > 1
  const items = list.map((entry, index) => {
    // 合集里的每一集自己的 page 都是 1（各自是单 P 视频），拿它当编号会全部撞名，
    // 所以合集用列表序号、普通多 P 才用 page。
    const page = Number(entry.page) || index + 1
    const part = entry.part || ''
    const order = String(index + 1).padStart(2, '0')
    const prefixBase = usingSeason
      ? `${title}_${order}${part ? `_${part}` : ''}`
      : (multiple ? `${title}_P${page}` : title)
    return {
      key: `v_${page}_${entry.bvid}`,
      kind: 'video',
      title: usingSeason ? (part || title) : (multiple ? `P${page} ${part || title}` : (part || title)),
      prefix: safeFileName(prefixBase),
      bvid: entry.bvid,
      aid: entry.aid,
      cid: entry.cid,
      page,
      duration: toSeconds(entry.duration),
    }
  })
  return { title, items }
}

function bangumiEpisodeList(state) {
  const candidates = [state?.epList, state?.episodes, state?.mediaInfo?.episodes]
  return candidates.find(list => Array.isArray(list) && list.length) || []
}

async function fetchBangumiEpisodes(seasonId) {
  const json = await requestJSON(`https://api.bilibili.com/pgc/view/web/ep/list?season_id=${seasonId}`)
  return json.result?.episodes || []
}

async function collectBangumiItems(state) {
  const seasonTitle = state?.mediaInfo?.title || state?.h1Title || document.title
  const seasonId = state?.mediaInfo?.season_id
    || pageWindow().__playinfo__?.result?.view_info?.report?.season_id
  let list = bangumiEpisodeList(state).map(episode => ({
    epId: episode.id || episode.ep_id,
    aid: episode.aid,
    bvid: episode.bvid,
    cid: episode.cid,
    title: episode.long_title || episode.share_copy || episode.title || '',
    duration: episode.duration,
  }))
  if (!list.length) {
    if (!seasonId) throw new Error('拿不到这个番剧的剧集列表（season_id 不在页面上）')
    list = (await fetchBangumiEpisodes(seasonId)).map(episode => ({
      epId: episode.id || episode.ep_id,
      aid: episode.aid,
      bvid: episode.bvid,
      cid: episode.cid,
      title: episode.long_title || episode.share_copy || episode.title || '',
      duration: episode.duration,
    }))
  }
  if (!list.length) throw new Error('这个番剧没有可下载的剧集')
  const items = list.map((entry, index) => ({
    key: `b_${entry.epId}`,
    kind: 'bangumi',
    // 标题本身就带着"第 N 话"，别再加一层编号（序号在表格的 # 列里）。
    title: entry.title || `第${index + 1}话`,
    prefix: safeFileName(`${seasonTitle}_${String(index + 1).padStart(2, '0')}_${entry.title}`),
    epId: entry.epId,
    bvid: entry.bvid,
    aid: entry.aid,
    cid: entry.cid,
    page: index + 1,
    duration: toSeconds(entry.duration),
  }))
  return { title: seasonTitle, items }
}

export async function collectVideoItems() {
  const state = pageWindow().__INITIAL_STATE__
  return isBangumiPage() ? collectBangumiItems(state) : collectUgcItems(state)
}

async function requestJSON(url) {
  const response = await pageFetch(url, { credentials: 'include' })
  if (!response.ok) throw new Error(`接口返回 HTTP ${response.status}`)
  const json = await response.json()
  if (json.code) throw new Error(`${json.message || '接口报错'}（code ${json.code}）`)
  return json
}

// 地址一律升到 https，并带上备份域名——B 站的 CDN 经常有节点不通，多一条就多一次机会。
// DASH 流的字段是 base_url，整段流（durl）的字段是 url，两种都认。
function streamUrls(stream) {
  const urls = [stream?.base_url || stream?.url, ...(stream?.backup_url || [])].filter(Boolean)
  return [...new Set(urls.map(url => url.startsWith('http://') ? `https://${url.slice(7)}` : url))]
}

function pickVideoStream(videos, codecid) {
  const matched = codecid ? videos.filter(video => video.codecid === codecid) : []
  const pool = matched.length ? matched : videos
  return pool.reduce((best, current) => (current.id > best.id ? current : best), pool[0])
}

function pickAudioStream(audios) {
  const preferred = audios.filter(audio => AUDIO_IDS.includes(audio.id))
  const pool = preferred.length ? preferred : audios
  return pool.reduce((best, current) => (current.id > best.id ? current : best), pool[0])
}

function normalizeStreams(data) {
  const dash = data?.dash
  if (dash?.video?.length) {
    const video = pickVideoStream(dash.video, data.video_codecid)
    const audio = dash.audio?.length ? pickAudioStream(dash.audio) : null
    return {
      mode: 'dash',
      quality: QUALITY_LABELS[video.id] || `qn${video.id}`,
      codecid: video.codecid,
      video: { urls: streamUrls(video), size: video.size || 0 },
      audio: audio ? { urls: streamUrls(audio), size: audio.size || 0, id: audio.id } : null,
    }
  }
  const durl = data?.durl?.[0]
  if (durl?.url) {
    return {
      mode: 'progressive',
      quality: QUALITY_LABELS[data.quality] || data.quality || '未知',
      codecid: null,
      progressive: { urls: streamUrls(durl), size: durl.size || 0 },
    }
  }
  return null
}

// 页面播放器自己拿的那份流信息：不花接口，但只对"当前正在播的这条"有效，而且质量是
// 播放器当前选的那一档（不一定是最高）。所以只当接口失败时的兜底。
function playinfoStreams(item) {
  if (item.key !== currentPlayingKey()) return null
  const raw = pageWindow().__playinfo__
  // 普通视频是 { data: { dash } }，番剧是 { result: { video_info } }，两种都认。
  const data = raw?.data?.dash || raw?.data?.durl ? raw.data : (raw?.result?.video_info || raw?.result)
  if (!data) return null
  return normalizeStreams(data)
}

async function ugcStreams(item, qn) {
  const params = new URLSearchParams({ qn: String(qn), fnver: '0', fnval: '4048', fourk: '1' })
  if (item.aid) params.set('avid', String(item.aid))
  if (item.bvid) params.set('bvid', item.bvid)
  if (item.cid) params.set('cid', String(item.cid))
  const json = await requestJSON(`https://api.bilibili.com/x/player/wbi/playurl?${params}`)
  const streams = normalizeStreams(json.data)
  if (!streams) throw new Error('这个视频没有给出可用的流地址（可能是付费或地区限制）')
  return streams
}

async function bangumiStreams(item, qn) {
  const params = new URLSearchParams({
    support_multi_audio: 'true',
    ep_id: String(item.epId),
    qn: String(qn),
    fnver: '0',
    fnval: '16',
    fourk: '1',
    from_client: 'BROWSER',
  })
  const json = await requestJSON(`https://api.bilibili.com/pgc/player/web/v2/playurl?${params}`)
  const streams = normalizeStreams(json.result?.video_info || json.result)
  if (!streams) throw new Error('这个剧集没有给出可用的流地址（可能是付费或地区限制）')
  return streams
}

export async function resolveStreams(item, { qn = 120 } = {}) {
  try {
    // 先问接口：只有它会按 qn=120 去要"这个账号能拿到的最高清晰度"，
    // __playinfo__ 里是播放器当前选的那一档（常常是 1080P）。
    return item.kind === 'bangumi' ? await bangumiStreams(item, qn) : await ugcStreams(item, qn)
  } catch (error) {
    const fallback = playinfoStreams(item)
    if (fallback) return fallback
    throw error
  }
}
