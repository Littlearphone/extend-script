<template>
  <!-- 设置只从油猴面板菜单进（「脚本设置」）：浮动按钮在网页全屏时本来就够不着，
       而菜单永远挡不住，还省掉一个会盖在视频上的浮层。 -->
  <SettingsDialog v-if="settingsDialogOpen" title="脚本设置" @close="settingsDialogOpen = false">
    <SettingsContent
      v-model:inject-config="injectConfig"
      v-model:full-web-screen="fullWebScreen"
      v-model:playback-rate="playbackRate"
      :speed-adjustable="speedAdjustable"
      :show-download="downloadEntryVisible"
      :download-text="downloadEntryText"
      @open-download="openDownloadFromSettings"/>
  </SettingsDialog>
  <VideoDownloadDialog v-if="videoDownloadState.dialogOpen"/>
</template>
<script setup>
import SettingsContent from '../components/SettingsContent.vue'
import SettingsDialog from '../components/SettingsDialog.vue'
import VideoDownloadDialog from '../components/VideoDownloadDialog.vue'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { openDownloadDialog, videoDownloadState } from '../utils/bilibili-download-state.js'
import { setMenuCommand } from '../utils/script-menu.js'

const CONFIG_KEY = 'bilibili-hack-config'

const config = reactive(JSON.parse(GM_getValue(CONFIG_KEY, '{}')))
const injectConfig = ref(config.injectConfig || false)
const fullWebScreen = ref(config.fullWebScreen || false)
const playbackRate = ref(config.playbackRate || 1.25)
// 直播没有倍速这回事，也就不该在设置里提供：直接按页面类型判。
// （原来只想靠"看到直播间状态图标就关掉"，但直播页在 detectVideoPlaying 里提前 return，
// 根本走不到那一步，于是 live 的设置里一直摆着滑杆。）
const speedAdjustable = ref(location.hostname !== 'live.bilibili.com')
// 只有 www.bilibili.com 的页面拿得到可下载的视频信息；直播与动态页不摆这个入口。
const downloadEntryVisible = computed(() => location.hostname === 'www.bilibili.com')
// 下载中就在这个按钮上显示 n/m——面板可能被收起来，所以进度来自共享状态而不是弹窗组件。
const downloadEntryText = computed(() => videoDownloadState.running
  ? `下载中 ${videoDownloadState.finished}/${videoDownloadState.total}`
  : (videoDownloadState.finished ? `视频下载 · 已下 ${videoDownloadState.finished} 个` : '视频下载'))

// 油猴面板里的菜单项（点扩展图标弹出的那个）。菜单是"当前标签页里活跃脚本注册了什么"，
// 所以这里按页面挑：只在顶层窗口、且真是能下载的页面注册；文案顺带当进度用。
//
// 菜单只能放"文本 + 回调"，放不下滑块/输入框/表格，所以它的定位是**把该弹的框叫出来**：
//   「视频下载」→ 下载列表弹窗；「脚本设置」→ 与浮动面板同一套控件（SettingsContent.vue）。
const DOWNLOAD_MENU_KEY = 'bilibili-download'
const SETTINGS_MENU_KEY = 'bilibili-settings'
const settingsDialogOpen = ref(false)
const downloadMenuName = computed(() => videoDownloadState.running
  ? `视频下载（下载中 ${videoDownloadState.finished}/${videoDownloadState.total}）`
  : '视频下载')

function refreshScriptMenus() {
  if (window.top !== window) {
    return
  }
  // 「脚本设置」只要本视图挂上了、且设置弹窗真的显示得出来就注册（浮动按钮已经去掉，这是唯一入口）；
  // 「视频下载」只在能拿到视频信息的页面注册。
  // t.bilibili.com 不注册：那一页的 CSS 把整个 [data-id=nihility-entry] 藏了，弹窗根本显示不出来。
  const host = location.hostname
  const isVideoPage = host === 'www.bilibili.com' && /^\/(video|bangumi\/play)\//.test(location.pathname)
  const settingsAvailable = isVideoPage || (host === 'live.bilibili.com' && location.pathname.length > 1)
  if (settingsAvailable) {
    setMenuCommand(SETTINGS_MENU_KEY, '脚本设置', openSettingsList, {
      accessKey: 's',
      title: '打开脚本设置（与浮动面板同一套）',
      clickedFrame: true,
    })
  }
  if (isVideoPage) {
    setMenuCommand(DOWNLOAD_MENU_KEY, downloadMenuName.value, openDownloadList, {
      accessKey: 'd',
      title: '打开 B 站视频下载列表',
      clickedFrame: true,
    })
  }
}

// 菜单点下去要真的能看见东西：
//   - **网页全屏**（脚本自己开的那个，纯 CSS）不受影响；
//   - **真·全屏**（Fullscreen API）时浏览器只把全屏元素画在最上层，我们的浮层在它底下 → 先退出全屏，
//     否则用户看到的是"点了没反应"。退不出来也照样开，不因为这一步把功能卡死。
async function exitFullscreenIfNeeded() {
  if (!document.fullscreenElement) {
    return
  }
  try {
    await document.exitFullscreen()
  } catch (error) {
    logger.debug('退出全屏失败，仍然尝试打开弹窗')
  }
}

async function openDownloadList() {
  await exitFullscreenIfNeeded()
  settingsDialogOpen.value = false
  openDownloadDialog()
}

async function openSettingsList() {
  await exitFullscreenIfNeeded()
  settingsDialogOpen.value = true
}

// 弹窗里点「视频下载」：先收起设置框，免得两层叠着
function openDownloadFromSettings() {
  settingsDialogOpen.value = false
  openDownloadDialog()
}

// 进度一变就把菜单文案改掉（同一条目走 id 更新，不会越挂越多条）
watch(downloadMenuName, refreshScriptMenus)
watch(injectConfig, value => {
  config.injectConfig = value
  GM_setValue(CONFIG_KEY, JSON.stringify({ ...config }))
  nextTick(() => top.location.reload())
})
watch(fullWebScreen, value => {
  config.fullWebScreen = value
  GM_setValue(CONFIG_KEY, JSON.stringify({ ...config }))
})
watch(playbackRate, value => {
  config.playbackRate = value || config.playbackRate
  GM_setValue(CONFIG_KEY, JSON.stringify({ ...config }))
})

function fullscreenButtonArea() {
  const selector = [
    '.squirtle-video-pagefullscreen',
    '.bilibili-player-video-web-fullscreen',
    '.bpx-player-ctrl-web:not(.bpx-state-entered)'
  ].join(',')
  return document.querySelector(selector)
}

let handlingVideoEnded = false
let livePollingActive = false

function isLastEpisode() {
  // 查找当前视频所在的剧集/合集列表，判断是否为最后一集
  const episodeContainers = [
    '.video-sections-content-list',      // 多P视频列表
    '.base-video-sections-v1',           // 新版合集
    '.video-pod__list',                  // 播单
  ]
  for (const selector of episodeContainers) {
    const container = document.querySelector(selector)
    if (!container) continue
    const activeItem = container.querySelector('.active, [class*="active"]')
    if (!activeItem) continue
    // 检查后面是否还有同级剧集项
    const nextSibling = activeItem.nextElementSibling
    if (nextSibling && nextSibling.matches('a, li, div')) {
      return false // 还有下一集
    }
    return true // 当前列表最后一项
  }
  // 没找到任何剧集列表 → 单独视频，阻止跳到推荐
  return true
}

function playNextVideo(e) {
  if (handlingVideoEnded || !e.target.ended) {
    return
  }
  handlingVideoEnded = true
  logger.debug('视频播放结束', () => console.trace())

  const nextButton = document.querySelector('.bpx-player-ctrl-next')

  // 无下一集按钮 或 已是剧集最后一集 → 关闭推荐弹窗，不跳转
  if (!nextButton || isLastEpisode()) {
    const cancelRelated = document.querySelector('.bpx-player-ending-related-item-cancel')
    if (cancelRelated) {
      cancelRelated.click()
    }
    handlingVideoEnded = false
    return
  }

  if (!document.querySelector('.bpx-player-ctrl-setting-loop input').checked) {
    nextButton.click()
  }
  handlingVideoEnded = false
  return detectVideoPlaying()
}

function listeningVideoFinish() {
  const video = document.querySelector('video')
  if (!video || video.closest('#hot_module_player')) return
  if (video.ended) {
    return playNextVideo({ target: video })
  }
  // 视频离开 ended 状态（用户回播后），重置防重入标志
  handlingVideoEnded = false
  video.addEventListener('ended', playNextVideo)
}

function triggerLiveWebFullScreen() {
  if (!livePollingActive || document.querySelector('.player-full-win')) {
    return
  }
  const video = document.querySelector('video')
  video?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
  const fullWebScreen = document.querySelector('.web-player-controller-wrap .right-area .tip-wrap:nth-child(2) svg')
  if (fullWebScreen) {
    fullWebScreen.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }
  // document.body.classList.add('player-full-win', 'over-hidden', 'hide-aside-area')
  return setTimeout(triggerLiveWebFullScreen, 100)
}

function triggerLiveHideRoomAside() {
  if (!livePollingActive || document.querySelector('.player-full-win.hide-aside-area')) {
    return
  }
  const asideButton = document.querySelector('.player-full-win #aside-area-toggle-btn')
  if (asideButton && !document.querySelector('.hide-aside-area')) {
    asideButton.click()
  }
  return setTimeout(triggerLiveHideRoomAside, 100)
}

function triggerLiveQualityOriginal() {
  if (!livePollingActive) return
  const selectedQuality = document.querySelector('.quality-wrap .selected-qn')
  if (!selectedQuality) {
    const video = document.querySelector('video')
    video?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    return setTimeout(triggerLiveQualityOriginal, 100)
  }
  if (selectedQuality.innerText.trim() === '原画') {
    return
  }
  const asideButton = document.querySelector('.web-player-controller-wrap .right-area .quality-wrap .list-it')
  if (asideButton) {
    asideButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    if (asideButton.innerText.trim() !== '原画') {
      return
    }
  }
  selectedQuality.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
  return setTimeout(triggerLiveQualityOriginal, 100)
}

function detectVideoPlaying() {
  const video = document.querySelector('video')
  if (!video) {
    return requestAnimationFrame(detectVideoPlaying)
  }
  if (video.closest('#hot_module_player')) {
    return
  }
  if (location.hostname === 'live.bilibili.com') {
    if (document.querySelector('#room-card-list')) {
      return
    }
    logger.debug('启动网页全屏', () => console.trace())
    livePollingActive = true
    triggerLiveWebFullScreen()
    triggerLiveHideRoomAside()
    triggerLiveQualityOriginal()
    return
  }
  if (video.paused) {
    logger.debug('视频自动开播', () => console.trace())
    video.play()
    return requestAnimationFrame(detectVideoPlaying)
  }
  // www 上嵌的直播间播放器也要关掉倍速（live.bilibili.com 那条在函数开头就 return 了，
  // 页面类型早就判过，这里只兜"宿主页是 www、放的是直播"这一种）
  if (document.querySelector('.web-player-icon-roomStatus svg')) {
    speedAdjustable.value = false
  }
  if (speedAdjustable.value && video.playbackRate !== playbackRate.value) {
    logger.debug('视频倍率调节', () => console.trace())
    video.playbackRate = playbackRate.value
    return requestAnimationFrame(detectVideoPlaying)
  }
  if (!fullWebScreen.value) {
    return setTimeout(listeningVideoFinish, 100)
  }
  const buttonArea = fullscreenButtonArea()
  if (!buttonArea) {
    if (document.querySelector('.bpx-player-ctrl-web.bpx-state-entered')) {
      logger.debug('启动网页全屏', () => console.trace())
      return setTimeout(listeningVideoFinish, 100)
    }
    return requestAnimationFrame(detectVideoPlaying)
  }
  const selector = [
    '.bpx-player-ctrl-web-enter',
    '.squirtle-pagefullscreen-inactive',
    '.bilibili-player-iconfont-web-fullscreen-off'
  ].join(',')
  const fullscreenButton = buttonArea.querySelector(selector)
  if (fullscreenButton?.offsetWidth) fullscreenButton.click()
  const classList = buttonArea.classList
  if (classList.contains('closed') || classList.contains('active') || classList.contains('bpx-state-entered')) {
    logger.debug('启动网页全屏', () => console.trace())
    return setTimeout(listeningVideoFinish, 100)
  }
  return requestAnimationFrame(detectVideoPlaying)
}

function detectTemporaryPlaying() {
  const app = document.querySelector('#app:has(.header-login-entry):has(.bpx-state-paused)')
  const loginClose = document.querySelector('.bili-mini-mask:has(.login-agreement-wp) .bili-mini-close-icon')
  if (!app || !loginClose) {
    return setTimeout(detectTemporaryPlaying, 500)
  }
  detectVideoPlaying()
  loginClose.click()
}

function createCollapseButton() {
  const publishSection = document.querySelector('section:has(.bili-dyn-publishing)')
  if (!publishSection) {
    return setTimeout(createCollapseButton, 100)
  }
  const node = document.createElement('div')
  node.classList.add('collapse-button', 'is-collapsed')
  node.onclick = () => node.classList.toggle('is-collapsed')
  publishSection.appendChild(node)
}

// 监控推荐倒计时弹窗，一出现立即关闭（后台标签页也能执行）
let autoCancelObserver = null

function watchRecommendationOverlay() {
  if (autoCancelObserver) return
  // B 站播放器容器
  const player = document.querySelector('#bilibili-player, .bpx-player-video-wrap, .player-module')
  if (!player) return

  autoCancelObserver = new MutationObserver(() => {
    const cancelBtn = document.querySelector('.bpx-player-ending-related-item-cancel')
    if (cancelBtn) {
      cancelBtn.click()
      logger.debug('MutationObserver 自动关闭推荐倒计时')
    }
  })
  autoCancelObserver.observe(player, { childList: true, subtree: true })
}

function mounted() {
  logger.debug('[]~(￣▽￣)~* 脚本已准备就绪')
  // SPA 跳转（pushState）也会走到这儿，所以面板菜单跟着当前页面重新注册
  refreshScriptMenus()
  if (location.hostname === 'www.bilibili.com' || (location.hostname === 'live.bilibili.com' && location.pathname.length > 1)) {
    livePollingActive = true
    detectVideoPlaying()
    detectTemporaryPlaying()
    watchRecommendationOverlay()
  } else if (location.hostname === 't.bilibili.com') {
    return setTimeout(createCollapseButton, 100)
  }
}

window.addEventListener('beforeunload', () => {
  livePollingActive = false
})

// 标签页恢复可见时重新检测，并关闭可能已弹出的推荐倒计时
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return
  // 关闭后台时弹出的推荐倒计时
  const cancelRelated = document.querySelector('.bpx-player-ending-related-item-cancel')
  if (cancelRelated) cancelRelated.click()
  // 恢复视频检测循环（RAF 在后台被节流）
  if (livePollingActive) {
    handlingVideoEnded = false
    detectVideoPlaying()
  }
})

onMounted(() => {
  mounted()
  sessionStorage.removeItem('lastVideoSrc')
  if (!unsafeWindow.history.pushState.__hijacked__) {
    const pushState = unsafeWindow.history.pushState
    unsafeWindow.history.pushState = function (state, unused, url) {
      try {
        return pushState.apply(this, [state, unused, url])
      } finally {
        setTimeout(mounted, 2000)
      }
    }
    unsafeWindow.history.pushState.__hijacked__ = true
  }
  if (!unsafeWindow.history.replaceState.__hijacked__) {
    const replaceState = unsafeWindow.history.replaceState
    unsafeWindow.history.replaceState = function (state, unused, url) {
      try {
        return replaceState.apply(this, [state, unused, url])
      } finally {
        setTimeout(mounted, 2000)
      }
    }
    unsafeWindow.history.replaceState.__hijacked__ = true
  }
})
</script>
<style lang="scss">
html:has([www-bilibili-com]) {
  .floor-single-card,
  .desktop-download-tip,
  .recommended-swipe ~ .bili-video-card:not(.enable-no-interest) {
    display: none;
  }

  .nihility-config-item {
    .slider-tips {
      white-space: nowrap;
    }
  }
}

html:has([t-bilibili-com]) {
  body[t-bilibili-com] {
    [data-id=nihility-entry],
    section:has(.bili-dyn-banner) {
      display: none;
    }

    section:has(.bili-dyn-publishing) {
      position: relative;

      .collapse-button {
        left: 0;
        right: 0;
        width: 24px;
        bottom: -4px;
        height: 12px;
        margin: 0 auto;
        cursor: pointer;
        position: absolute;
        border-radius: 4px;
        align-items: center;
        display: inline-flex;
        justify-content: center;
        backdrop-filter: blur(8px);
        background-color: transparent;
        box-shadow: 0 0 10px 2px #4444;

        &::before {
          content: '';
          margin-bottom: 6px;
          display: inline-block;
          border: 6px solid transparent;
          border-bottom: 6px solid #0005;
        }

        &.is-collapsed::before {
          margin-top: 8px;
          margin-bottom: 0;
          border-top: 6px solid #0005;
          border-bottom: 6px solid transparent;
        }
      }

      &:has(.is-collapsed) {
        margin: 0;
        overflow: visible;

        .bili-dyn-publishing {
          height: 0;
          padding: 0;
          overflow: hidden;
        }

        .collapse-button {
          z-index: 1;
          bottom: -12px;
        }
      }
    }
  }
}

html:has([live-bilibili-com]) {
  #sections-vm,
  #link-footer-vm,
  .user-info .user-panel ~ *,
  #main-ctnr div.showmore-link,
  #main-ctnr div.nav-items-ctnr,
  .header-info-ctnr .lower-row .right-ctnr {
    display: none;
  }
}

body[www-bilibili-com],
body[live-bilibili-com] {
  &.player-full-win,
  &:has([class*='video_playerFullScreen__']),
  &:has(.mode-webscreen,[class*=video_playerFullScreen]) {
    [data-id=nihility-entry] {
      // 只藏"设置按钮 + 它的面板"，**不要整个入口 display:none**：本脚本自己会自动开网页全屏，
      // 那时按钮本来就够不着；而下载弹窗/小条正是全屏时唯一能用的入口（面板菜单叫出来的就是它），
      // 一并藏掉的话菜单点了也什么都不显示。
      .nihility-config-button,
      .nihility-config-panel {
        display: none;
      }

      // 收起后的胶囊只在没事的时候显示：它固定贴在右下角，全屏时会压住视频/进度条（用户实报）。
      // 全屏里想知道进度就看油猴菜单的文案（「视频下载（下载中 2/5）」）。
      .nihility-download-mini {
        display: none;
      }
    }
  }
}

body[nested-window] {
  [data-id=nihility-entry] {
    display: none;
  }
}
</style>
