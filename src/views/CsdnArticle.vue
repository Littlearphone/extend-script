<template>
</template>
<script setup>
import { onMounted } from 'vue'

function unseal() {
  requestAnimationFrame(unseal)
  const loginButton = document.querySelector('.toolbar-btn-login a:not([is-hacked])')
  if (loginButton) {
    loginButton.innerHTML = `<span class="unseal">解除封印</span>`
    loginButton.setAttribute('is-hacked', '')
  }
}

onMounted(() => {
  document.addEventListener('click', function (e) {
    if (e.target.closest('.toolbar-btn-login')) {
      document.οncοntextmenu = document.οncοpy = null
      logger.info('解除 CSDN 页面限制', () => {
        logger.debug('执行全文档内容替换')
        try {
          document.body.outerHTML = `${document.body.outerHTML}`
        } catch (e) {
          logger.error(e)
        }
        logger.debug('解锁全文档选择限制')
      })
    }
  })
  requestAnimationFrame(unseal)
})
</script>
<style lang="scss">
[blog-csdn-net] {
  .recommend-box,
  div[id$=Advert],
  .toolbox-middle,
  .recommend-right,
  #articleSearchTip,
  .hljs-button.signin,
  .blog-footer-bottom,
  .blog_container_aside,
  .toolbar-btn-login ~ *,
  .passport-login-container,
  .toolbar-menus .active ~ *,
  .option-box:has(.app-qr-box),
  .passport-login-tip-container {
    display: none !important;
  }

  #csdn-toolbar span.unseal {
    padding: 4px 0;
    display: block;
    font-size: 14px;
    line-height: 16px;
  }

  main div.blog-content-box article {
    padding: 32px 0;

    #content_views pre code {
      user-select: text;
    }

    pre.set-code-hide {
      overflow: visible;
      height: fit-content;
      max-height: fit-content;

      .hide-preCode-box {
        &, & ~ * {
          display: none !important;
        }
      }
    }
  }
}
</style>
