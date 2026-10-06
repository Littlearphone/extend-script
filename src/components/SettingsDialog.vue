<template>
  <div class="nihility-dialog-mask" @pointerdown="onMaskPointerDown" @click.self="onMaskClick">
    <div class="nihility-dialog">
      <header class="dialog-header">
        <span class="dialog-title">{{ title }}</span>
        <button class="dialog-close" title="关闭" @click="emit('close')">×</button>
      </header>
      <div class="dialog-body">
        <slot></slot>
      </div>
    </div>
  </div>
</template>
<script setup>
// 居中的通用小弹窗（浮动面板够不着时用：网页全屏、真全屏）。
// 内容由调用方通过 slot 给——面板与弹窗共用同一份内容组件，见 SettingsContent.vue。
import { onMounted, onUnmounted } from 'vue'

defineProps({ title: { type: String, default: '' } })
const emit = defineEmits(['close'])

// click 的 target 是"按下与松开两处的共同祖先"：在输入框/滑块里按下、拖到框外松手也会冒泡到这里，
// 所以必须记住按下时按在哪，否则一拖就把弹窗关了（下载弹窗踩过同一个坑）。
let maskPressTarget = null

function onMaskPointerDown(event) {
  maskPressTarget = event.target
}

function onMaskClick(event) {
  if (maskPressTarget !== event.currentTarget) {
    return
  }
  maskPressTarget = null
  emit('close')
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>
<style lang="scss" scoped>
.nihility-dialog-mask {
  inset: 0;
  display: flex;
  z-index: 210;
  position: fixed;
  pointer-events: all;
  align-items: center;
  justify-content: center;
  background-color: #00000080;
  backdrop-filter: blur(4px);
}

.nihility-dialog {
  width: min(360px, 92vw);
  display: flex;
  color: #f0f0f0;
  overflow: hidden;
  font-size: 13px;
  border-radius: 12px;
  flex-direction: column;
  background-color: #16161af2;
  box-shadow: 0 12px 48px #000000aa;

  .dialog-header {
    display: flex;
    padding: .7em 1em;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #ffffff1a;

    .dialog-title {
      font-size: 14px;
      font-weight: bold;
    }

    .dialog-close {
      border: 0;
      color: #fff9;
      cursor: pointer;
      font-size: 18px;
      line-height: 1.1;
      background: none;

      &:hover {
        color: #fff;
      }
    }
  }

  .dialog-body {
    padding: .3em .4em .6em;
    overflow-y: auto;
    max-height: 70vh;
  }
}
</style>
