<template>
  <button ref="configButton" class="nihility-config-button display-flex-center" @pointerup="handleClickSettings">
    设置
  </button>
  <div ref="configPanel" class="nihility-config-panel is-open" :style="configPanelStyle">
    <div class="nihility-config-body">
      <slot></slot>
    </div>
  </div>
</template>
<script setup lang="ts">
import {getGlobalDraggableElement} from '../utils/draggable.js'
import {nextTick, onMounted, onUnmounted, ref, shallowRef, watch} from 'vue'

const emits = defineEmits(['mounted'])
const props = withDefaults(defineProps<{
  panelWidth: string,
  panelHeight: string,
  useMaxHeight?: boolean
}>(), {
  panelWidth: '300px',
  panelHeight: '300px',
  useMaxHeight: true,
})
const configPanel = shallowRef()
const configButton = shallowRef()
const configPanelStyle = ref<any>({width: props.panelWidth,})
if (props.useMaxHeight) {
  configPanelStyle.value.maxHeight = `calc(${props.panelHeight} - 2em)`
} else {
  configPanelStyle.value.height = `calc(${props.panelHeight} - 2em)`
}

watch(() => props.panelWidth, value => configPanelStyle.value.width = value)
watch(() => props.panelHeight, value => {
  if (props.useMaxHeight) {
    configPanelStyle.value.maxHeight = `calc(${value} - 2em)`
  } else {
    configPanelStyle.value.height = `calc(${value} - 2em)`
  }
})

function handleClickSettings(e: any) {
  if (e.button !== 0) {
    return
  }
  const element = getGlobalDraggableElement(e.target)
  if (!element) {
    return
  }
  const state = element.state
  if (state.dragging) {
    return
  }
  togglePanel()
  updatePosition()
}

function togglePanel() {
  configPanel.value.classList.toggle('is-open')
}

function openPanel() {
  configPanel.value.classList.add('is-open')
}

function closePanel() {
  configPanel.value.classList.remove('is-open')
}

function computeVerticalPosition(y: number, height: number, isBottom: boolean) {
  if (y > height && y < window.innerHeight - height - 40) {
    if (isBottom) {
      return {top: 'unset', bottom: `${window.innerHeight - y - 10}px`,}
    } else {
      return {bottom: 'unset', top: `${y + 40}px`,}
    }
  } else if (y <= height) {
    return {bottom: 'unset', top: `${y + 40}px`,}
  } else {
    return {top: 'unset', bottom: `${window.innerHeight - y - 10}px`,}
  }
}

function computeHorizontalPosition(x: number, width: number, isRight: boolean) {
  if (x > width && x < window.innerWidth - width - 40) {
    if (isRight) {
      return {left: 'unset', right: `${window.innerWidth - x - 10}px`,}
    } else {
      return {right: 'unset', left: `${x + 40}px`,}
    }
  } else if (x <= width) {
    return {right: 'unset', left: `${x + 40}px`,}
  } else {
    return {left: 'unset', right: `${window.innerWidth - x - 10}px`,}
  }
}

const boundCache: any = {}

function updateBoundCache(bound: any) {
  boundCache.width = Math.max(boundCache.width || 0, bound.width)
  boundCache.height = Math.max(boundCache.height || 0, bound.height)
  return boundCache
}

function updatePosition() {
  if (!configPanel.value || !configButton.value) {
    return
  }
  const state = getGlobalDraggableElement(configButton.value).state
  const rect = updateBoundCache(configPanel.value.getBoundingClientRect())
  const style = configPanel.value.style
  // style.inset = 'unset'
  Object.assign(style, computeHorizontalPosition(state.pos.x, rect.width, style.left === 'unset'))
  Object.assign(style, computeVerticalPosition(state.pos.y, rect.height, style.top === 'unset'))
  const position = []
  position.push(style.left === 'unset' ? 'right' : 'left')
  position.push(style.top === 'unset' ? 'bottom' : 'top')
  if (configPanel.value) {
    configPanel.value.style.setProperty('--nihility-config-panel-transform-origin', position.join(' '))
  }
}

defineExpose({
  button: configButton,
  panel: configPanel,
  updatePosition,
  togglePanel,
  closePanel,
  openPanel,
})

onMounted(() => {
  window.addEventListener('resize', updatePosition)
  nextTick(() => handleClickSettings({button: 0, target: {state: {}}}))
  emits('mounted')
})
onUnmounted(() => {
  window.removeEventListener('resize', updatePosition)
})
</script>
<style lang="scss">
body:not([nested-window]) [data-id="nihility-entry"] {
  inset: 0;
  z-index: 999999;
  position: fixed;
  pointer-events: none;
  --draggable-element-translate: translate(0, 0);

  .nihility-config-button {
    width: 50px;
    height: 50px;
    z-index: 100;
    color: #666666;
    cursor: pointer;
    user-select: none;
    line-height: 50px;
    font-weight: bold;
    position: absolute;
    text-align: center;
    border-radius: 50%;
    pointer-events: all;
    vertical-align: middle;
    backdrop-filter: blur(10px);
    border: 3px solid transparent;
    background-color: transparent;
    box-shadow: 0 0 20px #00000066;
    transition: opacity 1s ease-in-out;
    transform: var(--draggable-element-translate);

    &::before {
      top: 0;
      left: 0;
      width: 100%;
      content: '';
      z-index: -1;
      height: 100%;
      position: absolute;
      border-radius: 50%;
      transition: all 0.3s ease-in-out;
      animation: glowing-button 20s linear infinite;
      background: linear-gradient(
          45deg,
          #ff0000,
          #ff7300,
          #fffb00,
          #48ff00,
          #00ffd5,
          #002bff,
          #7a00ff,
          #ff00c8,
          #ff0000
      );
      background-size: 400%;
    }

    &::after {
      top: -3px;
      left: -3px;
      width: 100%;
      z-index: -1;
      content: '';
      height: 100%;
      background: white;
      position: absolute;
      border-radius: 50%;
      border: 3px solid transparent;
    }

    &:hover {
      &::before {
        top: -3px;
        left: -3px;
        width: calc(100% + 6px);
        height: calc(100% + 6px);
      }

      &::after {
        top: 0;
        left: 0;
        border: none;
      }
    }
  }

  .nihility-config-panel {
    padding: 1em;
    font-size: 14px;
    overflow: hidden;
    transition: 200ms;
    user-select: none;
    position: absolute;
    height: fit-content;
    background-color: #fff6;
    border-radius: 30% 0 30% 0;
    backdrop-filter: blur(10px);
    transform: scale(0) rotate3d(1, -1, 0, -45deg);
    transform-origin: var(--nihility-config-panel-transform-origin);

    .nihility-config-body {
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      background-color: #00000080;

      .nihility-config-item {
        padding: .5em;
        display: flex;
        align-items: center;
        width: calc(100% - 1em);
        justify-content: space-between;
      }
    }

    &.is-open {
      border-radius: 0;
      pointer-events: all;
      box-shadow: 0 0 20px #00000066;
      transform: scale(1) rotate3d(0, 0, 0, 0);
    }
  }
}

@keyframes glowing-button {
  0% {
    background-position: 0 0;
  }
  50% {
    background-position: 400% 0;;
  }
  100% {
    background-position: 0 0;
  }
}
</style>
