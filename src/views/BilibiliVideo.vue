<template>
  <Settings ref="settingsElement" @mounted="handleSettingsMounted" panel-width="300px" panel-height="250px">
    <div class="nihility-config-item">
      <Switch label="注入配置" v-model="injectConfig"/>
    </div>
    <div class="nihility-config-item" v-if="injectConfig">
      <Switch label="网页全屏" v-model="fullWebScreen"/>
    </div>
    <div class="nihility-config-item" v-if="injectConfig">
      <Slider label="倍数播放" v-model="playbackRate" step="0.05" min="0.5" max="5">
        <template #tips="{value}">
          {{ value }}x
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

function detectVideoPlaying() {
  const video = document.querySelector('video')
  if (!video) {
    return requestAnimationFrame(detectVideoPlaying)
  }
  if (video.paused) {
    logger.debug('视频自动开播', () => console.trace())
    video.play()
  }
  logger.debug('视频倍率调节', () => console.trace())
  video.playbackRate = playbackRate.value
  if (!fullWebScreen.value) {
    return
  }
  const buttonArea = fullscreenButtonArea()
  const fullWebScreenStatus = document.querySelector('.bpx-player-ctrl-web.bpx-state-entered')
  if (!buttonArea && fullWebScreenStatus) {
    return
  }
  if (!buttonArea) {
    return requestAnimationFrame(detectVideoPlaying)
  }
  logger.debug('启动网页全屏', () => console.trace())
  const selector = [
    '.bpx-player-ctrl-web-enter',
    '.squirtle-pagefullscreen-inactive',
    '.bilibili-player-iconfont-web-fullscreen-off'
  ].join(',')
  const fullscreenButton = buttonArea.querySelector(selector)
  fullscreenButton.offsetWidth && fullscreenButton.click()
  const classList = buttonArea.classList
  if (classList.contains('closed') || classList.contains('active') || classList.contains('bpx-state-entered')) {
    return
  }
  return requestAnimationFrame(detectVideoPlaying)
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

onMounted(() => {
  logger.debug('[]~(￣▽￣)~* 脚本已准备就绪')
  detectVideoPlaying()
})
</script>
<style lang="scss" scoped>
html:has([www-bilibili-com]) {
  .nihility-config-item {
    .slider-tips {
      white-space: nowrap;
    }
  }
}
</style>
<style lang="scss">
body[www-bilibili-com]:has(.mode-webscreen) [data-id=nihility-entry] {
  display: none;
}
</style>
