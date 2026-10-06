<template>
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
  <div class="nihility-config-item" v-if="showDownload">
    <button class="nihility-download-entry" @click="emit('open-download')">{{ downloadText }}</button>
  </div>
</template>
<script setup>
// 面板内容的**唯一一份实现**：浮动面板（Settings.vue 的 slot）与全屏时用的设置弹窗
// （SettingsDialog.vue）都挂它，避免同一套开关在两处各写一遍、日后改一处忘一处。
// 状态本身仍是调用方的 ref（v-model 传进来），所以两处开着的界面天然同步。
import Slider from './Slider.vue'
import Switch from './Switch.vue'

const emit = defineEmits(['open-download'])
const injectConfig = defineModel('injectConfig', { default: false })
const fullWebScreen = defineModel('fullWebScreen', { default: false })
// Slider 回写的是字符串（toFixed 后的），别标 Number，否则 Vue 会告警
const playbackRate = defineModel('playbackRate', { default: 1.25 })

defineProps({
  // 直播页不调倍速（见 BilibiliVideo.vue 的 speedAdjustable）
  speedAdjustable: Boolean,
  showDownload: Boolean,
  downloadText: String,
})
</script>
<style lang="scss" scoped>
// 与下载弹框的主按钮（VideoDownloadDialog 的 .download-button）保持同一套颜色，
// 别单独调色——两处不一致时用户会以为是两个不相干的功能。
.nihility-download-entry {
  width: 100%;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  padding: .45em 1.1em;
  border-radius: 6px;
  border: 1px solid transparent;
  background-color: #409eff;

  &:hover {
    background-color: #66b1ff;
  }
}
</style>
