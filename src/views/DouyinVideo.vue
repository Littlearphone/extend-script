<template>

</template>
<script setup lang="ts">
import {onMounted} from 'vue'

function triggerFullWebScreen() {
  const element = document.querySelector('div[data-inactive-item="true"]:has([d*=\'1V16h2v-2.75H15v\'])')
  if (!element) {
    return requestAnimationFrame(triggerFullWebScreen)
  }
  element.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}))
}

onMounted(() => {
  requestAnimationFrame(triggerFullWebScreen)
})
</script>
<style lang="scss">
body[www-douyin-com] {
  [id*="login-full-panel-"] {
    display: none !important;
  }
}
</style>
