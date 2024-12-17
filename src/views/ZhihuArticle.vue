<template>

</template>
<script setup lang="ts">

</script>
<style lang="scss">
html:has([www-zhihu-com]) {
  overflow: auto !important;

  body[www-zhihu-com] {
    .Question-sideColumn,
    & > div:not([id],[class]),
    & > div:has(.signFlowModal) {
      display: none;
    }

    .Question-main {
      .ListShortcut,
      .Question-mainColumn {
        width: 100%;
      }
    }
  }
}

html:has([zhuanlan-zhihu-com]) {
  overflow: auto !important;

  body[zhuanlan-zhihu-com] {
    & > div:has(.signFlowModal) {
      display: none;
    }
  }
}
</style>
