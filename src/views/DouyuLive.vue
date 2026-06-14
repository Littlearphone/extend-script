<template>

</template>
<script setup lang="ts">
import {onMounted} from 'vue'
import {logger} from '../utils/logger.js'

function initialFullscreen() {
  if (!document.querySelector('video')) {
    return requestAnimationFrame(initialFullscreen)
  }
  const classList = document.body.classList
  if (!classList.contains('is-fullScreenPage') || !classList.contains('is-fullScreen')) {
    const fullscreenSelector = '[class*=controlbar__] i[class*=icon-]:has(+i[class*=icon-]:last-child)'
    document.querySelector(fullscreenSelector)?.dispatchEvent(new MouseEvent('click', {bubbles: true}))
    return setTimeout(initialFullscreen, 1000)
  }
}

function detectSmallScreen() {
  if (!document.querySelector('video')) {
    return requestAnimationFrame(detectSmallScreen)
  }
  const element = document.querySelector('.is-smallDangling')
  if (element) {
    element.classList.remove('is-smallDangling')
    requestAnimationFrame(initialFullscreen)
  }
  requestAnimationFrame(detectSmallScreen)
}

onMounted(() => {
  logger.info('Douyu脚本准备就绪')
  requestAnimationFrame(initialFullscreen)
  requestAnimationFrame(detectSmallScreen)
})
</script>
<style lang="scss">
html:has([www-douyu-com]) {
  body[www-douyu-com] {
    #js-bottom-left,
    [class*=fansClub__],
    [class*=interactive__],
    [class*=shareButton__],
    [class*=activeContainer__] {
      display: none !important;
    }

    [class*=stream__] {
      bottom: 0;
    }

    #js-player-video-case {
      left: 0;
    }

    [class*=stream__] [class*=case__] {
      padding-bottom: 0 !important;
    }
  }
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  -webkit-box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.3);
}

::-webkit-scrollbar-thumb {
  border-radius: 5px;
  background-color: rgba(0, 0, 0, .1);
  -webkit-box-shadow: inset 0 0 2px rgba(0, 0, 0, 0.5);
}

::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}

::-webkit-scrollbar-thumb:active {
  background: #999;
}
</style>
