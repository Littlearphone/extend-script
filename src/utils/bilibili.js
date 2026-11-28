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

function toSeconds(duration, { milliseconds = false } = {}) {
  const value = Number(duration) || 0
  if (milliseconds) return Math.round(value / 1000)
  // 普通视频的 pages[].duration 是秒；个别接口给的是毫秒，只能按量级猜。
  // 番剧的接口**一律是毫秒**，所以那边要显式传 milliseconds——44 秒的彩蛋/预告
  // 折算成毫秒是 44000，按量级猜会当成 44000 秒（12:13:20）。
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

// 投稿/录播工具自动生成的分P名不是人能认的名字，页面上显示的是别的字段。
// 已见的几种：`lv_0_20260915213837`、`studio_video_1791036734034`、`IMG_20250101_120000`、纯数字。
// 判据要**宽**（宁可误判成占位、退回视频标题，也不要拿一串编号当文件名）。
function isPlaceholderName(name) {
  const value = String(name || '').trim()
  if (!value) return true
  // 纯数字（时间戳之类）
  if (/^\d{6,}$/.test(value)) return true
  // 全是 ASCII 字母数字下划线短横点空格，且含一长串数字 —— 人手写的标题不会是这种形状
  if (/^[a-z0-9_\-.\s]+$/i.test(value) && /\d{6,}/.test(value)) return true
  // `工具名_工具名_数字`（数字短也要判，如 studio_video_123）
  if (/^[a-z]{2,}[_-][a-z]{2,}[_-]\d+$/i.test(value)) return true
  return false
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
        duration: page.duration || episode.arc?.duration,
        // 按"页面上显示的那个名字"排优先级：合集列表显示的是 episode.title，
        // page.part 只是这条投稿自己的分 P 名，常常是占位编号 → 放最后。
        names: [episode.title, episode.long_title, episode.arc?.title, page.part],
      })
    }
  }
  return episodes
}

// 名字的取法只有一条规则：**页面上显示的是哪个字段，就取哪个字段**。
//   - 单 P：页面上那一集显示的就是视频标题（不是 pages[].part —— 那常是投稿工具的编号）；
//   - 多 P：页面上显示的就是 pages[].part；
//   - 合集：页面上显示的就是 episode.title。
// 只有"页面上那个字段本身就是机器编号"时才需要兜底（`isPlaceholderName` 判据），
// 而**兜底必须显式标记**（item.nameAuto）——猜错了要让人看得见，不能静默给个错名字。
function pickName(candidates, fallback) {
  for (const candidate of candidates) {
    if (candidate && !isPlaceholderName(candidate)) {
      return { name: candidate, auto: false }
    }
  }
  return { name: fallback, auto: true }
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
      duration: page.duration,
      names: [page.part],
    }))
  const multiple = list.length > 1
  const items = list.map((entry, index) => {
    // 合集里的每一集自己的 page 都是 1（各自是单 P 视频），拿它当编号会全部撞名，
    // 所以合集用列表序号、普通多 P 才用 page。
    const page = Number(entry.page) || index + 1
    const part = entry.part || (entry.names || [])[0] || ''
    const order = String(index + 1).padStart(2, '0')
    const picked = usingSeason
      ? pickName(entry.names || [], `${title}_${order}`)
      : (multiple
        ? pickName([part], `${title}_P${page}`)
        // 单 P：直接用视频标题；标题都没有才退回 part（那时要标记，让用户核对）
        : (videoData.title ? { name: videoData.title, auto: false } : pickName([part], `${title}`)))
    return {
      key: `v_${page}_${entry.bvid}`,
      kind: 'video',
      title: picked.name,
      // 名字是兜底来的 → 界面要标一下，别让人以为这就是页面上的名字
      nameAuto: picked.auto,
      prefix: safeFileName(picked.name),
      bvid: entry.bvid,
      aid: entry.aid,
      cid: entry.cid,
      page,
      duration: toSeconds(entry.duration, { milliseconds: true }),
    }
  })
  return { title, items }
}

function bangumiEpisodeList(state) {
  const candidates = [state?.epList, state?.episodes, state?.mediaInfo?.episodes]
  return candidates.find(list => Array.isArray(list) && list.length) || []
}

function normalizeBangumiEpisode(episode) {
  return {
    epId: episode.id || episode.ep_id,
    aid: episode.aid,
    bvid: episode.bvid,
    cid: episode.cid,
    title: episode.long_title || episode.share_copy || episode.title || '',
    duration: episode.duration,
  }
}

function currentEpId() {
  return Number(location.pathname.match(/\/bangumi\/play\/ep(\d+)/)?.[1]) || 0
}

function currentSeasonIdFromUrl() {
  return Number(location.pathname.match(/\/bangumi\/play\/ss(\d+)/)?.[1]) || 0
}

// 新版番剧播放页是 Next.js 那套（`__NEXT_DATA__` + `PlayerEpisodePanel_*`），
// **不再提供 `__INITIAL_STATE__`**，所以季信息得从别处找。
function findDeep(value, key, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 8) return undefined
  if (Object.prototype.hasOwnProperty.call(value, key)) return value[key]
  for (const child of Object.values(value)) {
    const found = findDeep(child, key, depth + 1)
    if (found !== undefined) return found
  }
  return undefined
}

function bangumiSeasonId(state) {
  return state?.mediaInfo?.season_id
    || pageWindow().__playinfo__?.result?.view_info?.report?.season_id
    || currentSeasonIdFromUrl()
    || findDeep(pageWindow().__NEXT_DATA__, 'season_id')
    || 0
}

async function fetchBangumiEpisodes(seasonId) {
  const json = await requestJSON(`https://api.bilibili.com/pgc/view/web/ep/list?season_id=${seasonId}`)
  return json.result?.episodes || []
}

// 按 ep_id 取整季：**不依赖页面上的任何状态**，新版老版页都能用，
// 顺手还能拿到季名（新版页面拿不到 mediaInfo 的标题）。
async function fetchBangumiSeasonByEp(epId) {
  const json = await requestJSON(`https://api.bilibili.com/pgc/view/web/season?ep_id=${epId}`)
  return {
    seasonId: json.result?.season_id || 0,
    title: json.result?.title || '',
    episodes: json.result?.episodes || [],
  }
}

async function collectBangumiItems(state) {
  let seasonTitle = state?.mediaInfo?.title || state?.h1Title || ''
  let list = bangumiEpisodeList(state).map(normalizeBangumiEpisode)

  if (!list.length) {
    // 1) 优先按 ep_id 要整季——新版播放页根本没状态，但这条路一直在
    const epId = currentEpId()
    if (epId) {
      const season = await fetchBangumiSeasonByEp(epId)
      list = season.episodes.map(normalizeBangumiEpisode)
      seasonTitle = seasonTitle || season.title
    }
    // 2) 只有 ss 号（/bangumi/play/ss123）时按 season_id 要
    if (!list.length) {
      const seasonId = bangumiSeasonId(state)
      if (seasonId) list = (await fetchBangumiEpisodes(seasonId)).map(normalizeBangumiEpisode)
    }
  }

  if (!list.length) throw new Error('拿不到这个番剧的剧集列表（ep_id 和 season_id 都没取到）')
  seasonTitle = seasonTitle || document.title
  const items = list.map((entry, index) => {
    // 标题本身就带着"第 N 话"，别再加一层编号（序号在表格的 # 列里）；前缀也用它本身。
    const picked = pickName([entry.title], `${seasonTitle}_${String(index + 1).padStart(2, '0')}`)
    return {
      key: `b_${entry.epId}`,
      kind: 'bangumi',
      title: picked.name,
      nameAuto: picked.auto,
      prefix: safeFileName(picked.name),
      epId: entry.epId,
      bvid: entry.bvid,
      aid: entry.aid,
      cid: entry.cid,
      page: index + 1,
      duration: toSeconds(entry.duration, { milliseconds: true }),
    }
  })
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

// 清晰度阶梯里挑一档：同 codecid 优先（避免同一档位的 AVC/HEVC/AV1 三份重复），
// 然后取"不高于想要的那档"里最高的一档；想要的比最低还低就取最低。
// preferQn 为空（0）＝直接要最高。
function pickVideoStream(videos, codecid, preferQn) {
  const matched = codecid ? videos.filter(video => video.codecid === codecid) : []
  const pool = (matched.length ? matched : videos).slice().sort((a, b) => a.id - b.id)
  if (!pool.length) return null
  if (!preferQn) return pool[pool.length - 1]
  const notAbove = pool.filter(video => video.id <= preferQn)
  return notAbove.length ? notAbove[notAbove.length - 1] : pool[0]
}

function pickAudioStream(audios) {
  const preferred = audios.filter(audio => AUDIO_IDS.includes(audio.id))
  const pool = preferred.length ? preferred : audios
  return pool.reduce((best, current) => (current.id > best.id ? current : best), pool[0])
}

// 把 playurl 的响应归一化。**响应里的 `dash.video[]` 是整个清晰度阶梯**（不是只有一档），
// 所以"让用户选清晰度"是在这里本地挑，不需要任何额外请求。
function normalizeStreams(data, preferQn) {
  const dash = data?.dash
  if (dash?.video?.length) {
    const video = pickVideoStream(dash.video, data.video_codecid, preferQn)
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
      // 整段流只有服务端给的那一档，挑不了
      quality: QUALITY_LABELS[data.quality] || data.quality || '未知',
      codecid: null,
      progressive: { urls: streamUrls(durl), size: durl.size || 0 },
    }
  }
  return null
}

// 页面播放器自己拿的那份流信息：不花接口，但只对"当前正在播的这条"有效，而且质量是
// 播放器当前选的那一档（不一定是最高）。所以只当接口失败时的兜底。
function playinfoStreams(item, preferQn) {
  if (item.key !== currentPlayingKey()) return null
  const raw = pageWindow().__playinfo__
  // 普通视频是 { data: { dash } }，番剧是 { result: { video_info } }，两种都认。
  const data = raw?.data?.dash || raw?.data?.durl ? raw.data : (raw?.result?.video_info || raw?.result)
  if (!data) return null
  return normalizeStreams(data, preferQn)
}

async function ugcStreams(item, qn, preferQn) {
  const params = new URLSearchParams({ qn: String(qn), fnver: '0', fnval: '4048', fourk: '1' })
  if (item.aid) params.set('avid', String(item.aid))
  if (item.bvid) params.set('bvid', item.bvid)
  if (item.cid) params.set('cid', String(item.cid))
  const json = await requestJSON(`https://api.bilibili.com/x/player/wbi/playurl?${params}`)
  const streams = normalizeStreams(json.data, preferQn)
  if (!streams) throw new Error('这个视频没有给出可用的流地址（可能是付费或地区限制）')
  return streams
}

async function bangumiStreams(item, qn, preferQn) {
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
  const streams = normalizeStreams(json.result?.video_info || json.result, preferQn)
  if (!streams) throw new Error('这个剧集没有给出可用的流地址（可能是付费或地区限制）')
  return streams
}

// MAX_QUALITY 请求用的档位码：**请求一律要 120**（"这个账号能拿到的最全一档"），
// 响应里带回来的就是整个阶梯；用户想看的其实是 preferQn——那一档在本地挑即可，
// 所以"选清晰度"是零额外请求的。
const MAX_QUALITY = 120

export async function resolveStreams(item, { preferQn } = {}) {
  try {
    return item.kind === 'bangumi'
      ? await bangumiStreams(item, MAX_QUALITY, preferQn)
      : await ugcStreams(item, MAX_QUALITY, preferQn)
  } catch (error) {
    const fallback = playinfoStreams(item, preferQn)
    if (fallback) return fallback
    throw error
  }
}
