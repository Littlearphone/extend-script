<template>
  <Settings ref="settingsElement" @mounted="handleSettingsMounted" panel-width="300px" panel-height="300px">
    <div class="nihility-config-item">
      <Switch label="注入配置" v-model="injectConfig"/>
    </div>
    <div class="nihility-config-item" v-if="injectConfig">
      <Switch label="网页全屏" v-model="fullWebScreen"/>
    </div>
    <div class="nihility-config-item" v-if="injectConfig && speedAdjustable">
      <Slider label="倍数播放" v-model="playbackRate" step="0.05" min="0.5" max="5">
        <template #tips="{value}">
          {{ parseFloat(value).toFixed(2) }}x
        </template>
      </Slider>
    </div>
    <div class="nihility-config-item" v-if="downloadEntryVisible">
      <button class="nihility-download-entry" @click="downloadDialogOpen = true">视频下载</button>
    </div>
  </Settings>
  <VideoDownloadDialog v-if="downloadDialogOpen" @close="downloadDialogOpen = false"/>
</template>
<script setup>
import Slider from '../components/Slider.vue'
import Switch from '../components/Switch.vue'
import Settings from '../components/Settings.vue'
import VideoDownloadDialog from '../components/VideoDownloadDialog.vue'
import { computed, nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { addGlobalDraggableElement, DraggableElement, relocateDraggableElements } from '../utils/draggable.js'

const CONFIG_KEY = 'bilibili-hack-config'

const config = reactive(JSON.parse(GM_getValue(CONFIG_KEY, '{}')))
const injectConfig = ref(config.injectConfig || false)
const fullWebScreen = ref(config.fullWebScreen || false)
const playbackRate = ref(config.playbackRate || 1.25)
const speedAdjustable = ref(true)
const settingsElement = shallowRef()
const downloadDialogOpen = ref(false)
// 只有 www.bilibili.com 的页面拿得到可下载的视频信息；直播与动态页不摆这个入口。
const downloadEntryVisible = computed(() => location.hostname === 'www.bilibili.com')
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

class BilibiliSettingsButton extends DraggableElement {
  dragFinish() {
    nextTick(() => settingsElement.value.updatePosition())
  }
}

function handleSettingsMounted() {
  requestAnimationFrame(() => {
    const settingsButton = settingsElement.value.button
    const bounds = settingsButton.getBoundingClientRect()
    const buttonW = bounds.width || 50
    const buttonH = bounds.height || 50
    const initX = 80
    const initY = Math.max(0, window.innerHeight - 80 - buttonH)
    addGlobalDraggableElement(new BilibiliSettingsButton(settingsButton, {
      initialX: initX,
      initialY: initY,
      minX: 0, maxX: window.innerWidth - buttonW,
      minY: 0, maxY: window.innerHeight - buttonH
    }))
    settingsElement.value.updatePosition()
    settingsElement.value.closePanel()

    // 等 B 站自身布局稳定后（约 3s），做一次性的视口修正，避免被挤出可见区域
    setTimeout(() => relocateDraggableElements(), 3000)
  })
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
      display: none;
    }
  }
}

body[nested-window] {
  [data-id=nihility-entry] {
    display: none;
  }
}
</style>
<style lang="scss" scoped>
.nihility-download-entry {
  width: 100%;
  color: #fff;
  cursor: pointer;
  padding: .45em 1em;
  border-radius: 6px;
  border: 1px solid #409eff66;
  background-color: #409eff33;

  &:hover {
    background-color: #409eff66;
  }
}
</style>
