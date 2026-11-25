<template>
  <!-- 卡片化是纯 CSS（不动 V2EX 的 DOM，分页/排序都不受影响），这里只放两样东西：
       弹窗看帖、以及选中 base64 时那个小浮条。 -->
  <div class="v2ex-mask" v-if="topicOpen" @pointerdown.self="closeTopic" @click.self="closeTopic">
    <div class="v2ex-modal">
      <header class="v2ex-head">
        <div class="v2ex-title">{{ topic.title || '加载中…' }}</div>
        <div class="v2ex-head-right">
          <a v-if="topic.url" class="v2ex-plain-link" :href="topic.url" target="_blank" rel="noreferrer">原页面</a>
          <button class="v2ex-close" title="关闭（Esc）" @click="closeTopic">×</button>
        </div>
      </header>
      <div class="v2ex-meta" v-if="topic.meta">{{ topic.meta }}</div>
      <div class="v2ex-body" ref="bodyRef">
        <div class="v2ex-loading" v-if="loading">读取中…</div>
        <div class="v2ex-loading is-error" v-else-if="error">{{ error }}</div>
        <template v-else>
          <div class="v2ex-content" v-html="topic.content"></div>
          <div class="v2ex-replies" v-if="topic.replies.length">
            <div class="v2ex-reply" v-for="reply in topic.replies" :key="reply.id">
              <div class="v2ex-reply-head">
                <a class="v2ex-reply-author" :href="reply.memberUrl">{{ reply.author }}</a>
                <span class="v2ex-reply-floor">{{ reply.floor }}</span>
                <span class="v2ex-reply-time">{{ reply.time }}</span>
              </div>
              <div class="v2ex-reply-body" v-html="reply.content"></div>
            </div>
          </div>
          <div class="v2ex-body-foot">
            <span v-if="topic.totalReplies > topic.replies.length">
              只显示第一页的 {{ topic.replies.length }} 条回复（共 {{ topic.totalReplies }} 条）
            </span>
            <a v-if="topic.url" :href="topic.url" target="_blank" rel="noreferrer">在原页面查看全部</a>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- 选中 base64 时的小浮条（点一下才解码，不自动弹） -->
  <div class="v2ex-b64" v-if="b64.open" :style="{ left: `${b64.x}px`, top: `${b64.y}px` }"
       @mousedown.prevent @click="decodeSelection">
    {{ b64.label }}
  </div>
  <div class="v2ex-b64-panel" v-if="b64.open && b64.result" :style="{ left: `${b64.x}px`, top: `${b64.y + 30}px` }"
       @click.stop>
    <div class="v2ex-b64-text">{{ b64.result }}</div>
    <div class="v2ex-b64-actions">
      <button @click="copyDecoded">复制</button>
      <button @click="b64.open = false">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, nextTick } from 'vue'

// 列表里的帖子链接：/t/1259685、/t/1259685#reply35 都算
const TOPIC_PATH = /^\/t\/(\d+)/
// imgur 有防盗链，借一个公共代理；失败会退回原链接（不是留个破图）
const IMGUR_PROXY = 'https://img.noobzone.ru/getimg.php?url='
// 只解码"像 base64 且不太短"的选区，避免选个 abc 也弹
const BASE64_PATTERN = /[A-Za-z0-9+/=]{8,}/

const topicOpen = ref(false)
const loading = ref(false)
const error = ref('')
const bodyRef = ref(null)
let listPage = false
let requestId = 0

const topic = reactive({
  id: '',
  title: '',
  meta: '',
  content: '',
  url: '',
  replies: [],
  totalReplies: 0,
})

const b64 = reactive({ open: false, x: 0, y: 0, label: '', text: '', result: '' })

function topicIdOf(href) {
  try {
    const url = new URL(href, location.href)
    if (url.hostname !== location.hostname) return ''
    return url.pathname.match(TOPIC_PATH)?.[1] || ''
  } catch (error) {
    return ''
  }
}

function onDocumentClick(event) {
  // 让浏览器自己处理"新标签打开"和按住修饰键的点击
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  if (!listPage) return
  const anchor = event.target?.closest?.('a[href]')
  if (!anchor) return
  const id = topicIdOf(anchor.getAttribute('href'))
  if (!id) return
  // 头像/节点/作者这些链接不是帖子，别拦
  if (anchor.closest('.cell.item') && !anchor.closest('.item_title, .topic_info')) return
  event.preventDefault()
  openTopic(id)
}

async function openTopic(id) {
  const current = ++requestId
  topicOpen.value = true
  loading.value = true
  error.value = ''
  topic.id = id
  topic.title = ''
  topic.meta = ''
  topic.content = ''
  topic.replies = []
  topic.totalReplies = 0
  topic.url = `${location.origin}/t/${id}`
  try {
    // 回复不在 /api/topics/show.json 里（只有正文），所以直接抓页面 HTML 解析
    const response = await fetch(topic.url, { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const html = await response.text()
    if (current !== requestId) return
    fillTopic(new DOMParser().parseFromString(html, 'text/html'))
  } catch (err) {
    if (current === requestId) error.value = `读取失败：${err.message || err}`
  } finally {
    if (current === requestId) loading.value = false
  }
  await nextTick()
  processImages(bodyRef.value)
}

function fillTopic(doc) {
  const main = doc.querySelector('#Main') || doc.body
  topic.title = main.querySelector('.header h1')?.textContent.trim() || doc.title.replace(/ - V2EX$/, '')
  // 作者 · 时间 · 浏览数，原样搬过来（它是"作者 · 时间 · N views"）
  topic.meta = main.querySelector('.header small.gray, .header .gray')?.textContent.replace(/\s+/g, ' ').trim() || ''
  topic.content = main.querySelector('.topic_content')?.innerHTML || '<p class="v2ex-empty">（这条没有正文）</p>'

  const replies = []
  main.querySelectorAll('.cell[id^="r_"]').forEach(cell => {
    const content = cell.querySelector('.reply_content')
    if (!content) return
    const authorLink = cell.querySelector('.dark')
    replies.push({
      id: cell.id,
      author: authorLink?.textContent.trim() || '匿名',
      memberUrl: authorLink?.getAttribute('href') || '#',
      floor: cell.querySelector('.no')?.textContent.trim().replace(/^#?/, '#') || '',
      time: cell.querySelector('.ago')?.getAttribute('title') || cell.querySelector('.ago')?.textContent.trim() || '',
      content: content.innerHTML,
    })
  })
  topic.replies = replies
  const totalText = main.querySelector('#topic-replies .gray')?.textContent || ''
  topic.totalReplies = Number(totalText.match(/(\d+)/)?.[1]) || replies.length
}

function closeTopic() {
  topicOpen.value = false
  requestId++
}

// ---- 图片：imgur 走代理，其他图去掉 referer；代理挂了就退回一条链接 ----
function processImages(root) {
  if (!root) return
  // V2EX 里有人把图片地址当纯文本贴（<a> 文字就是 URL），转成 <img>
  root.querySelectorAll('a[href]').forEach(anchor => {
    if (anchor.children.length) return
    const href = anchor.getAttribute('href') || ''
    if (!/^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(href)) return
    if (anchor.textContent.trim() !== href) return
    const image = document.createElement('img')
    image.src = href
    anchor.replaceWith(image)
  })

  root.querySelectorAll('img').forEach(image => {
    image.setAttribute('loading', 'lazy')
    image.setAttribute('referrerpolicy', 'no-referrer')
    const src = image.getAttribute('src') || ''
    if (!/imgur\.com/i.test(src)) return
    image.dataset.originUrl = src
    image.src = IMGUR_PROXY + src
    image.addEventListener('error', () => {
      const link = document.createElement('a')
      link.href = image.dataset.originUrl
      link.textContent = image.dataset.originUrl
      link.target = '_blank'
      link.rel = 'noreferrer'
      link.className = 'v2ex-broken-image'
      image.replaceWith(link)
    }, { once: true })
  })
}

// ---- 选中 base64 → 点一下解码 ----
function onMouseUp(event) {
  const text = window.getSelection()?.toString() || ''
  const matched = text.match(BASE64_PATTERN)
  if (!matched) {
    b64.open = false
    return
  }
  b64.text = matched[0]
  b64.result = ''
  b64.open = true
  b64.label = `解码这段 Base64（${b64.text.length} 字符）`
  b64.x = Math.min(event.clientX, window.innerWidth - 280)
  b64.y = Math.min(event.clientY + 10, window.innerHeight - 60)
}

// atob 只给 Latin-1；转成字节再 Blob 解码，带中文的 base64 才不会乱码
async function decodeSelection() {
  try {
    const binary = atob(b64.text)
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    const text = await new Blob([bytes]).text()
    b64.result = text.trim() || '（解出来是空内容）'
  } catch (err) {
    b64.result = '解码失败：这段不是合法的 Base64'
  }
}

async function copyDecoded() {
  try {
    await navigator.clipboard.writeText(b64.result)
  } catch (err) {
    // 剪贴板被拒就退回到选区 + execCommand，老办法但能兜住
    const area = document.createElement('textarea')
    area.value = b64.result
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

function onKeydown(event) {
  if (event.key === 'Escape' && topicOpen.value) closeTopic()
  else if (event.key === 'Escape' && b64.open) b64.open = false
}

function onPointerDownOutside(event) {
  if (!b64.open) return
  if (event.target.closest('.v2ex-b64, .v2ex-b64-panel')) return
  b64.open = false
}

onMounted(() => {
  // 列表页才接管点击；帖子页保持原样（否则"下一页"/引用链接也会被弹窗吃掉）
  listPage = !!document.querySelector('#Main .cell.item')
  document.body.setAttribute('v2ex-view', listPage ? 'list' : 'topic')
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDownOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDownOutside)
  document.body.removeAttribute('v2ex-view')
})
</script>

<style lang="scss">
// ---------- 列表：把原来的表格行改成卡片（纯视觉，不动 DOM） ----------
html:has([v2ex-view=list]) {
  #Main {
    .box {
      background: transparent;
      border: 0;
      box-shadow: none;
    }

    // 每个帖子的行
    .cell.item {
      margin-bottom: 10px;
      padding: 14px 16px;
      background: #fff;
      border-radius: 10px;
      border: 1px solid #0000000f;
      box-shadow: 0 1px 2px #0000000a;
      transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
      cursor: pointer;

      &:hover {
        transform: translateY(-1px);
        border-color: #0000001a;
        box-shadow: 0 6px 18px #00000012;
      }

      // 表格只用来排版，别让它画出格子
      table, tr, td {
        border: 0 !important;
        background: transparent !important;
      }

      .item_title a {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
        text-decoration: none;

        &:hover {
          color: #333;
          text-decoration: underline;
        }
      }

      .topic_info {
        display: inline-block;
        margin-top: 6px;
        font-size: 12.5px;
        color: #8d8d8d;

        a {
          color: #6a6a6a;
        }

        .node {
          padding: 1px 6px;
          border-radius: 4px;
          background: #f3f3f3;
        }
      }

      // 右侧回复数：做成一个小徽标
      .count_livid {
        display: inline-block;
        min-width: 2.2em;
        padding: 2px 7px;
        font-size: 12px;
        text-align: center;
        color: #4f86d6;
        border-radius: 999px;
        background: #4f86d614;
      }
    }
  }
}

// ---------- 弹窗 ----------
.v2ex-mask {
  position: fixed;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  background: #00000059;
  backdrop-filter: blur(2px);
}

.v2ex-modal {
  display: flex;
  flex-direction: column;
  width: min(860px, 92vw);
  max-height: 86vh;
  overflow: hidden;
  font-size: 14px;
  color: #1a1a1a;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 18px 60px #00000040;
}

.v2ex-head {
  display: flex;
  flex: none;
  gap: 12px;
  padding: 14px 16px;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid #0000000f;

  .v2ex-title {
    font-size: 17px;
    font-weight: 700;
    line-height: 1.45;
    word-break: break-word;
  }

  .v2ex-head-right {
    display: flex;
    flex: none;
    gap: 8px;
    align-items: center;
  }

  .v2ex-plain-link {
    font-size: 12px;
    color: #4f86d6;
    white-space: nowrap;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .v2ex-close {
    flex: none;
    width: 26px;
    height: 26px;
    font-size: 18px;
    line-height: 1;
    color: #666;
    cursor: pointer;
    border: 0;
    border-radius: 6px;
    background: #0000000a;

    &:hover {
      color: #111;
      background: #00000014;
    }
  }
}

.v2ex-meta {
  flex: none;
  padding: 8px 16px;
  font-size: 12px;
  color: #8d8d8d;
  border-bottom: 1px solid #0000000f;
}

.v2ex-body {
  flex: 1;
  padding: 4px 16px 16px;
  overflow: auto;
  overscroll-behavior: contain;
}

.v2ex-loading {
  padding: 40px 0;
  color: #999;
  text-align: center;

  &.is-error {
    color: #d9534f;
  }
}

.v2ex-content,
.v2ex-reply-body {
  line-height: 1.75;
  word-break: break-word;

  img {
    max-width: 100%;
    height: auto;
    margin: 8px 0;
    border-radius: 6px;
  }

  a {
    color: #4f86d6;
    word-break: break-all;
  }

  pre {
    padding: 10px;
    overflow: auto;
    font-size: 12.5px;
    border-radius: 6px;
    background: #f6f6f6;
  }

  blockquote {
    margin: 8px 0;
    padding: 4px 12px;
    color: #666;
    border-left: 3px solid #e0e0e0;
  }
}

.v2ex-content {
  padding: 12px 0 16px;
  font-size: 14.5px;
}

.v2ex-replies {
  border-top: 1px solid #0000000f;
}

.v2ex-reply {
  padding: 12px 0;
  border-bottom: 1px solid #00000008;

  &:last-child {
    border-bottom: 0;
  }
}

.v2ex-reply-head {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-bottom: 4px;
  font-size: 12.5px;

  .v2ex-reply-author {
    font-weight: 600;
    color: #333;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  .v2ex-reply-floor {
    color: #4f86d6;
  }

  .v2ex-reply-time {
    color: #aaa;
  }
}

.v2ex-body-foot {
  display: flex;
  gap: 12px;
  padding-top: 14px;
  font-size: 12.5px;
  color: #999;

  a {
    color: #4f86d6;
  }
}

.v2ex-empty {
  color: #aaa;
}

.v2ex-broken-image {
  word-break: break-all;
  color: #d9534f;
}

// ---------- base64 浮条 ----------
.v2ex-b64 {
  position: fixed;
  z-index: 3;
  padding: 6px 12px;
  font-size: 12.5px;
  color: #fff;
  cursor: pointer;
  border-radius: 999px;
  pointer-events: auto;
  white-space: nowrap;
  background: #4f86d6;
  box-shadow: 0 6px 20px #00000026;

  &:hover {
    background: #3f74c4;
  }
}

.v2ex-b64-panel {
  position: fixed;
  z-index: 3;
  width: min(460px, 86vw);
  padding: 10px 12px;
  font-size: 13px;
  color: #1a1a1a;
  pointer-events: auto;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 10px 30px #00000033;

  .v2ex-b64-text {
    max-height: 40vh;
    overflow: auto;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .v2ex-b64-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;

    button {
      padding: 3px 10px;
      font-size: 12px;
      color: #4f86d6;
      cursor: pointer;
      border: 1px solid #4f86d640;
      border-radius: 6px;
      background: #4f86d614;

      &:hover {
        background: #4f86d626;
      }
    }
  }
}
</style>
