<template>

</template>
<script setup lang="ts">
import {onMounted, ref} from 'vue'

const focused = ref(true)

function detectLink() {
  if (!focused.value) {
    return
  }
  requestAnimationFrame(detectLink)
  const links = document.querySelectorAll('a:not([target="_blank"])')
  if (!links || !links.length) {
    return
  }
  links.forEach(link => link.setAttribute('target', '_blank'))
}

onMounted(() => {
  requestAnimationFrame(detectLink)
  window.addEventListener('blur', () => (focused.value = false))
  window.addEventListener('focus', () => (focused.value = true) && detectLink())
})
</script>
<style lang="scss" scoped>
html:has([www-google-com]) {
  body[www-google-com] {

  }
}
</style>
