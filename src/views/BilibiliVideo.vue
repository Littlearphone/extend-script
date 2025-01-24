<template>
  <Settings ref="settingsElement" @mounted="handleSettingsMounted" panel-width="300px" panel-height="250px">
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
  </Settings>
</template>
<script setup>
import Slider from '../components/Slider.vue'
import Switch from '../components/Switch.vue'
import Settings from '../components/Settings.vue'
import { nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { addGlobalDraggableElement, DraggableElement } from '../utils/draggable.js'

const CONFIG_KEY = 'bilibili-hack-config'

const config = reactive(JSON.parse(GM_getValue(CONFIG_KEY, '{}')))
const injectConfig = ref(config.injectConfig || false)
const fullWebScreen = ref(config.fullWebScreen || false)
const playbackRate = ref(config.playbackRate || 1.25)
const speedAdjustable = ref(true)
const settingsElement = shallowRef()
watch(injectConfig, value => {
  config.injectConfig = value
  GM_setValue(CONFIG_KEY, JSON.stringify(Object.assign({}, config)))
  nextTick(() => top.location.reload())
})
watch(fullWebScreen, value => {
  config.fullWebScreen = value
  GM_setValue(CONFIG_KEY, JSON.stringify(Object.assign({}, config)))
})
watch(playbackRate, value => {
  config.playbackRate = value || config.playbackRate
  GM_setValue(CONFIG_KEY, JSON.stringify(Object.assign({}, config)))
})

function fullscreenButtonArea() {
  const selector = [
    '.squirtle-video-pagefullscreen',
    '.bilibili-player-video-web-fullscreen',
    '.bpx-player-ctrl-web:not(.bpx-state-entered)'
  ].join(',')
  return document.querySelector(selector)
}

function playNextVideo(e) {
  const nextButton = document.querySelector('.bpx-player-ctrl-next')
  if (!nextButton) {
    return e.target.removeEventListener('ended', playNextVideo)
  }
  if (!document.querySelector('.bpx-player-ctrl-setting-loop input').checked) {
    nextButton.click()
  }
  e.target.removeEventListener('ended', playNextVideo)
  return detectVideoPlaying()
}

function listeningVideoFinish() {
  const video = document.querySelector('video')
  if (video.ended) {
    return playNextVideo({ target: video })
  }
  video.addEventListener('ended', playNextVideo)
}

function triggerLiveWebFullScreen() {
  if (document.querySelector('.player-full-win')) {
    return true
  }
  const video = document.querySelector('video')
  video.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
  const fullWebScreen = document.querySelector('.web-player-controller-wrap .right-area .tip-wrap:nth-child(2) svg')
  if (fullWebScreen) {
    fullWebScreen.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }
  // document.body.classList.add('player-full-win', 'over-hidden', 'hide-aside-area')
  return setTimeout(triggerLiveWebFullScreen, 100)
}

function triggerLiveHideRoomAside() {
  if (document.querySelector('.player-full-win.hide-aside-area')) {
    return true
  }
  const asideButton = document.querySelector('.player-full-win #aside-area-toggle-btn')
  if (asideButton && !document.querySelector('.hide-aside-area')) {
    asideButton.click()
  }
  return setTimeout(triggerLiveHideRoomAside, 100)
}

function triggerLiveQualityOriginal() {
  const selectedQuality = document.querySelector('.quality-wrap .selected-qn')
  if (!selectedQuality) {
    const video = document.querySelector('video')
    video.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }))
    return setTimeout(triggerLiveQualityOriginal, 100)
  }
  if (selectedQuality.innerText.trim() === '原画') {
    return true
  }
  const asideButton = document.querySelector('.web-player-controller-wrap .right-area .quality-wrap .list-it')
  if (asideButton) {
    asideButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    if (asideButton.innerText.trim() !== '原画') {
      return true
    }
  }
  selectedQuality.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
  return setTimeout(triggerLiveQualityOriginal, 100)
}

function detectVideoPlaying() {
  const video = document.querySelector('video')
  if (!video) {
    return setTimeout(detectVideoPlaying, 500)
  }
  if (video.closest('#hot_module_player')) {
    return
  }
  if (video.paused) {
    logger.debug('视频自动开播', () => console.trace())
    video.play()
    return setTimeout(detectVideoPlaying, 500)
  }
  if (document.querySelector('.web-player-icon-roomStatus svg')) {
    speedAdjustable.value = false
  }
  if (speedAdjustable.value && video.playbackRate !== playbackRate.value) {
    logger.debug('视频倍率调节', () => console.trace())
    video.playbackRate = playbackRate.value
    return setTimeout(detectVideoPlaying, 500)
  }
  if (!fullWebScreen.value) {
    return setTimeout(listeningVideoFinish, 100)
  }
  if (location.hostname === 'live.bilibili.com') {
    if (document.querySelector('#room-card-list')) {
      return
    }
    logger.debug('启动网页全屏', () => console.trace())
    return triggerLiveWebFullScreen() && triggerLiveHideRoomAside() && triggerLiveQualityOriginal()
  }
  const buttonArea = fullscreenButtonArea()
  if (!buttonArea) {
    if (document.querySelector('.bpx-player-ctrl-web.bpx-state-entered')) {
      logger.debug('启动网页全屏', () => console.trace())
      return setTimeout(listeningVideoFinish, 100)
    }
    return setTimeout(detectVideoPlaying, 500)
  }
  const selector = [
    '.bpx-player-ctrl-web-enter',
    '.squirtle-pagefullscreen-inactive',
    '.bilibili-player-iconfont-web-fullscreen-off'
  ].join(',')
  const fullscreenButton = buttonArea.querySelector(selector)
  fullscreenButton.offsetWidth && fullscreenButton.click()
  const classList = buttonArea.classList
  if (classList.contains('closed') || classList.contains('active') || classList.contains('bpx-state-entered')) {
    logger.debug('启动网页全屏', () => console.trace())
    return setTimeout(listeningVideoFinish, 100)
  }
  return setTimeout(detectVideoPlaying, 500)
}

class BilibiliSettingsButton extends DraggableElement {
  dragFinish() {
    nextTick(() => settingsElement.value.updatePosition())
  }
}

function handleSettingsMounted() {
  nextTick(() => {
    const settingsButton = settingsElement.value.button
    const bounds = settingsButton.getBoundingClientRect()
    addGlobalDraggableElement(new BilibiliSettingsButton(settingsButton, {
      initialX: 80,
      initialY: window.innerHeight - 80 - bounds.height,
      minX: 0, maxX: window.innerWidth - bounds.width,
      minY: 0, maxY: window.innerHeight - bounds.height
    }))
    settingsElement.value.updatePosition()
    settingsElement.value.closePanel()
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

function mounted() {
  logger.debug('[]~(￣▽￣)~* 脚本已准备就绪')
  if (location.hostname === 'www.bilibili.com' || (location.hostname === 'live.bilibili.com' && location.pathname.length > 1)) {
    detectVideoPlaying()
    detectTemporaryPlaying()
  } else if (location.hostname === 't.bilibili.com') {
    return setTimeout(createCollapseButton, 100)
  }
}

onMounted(() => {
  mounted()
  sessionStorage.removeItem('lastVideoSrc')
  const pushState = unsafeWindow.history.pushState
  unsafeWindow.history.pushState = function (state, unused, url) {
    try {
      return pushState.apply(this, [state, unused, url])
    } finally {
      setTimeout(mounted, 2000)
    }
  }
  const replaceState = unsafeWindow.history.replaceState
  unsafeWindow.history.replaceState = function (state, unused, url) {
    try {
      return replaceState.apply(this, [state, unused, url])
    } finally {
      setTimeout(mounted, 2000)
    }
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
