<template>
  <!-- 阅读模式开关：圆形图标按钮，位置固定，不抢正文的地方 -->
  <button class="csdn-read-toggle" :class="{ 'is-on': reading }" :title="buttonTitle" :aria-label="buttonTitle" @click="toggleReading">
    <svg class="csdn-read-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <!-- 打开的书：竖线是书脊，两侧页片 -->
      <path d="M12 6.4C10.2 5 7.7 4.3 4.2 4.6v13.2c3.4-.3 5.9.4 7.8 1.8 1.9-1.4 4.4-2.1 7.8-1.8V4.6c-3.5-.3-6 .4-7.8 1.8Z"
            fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M12 6.4v13.2" stroke="currentColor" stroke-width="1.8"/>
    </svg>
  </button>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { logger } from '../utils/logger.js'

const CONFIG_KEY = 'csdn-reading-mode'

const reading = ref(GM_getValue(CONFIG_KEY, true))
const buttonTitle = computed(() => (reading.value ? '退出干净阅读模式' : '进入干净阅读模式'))

// 正文与评论被"折叠"的地方：这些元素是遮罩/按钮，留下它们只会挡住内容
const FOLD_SELECTORS = [
  '.hide-article-box',
  '.readmore-btn',
  '#btn-readmore',
  '#readmore_btn',
  '.article-read-more',
  '.read-more-box',
  '.hide-article-tip',
  '.hide-preCode-box',
]

// 会被加上"限高 + 隐藏溢出"的容器
const CLAMP_SELECTORS = ['#article_content', '#content_views', '.article_content', '.blog-content-box article']

let observer = null
let pending = 0
let stopped = false

function clearClamp(element) {
  for (const prop of ['max-height', 'height', 'overflow', 'overflow-y', 'overflow-x']) {
    element.style.removeProperty(prop)
  }
  element.removeAttribute('height')
  element.classList.remove('set-code-hide', 'is-fold', 'fold-hide', 'article-content-fold')
}

// 页面用 max-height 卡住正文时才会留一个遮罩/展开按钮，靠它判断"这里确实被折叠了"，
// 避免无差别地把站点自己设的高度全清掉
function looksFolded() {
  return !!document.querySelector(FOLD_SELECTORS.slice(0, 6).join(','))
}

function inlineClamped(element) {
  const style = element.getAttribute('style') || ''
  return /max-height|overflow\s*:\s*hidden/i.test(style)
}

function unseal() {
  if (stopped) return

  // 1) 遮罩和"展开全文/登录查看"按钮直接删掉：内容本来就在 DOM 里
  for (const selector of FOLD_SELECTORS) {
    document.querySelectorAll(selector).forEach(element => element.remove())
  }

  // 2) 限高容器还原
  const folded = looksFolded()
  for (const selector of CLAMP_SELECTORS) {
    document.querySelectorAll(selector).forEach(element => {
      if (folded || inlineClamped(element)) clearClamp(element)
    })
  }

  // 3) 代码块折叠（CSDN 会把长代码压成一个带阴影的小框）
  document.querySelectorAll('pre.set-code-hide, pre.code-hide').forEach(pre => {
    clearClamp(pre)
    pre.querySelectorAll('.hide-preCode-box, .preCode-box').forEach(box => box.remove())
  })
  document.querySelectorAll('.set-code-show').forEach(button => button.remove())

  // 4) 评论区被折叠的那部分：它自己是"查看"链接，点一下就能展开。
  //    这里用元素上的标记而不是一次性布尔值——评论区是异步渲染的，第一次跑的时候
  //    那个链接可能还是空壳或者会被内容替换掉，用布尔值就会永久跳过后来新出现的那个。
  document.querySelectorAll('#lookFlodComment .look-more-flodcomment, .look-flod-comment a').forEach(link => {
    if (link.dataset.nihilityUnfolded) return
    link.dataset.nihilityUnfolded = '1'
    link.click()
    logger.debug('CSDN：已展开被折叠的评论')
  })

  // 5) "查看更多评论"
  document.querySelectorAll('#btnMoreComment').forEach(button => {
    if (button.dataset.nihilityClicked || !button.innerText.trim()) return
    button.dataset.nihilityClicked = '1'
    button.click()
    logger.debug('CSDN：已点开更多评论')
  })

  // 6) 页头标题和正文里那个标题是同一句时（CSDN 的 markdown 文章基本都会自带一遍），
  //    留页头那份（它是 h1、样式更正式），把正文里重复的那个藏掉
  dedupeTitle()
  // 7) 正文开头那行"作者：xxx"是普通段落，和正文同字号显得没层次，标一下降级成说明文字
  markAuthorLine()
  // 8) 统一渲染文章头（标题 + 署名），站点那三处散落的标题就别显示了
  if (reading.value) renderReadHeader()
}

function normalizeTitle(text) {
  return (text || '').replace(/\s+/g, '').trim()
}

function dedupeTitle() {
  const header = document.querySelector('.article-title-box')
  const views = document.querySelector('#content_views')
  if (!header || !views) return
  const headerTitle = normalizeTitle(header.innerText)
  if (!headerTitle) return
  views.querySelectorAll('h1, h2, h3').forEach(heading => {
    const duplicated = normalizeTitle(heading.innerText) === headerTitle
    heading.classList.toggle('csdn-heading-duplicate', duplicated)
  })
}

const AUTHOR_LINE = /^(作者|原文|本文作者|作者简介|来源|译者|编辑)\s*[:：]/

function markAuthorLine() {
  const views = document.querySelector('#content_views')
  if (!views) return
  const firstParagraphs = [...views.querySelectorAll('p')].slice(0, 3)
  firstParagraphs.forEach(paragraph => {
    const matched = AUTHOR_LINE.test(paragraph.textContent.trim())
    paragraph.classList.toggle('csdn-author-line', matched)
  })
}

// ---- 阅读模式自己的文章头：标题 + 署名行 ----
// 站点那套（页头标题 + 作者信息条 + 正文里再重复一遍标题）散在三处，字号也各不相同，
// 拼起来不像个标题。这里统一抽成"大标题 + 一行灰字署名"，下面压一条细分隔线，
// 正文从干净的位置开始。
let readHeader = null

function collectHeaderInfo() {
  const titleBox = document.querySelector('.article-title-box .title-article, .article-title-box h1')
  const contentHeading = document.querySelector('#content_views h1, #content_views h2')
  const title = (titleBox?.innerText || contentHeading?.innerText || '').trim()

  const infoText = (document.querySelector('.article-info-box')?.innerText || '').replace(/\s+/g, ' ')
  const authorParagraph = [...document.querySelectorAll('#content_views p')]
    .slice(0, 3)
    .find(paragraph => AUTHOR_LINE.test(paragraph.textContent.trim()))
  const authorText = (authorParagraph?.textContent || '').trim()

  // 作者有两条来源：正文开头的"作者：xxx"，或页头作者信息条里的名字元素
  // （新版 simple 布局是 .simple-author-name，老布局是 .follow-nickName）
  const authorFromInfo = (
    document.querySelector('.article-info-box .simple-author-name')
      ?.innerText
    || document.querySelector('.article-info-box .follow-nickName')?.innerText
    || document.querySelector('.article-info-box .simple-author-profile')?.innerText
    || ''
  ).trim()
  const author = authorText.replace(AUTHOR_LINE, '').split(/[，,]/)[0].trim() || authorFromInfo

  const date = infoText.match(/(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?)/)?.[1] || ''
  // 阅读数可能是 337 / 2.9w / 1.2万
  const views = infoText.match(/([\d.]+\s*[万亿wkWK]?)\s*(?:次)?阅读/)?.[1] || ''

  return { title, author, date, views, authorLineLength: authorText.length }
}

function renderReadHeader() {
  const content = document.querySelector('#article_content')
  if (!content) return
  const info = collectHeaderInfo()
  if (!info.title) return

  if (!readHeader || !readHeader.isConnected) {
    readHeader = document.createElement('div')
    readHeader.className = 'csdn-read-head'
    readHeader.innerHTML = '<h1 class="csdn-read-title"></h1><div class="csdn-read-meta"></div>'
    content.insertBefore(readHeader, content.firstChild)
  }

  const titleElement = readHeader.querySelector('.csdn-read-title')
  if (titleElement.textContent !== info.title) titleElement.textContent = info.title

  const metaElement = readHeader.querySelector('.csdn-read-meta')
  const parts = [info.author, info.date, info.views && `${info.views} 阅读`].filter(Boolean)
  const signature = parts.join('|')
  if (metaElement.dataset.signature !== signature) {
    metaElement.dataset.signature = signature
    metaElement.textContent = ''
    parts.forEach((part, index) => {
      if (index) {
        const dot = document.createElement('span')
        dot.className = 'csdn-read-dot'
        dot.textContent = '·'
        metaElement.appendChild(dot)
      }
      const span = document.createElement('span')
      span.textContent = part
      metaElement.appendChild(span)
    })
  }

  // 署名已经进文章头了，正文开头那行就别再重复一遍（过长的说明性段落保留）
  readHeader.dataset.absorbedAuthor = info.authorLineLength && info.authorLineLength <= 40 ? '1' : '0'
}

function removeReadHeader() {
  readHeader?.remove()
  readHeader = null
}

function scheduleUnseal() {
  if (stopped || pending) return
  pending = requestAnimationFrame(() => {
    pending = 0
    try {
      unseal()
    } catch (error) {
      logger.error('CSDN 展开失败', error)
    }
  })
}

function applyReading() {
  document.body.classList.toggle('csdn-reading', reading.value)
  // 不要摘站点自己的 class（has-simple-ad-background-skin 之类）：那会把页面皮肤永久
  // 拆坏，退出阅读模式后背景图/配色就回不来了。皮肤只在阅读模式里用 CSS 压掉。
  if (reading.value) {
    scheduleUnseal()
  } else {
    removeReadHeader()
  }
}

function toggleReading() {
  reading.value = !reading.value
  GM_setValue(CONFIG_KEY, reading.value)
  applyReading()
  // 关掉阅读模式时，之前删掉的遮罩不会自己回来（内容已经是展开状态，不影响阅读）
  scheduleUnseal()
}

onMounted(() => {
  applyReading()
  unseal()

  // 正文限高、评论、广告都是异步插进来的，所以盯着 DOM 变化再补一遍
  observer = new MutationObserver(scheduleUnseal)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  })
})

onBeforeUnmount(() => {
  stopped = true
  observer?.disconnect()
  if (pending) cancelAnimationFrame(pending)
  document.body.classList.remove('csdn-reading')
})
</script>

<style lang="scss">
body[blog-csdn-net] {
  // 广告、推广、登录弹层：不管开不开阅读模式都别出现
  pre button,
  div[id^=Advert],
  div[id$=Advert],
  .toolbar-advert,
  #articleSearchTip,
  .passport-login-container,
  .passport-login-tip-container,
  .comment-rewarddialog-box,
  .mask-dark,
  .skin-boxshadow,
  .directory-boxshadow,
  #redEnvolope,
  #rewardNew,
  .pay-code,
  #keywordDecBox,
  .copy-tip,
  #copy-tip,
  .login-mark,
  .article-copyright,
  .more-toolbox {
    display: none !important;
  }

  // 复制限制：CSS 的 user-select: none 一律顶回去（!important 能压过行内样式）
  #article_content,
  #article_content *,
  #content_views,
  #content_views *,
  .comment-list-container,
  .comment-list-container * {
    user-select: text !important;
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    -ms-user-select: text !important;
  }

  // 限高 + 隐藏溢出：兜底用 CSS 再压一遍，避免 JS 还没来得及清就被渲染成半截
  &.csdn-reading #article_content,
  &.csdn-reading #content_views {
    max-height: none !important;
    height: auto !important;
    overflow: visible !important;
  }
}

// ---------------- 干净阅读模式 ----------------
body[blog-csdn-net].csdn-reading {
  // 自己铺"白纸"：不依赖站点皮肤，避免深色广告皮肤下的黑底黑字。
  // 用 CSS 压而不是摘 class——摘了 class 退出阅读模式后皮肤就回不来了。
  &,
  #csdn-main-father-root {
    background: #fff !important;
    background-image: none !important;
  }

  // 广告位被藏了，但它给父级预留的 72px 左内边距还留着，整块正文就会偏右
  #csdn-main-father-root {
    padding-left: 0 !important;
    padding-right: 0 !important;
  }

  // 只留"正文 + 评论"，其余全部收起
  #toolbarBox,
  #csdn-toolbar,
  #csdn-blog-sidebar,
  .article-aside-container,
  .blog_container_aside,
  .recommend-box,
  .recommend-item-box,
  .simple-recommend,
  .simple-recommend__item,
  #blogExtensionBox,
  .simple-blue-card,
  .simple-article-meta,
  #simple-article-nav,
  .blog-footer-bottom,
  .toolbox-middle,
  .recommend-right,
  .comment-side-box-shadow,
  // 评论区里的东西不要动：评论列表、"查看更多评论"、点赞举报都算内容，
  // 藏掉"查看更多评论"用户就没法继续加载了
  // 两侧广告位 + 皮肤背景（部分文章是"广告皮肤"，会把整页刷成深色底，
  // 正文颜色跟不上就变成黑底黑字；连皮肤一起去掉，回到白底黑字最稳）
  .simple-ad-slot,
  .simple-ad-slot__fixed,
  .simple-ad-bg,
  #csdn-scratch-ad,
  .scratch-track,
  .csdn-vip-motion {
    display: none !important;
  }

  // 文章信息条能撑三千多像素（作者卡 + 会员推广 + AI 声明），只留标题
  .article-info-box {
    display: none !important;
  }

  // 站点给 #mainBox 写的是 max-width:1472px !important，不加 !important 压不住
  #mainBox.container {
    max-width: 860px !important;
    margin: 0 auto !important;
    padding: 0 16px !important;
  }

  main {
    display: block;
  }

  .blog-content-box {
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  // 文章头由我们自己渲染，站点那块（标题 + 作者信息条）整块不要了
  .article-header-box {
    display: none !important;
  }

  .article-title-box .title-article,
  #article_content h1 {
    font-size: 28px;
    font-weight: 700;
    line-height: 1.4;
    margin: 0 0 14px;
  }

  // ---------- 自绘文章头 ----------
  .csdn-read-head {
    margin: 10px 0 30px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(127, 127, 127, .25);

    .csdn-read-title {
      margin: 0 0 14px;
      font-size: 34px;
      font-weight: 800;
      line-height: 1.34;
      letter-spacing: .2px;
      color: #1a1a1a;
      word-break: break-word;
    }

    .csdn-read-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 13px;
      line-height: 1.6;
      color: #8b8b8b;

      .csdn-read-dot {
        color: #c4c4c4;
      }
    }
  }

  // 署名已经进文章头的话，正文开头那行就不重复显示
  .csdn-read-head[data-absorbed-author="1"] ~ #content_views .csdn-author-line,
  .csdn-read-head[data-absorbed-author="1"] ~ .markdown_views .csdn-author-line {
    display: none !important;
  }

  // 正文里那个和页头重复的标题（通常是 h2）藏掉，标题只留页头那份
  .csdn-heading-duplicate {
    display: none !important;
  }

  #article_content {
    padding: 0 0 8px !important;
  }

  #content_views {
    font-size: 16px;
    line-height: 1.85;
    // 阅读模式是白纸模式（上面已经把皮肤摘了），所以这里可以放心写深色字
    color: #1f2328;

    p {
      margin: 0 0 16px;
    }

    // "作者：xxx" 这类署名行：降一级，当说明文字。
    // 必须挂在 #content_views 下面，否则特异性输给站点的 `#content_views p`
    p.csdn-author-line {
      margin: 0 0 24px;
      font-size: 13.5px !important;
      line-height: 1.6;
      color: #8b8b8b !important;
    }

    h1, h2, h3, h4, h5 {
      margin: 32px 0 12px;
      line-height: 1.4;
    }

    h2 { font-size: 22px; }
    h3 { font-size: 19px; }

    img {
      max-width: 100%;
      height: auto;
    }

    ul, ol {
      margin: 0 0 16px;
      padding-left: 1.6em;
    }

    li {
      margin: 6px 0;
    }

    blockquote {
      margin: 16px 0;
      padding: 8px 16px;
      color: inherit;
      opacity: .85;
      border-left: 3px solid rgba(127, 127, 127, .45);
    }

    // 代码块：去掉 CSDN 那层"复制"悬浮按钮和折叠阴影。
    // 背景用半透明灰而不是写死浅色——深色皮肤下也不会糊成一片。
    pre {
      margin: 16px 0;
      padding: 14px 16px;
      overflow: auto;
      font-size: 13.5px;
      line-height: 1.6;
      border-radius: 6px;
      background: rgba(127, 127, 127, .12);
    }

    code {
      font-family: Consolas, "Panic Sans", "Bitstream Vera Sans Mono", Menlo, monospace;
    }

    // 正文里的表格别撑破容器
    table {
      display: block;
      max-width: 100%;
      overflow: auto;
    }
  }

  // 评论区：接在正文后面，和正文同宽
  .comment-list-container {
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid rgba(127, 127, 127, .25);

    .comment-list-box {
      padding: 0;
    }
  }
}

// ---------------- 开关按钮 ----------------
.csdn-read-toggle {
  position: fixed;
  right: 20px;
  bottom: 120px;
  z-index: 3;
  display: flex;
  width: 34px;
  height: 34px;
  padding: 0;
  color: #555;
  cursor: pointer;
  pointer-events: auto;
  align-items: center;
  justify-content: center;
  border: 1px solid #00000014;
  border-radius: 50%;
  background: #ffffffe6;
  box-shadow: 0 6px 18px #0000001f;
  backdrop-filter: blur(6px);
  transition: transform .12s ease, color .12s ease, background .12s ease;

  &:hover {
    color: #111;
    transform: scale(1.06);
  }

  .csdn-read-icon {
    display: block;
    width: 16px;
    height: 16px;
    flex: none;
  }

  &.is-on {
    color: #fff;
    border-color: #fc5531;
    background: #fc5531;

    &:hover {
      color: #fff;
    }
  }
}
</style>
