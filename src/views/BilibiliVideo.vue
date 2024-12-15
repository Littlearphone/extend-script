<template>
  <Settings ref="settingsElement" @mounted="handleSettingsMounted" panel-width="300px" panel-height="250px">
    <div class="nihility-config-item">
      <Switch label="注入配置" v-model="injectConfig"/>
    </div>
    <div class="nihility-config-item" v-if="injectConfig">
      <Switch label="网页全屏" v-model="fullWebScreen"/>
    </div>
    <div class="nihility-config-item" v-if="injectConfig">
      <Slider label="倍数播放" v-model="playbackRate" step="0.05" min="0.5" max="5"/>
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
  config.playbackRate = value
  GM_setValue(CONFIG_KEY, JSON.stringify(Object.assign({}, config)))
})

function detectVideoPlaying() {
  requestAnimationFrame(detectVideoPlaying)
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
  detectVideoPlaying()
})
</script>
