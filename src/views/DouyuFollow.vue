<template>
</template>
<script setup>
</script>
<style lang="scss">
html:has([www-douyu-com]) {
  body[www-douyu-com] {
    .Header-menu-game,
    .Recommend-wrapper,
    .NavigationBar-tools,
    .NavigationBar-footer,
    .Header-download-wrap,
    .Header-taskentry-wrap,
    .Header-broadcast-wrap,
    .Header-menu-directory,
    .Header-createcenter-wrap,
    .NavigationBar-navigation {
      display: none !important;
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
