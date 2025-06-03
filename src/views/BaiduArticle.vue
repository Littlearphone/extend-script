<template>

</template>
<script setup lang="ts">

</script>
<style lang="scss">
body[tieba-baidu-com] {
  .right_section,
  .tbui_aside_float_bar,
  #tiebaCustomPassLogin {
    display: none !important;
  }

  .pb_content {
    display: flex;
    justify-content: center;
  }

  .tb_rich_poster {
    margin-inline: 20px;

    .old_style_wrapper {
      width: 100%;
      box-sizing: border-box;

      .edui-container {
        width: 100% !important;
      }
    }
  }
}

body[baijiahao-baidu-com] {
  div:has([data-testid="follow-btn"]):has([data-testid="author-zan-num"]):not(:has([data-testid="article"])) {
    display: none;
  }

  div:has([data-testid="article"]):not(:has([data-testid="follow-btn"]):has([data-testid="author-zan-num"])) {
    margin: 0;
    width: 100%;
  }

  div:has([data-testid="share-btn"]):not(:has([data-testid="article"])) {
    display: none;
  }
}

body[jingyan-baidu-com] {
  #aside,
  nav.nav,
  .footer,
  #wgt-like,
  #task-panel-wrap,
  #exp-article ~ *,
  #search-box .channel,
  .wrp-exp-share > :not(#w-gotop) {
    display: none !important;
  }

  #main-content {
    padding: 0;
    width: 100%;

    .exp-content-container.fold {
      overflow: auto;
      max-height: unset;

      .read-whole-mask {
        display: none !important;
      }
    }

    .exp-content-body:not(.exp-brief-step) {
      a.exp-image-wraper {
        width: 100%;

        img {
          width: 100%;
          max-width: unset;
          max-height: 80vh;
          object-fit: contain;
        }
      }
    }
  }

  header .article-header {
    height: auto;
  }
}

body[developer-baidu-com] {
  padding-top: 64px;
  overflow: auto !important;

  footer,
  #u-editor ~ *,
  li.nav-article-hook ~ *,
  [data-id=nihility-entry] ~ *,
  [class*=main_header-search__] ~ *,
  [class*=articel_detail_articl-tag-wrapper__],
  [class*=articel_detail_article-content__] ~ *,
  [class*=articel_detail_begining-market-pos__],
  [class*=articel_detail_right-author-label-activity__] {
    display: none !important;
  }

  header.developer-header {
    top: 0;
  }
}
</style>
