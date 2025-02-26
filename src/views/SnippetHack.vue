<template>
</template>
<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  if (location.hostname === 'www.jb51.net') {
    // TODO 解除复制限制
  }
})
</script>
<style lang="scss">
html:has([www-jb51-net]) {
  body[www-jb51-net] {
    #ewm,
    #nav,
    .xbtj,
    .art_xg,
    #footer,
    #topbar,
    .xgcomm,
    #submenu,
    .catalogue,
    .main-right,
    #header #logo ~ *,
    #container > div:has(#txtlink) {
      display: none;
    }

    .codetool {
      display: none !important;
    }

    .code {
      user-select: text;
    }

    .main-left {
      width: 100% !important;
    }

    #CatelogList {
      padding: 1em;
      width: auto !important;
      background-color: white;
      box-shadow: 0 0 10px 2px #0005;
    }

    #navCategory .first_class_ul {
      display: unset !important;
    }
  }
}

html:has([www-360doc-com]) {
  body[www-360doc-com] {
    .floatqrcode,
    .article_showall,
    #goTop2 #fxbtn_ai,
    .gzhxcjh_entrance,
    #goTop2 #fxbtn_ai ~ *,
    #registerOrLoginLayer,
    .mod__:has(.ul-similar),
    #registerOrLoginLayer ~ *,
    .doc360article_content .a_right {
      display: none !important;
    }

    .a_left:has(#bgchange) {
      &, #bgchange, #articlecontent {
        width: 100%;
        box-sizing: border-box;
      }

      #articlecontent {
        height: fit-content;

        table {
          width: 100% !important;
        }
      }
    }
  }
}

html:has([juejin-cn]) {
  body[juejin-cn] {
    .main-nav-list,
    .chat-assistant,
    .column-container,
    .recommended-area,
    #sidebar-container,
    div.article-summary,
    .global-float-banner,
    .article-suspended-panel,
    .context-menu:has(.ai-btn),
    .right-side-nav .vip-entry,
    .right-side-nav .creator-item,
    .code-block-extension-headerRight,
    .suspension-panel > :not(.to-top-btn) {
      display: none;
    }

    .main-area.article-area {
      width: 100%;
    }
  }
}

html:has([cloud-tencent-com-cn]) {
  body[cloud-tencent-com-cn] {
    .cdc-footer,
    .layout-side,
    .pg-info-introduce ~ *,
    .cdc-header__bottom-home ~ *,
    .com-widget-global2__btn:not(.top),
    #community-top-header-product-container,
    .cdc-modal__wrap:has(.cdc-activity-modal) {
      display: none;
    }
  }
}

html:has([www-51cto-com]) {
  body[www-51cto-com] {
    footer,
    .header-box,
    .left-window,
    .article-right,
    #secondNav .parent-ul,
    .article-left article ~ *,
    [class*='suspension-pendant'],
    .components-common-suspension > div > :not(i) {
      display: none !important;
    }

    .components-common-suspension > div {
      padding: 0;
    }

    #secondNav {
      top: 0;
    }

    .components-page-article {
      padding-block: 32px;

      .article-left {
        width: 100%;

        .article-tags {
          margin: 0;
        }
      }
    }
  }
}

html:has([blog-51cto-com]) {
  body[blog-51cto-com] {
    .Footer,
    .home-top,
    .Navigates,
    .hover-ball,
    #login_iframe_mask,
    .detail-content-right,
    .text-aticle .recommend-ad,
    .action-aside-left li.share,
    .minmenu li:not(.scrollToTop),
    .common-section:has(.recommend-about),
    .action-aside-left li:has(.is-praise),
    .header-right li:not(.search, .logins),
    .action-aside-left li:has(.favorites-opt) {
      display: none !important;
    }

    #page_center {
      height: fit-content !important;

      .detail-content-left {
        transition: all 300ms;
        right: 0 !important;

        &:not(.set-right) {
          width: 100%;
        }

        .article-content-wrap {
          padding: 0;
          margin: 0;
        }

        .comment-textarea .textarea-box {
          width: calc(100% - 56px);
        }

        .comment-List-box {
          img {
            display: flex;
            margin: 0 auto !important;
          }
        }
      }
    }

    .minmenu ul {
      padding: 0;
    }

    .Header {
      top: 0 !important;
    }
  }
}

html:has([stackoverflow-com],[dba-stackexchange-com]) {
  body[stackoverflow-com],
  body[dba-stackexchange-com] {
    #footer,
    #sidebar,
    #left-sidebar,
    [name="new-answer"] ~ * {
      display: none;
    }

    #content {
      border: none;

      #mainbar {
        width: 100%;

        pre {
          max-height: fit-content;
        }

        .question.js-question {
          border: 2px solid var(--theme-secondary-400);
          border-radius: 10px;
          padding: 16px;
        }

        #answers {
          gap: 1em;
          display: flex;
          flex-direction: column;

          .answer.js-answer {
            border: 1px solid var(--black-200);
            border-radius: 10px;
            padding: 16px;

            &:hover {
              box-shadow: 0 0 8px 2px #0006;
            }

            &[itemprop="acceptedAnswer"] {
              border: 2px solid var(--green-400);

              &:hover {
                box-shadow: 0 0 8px 2px var(--green-400);
              }
            }
          }
        }
      }
    }
  }
}
</style>
