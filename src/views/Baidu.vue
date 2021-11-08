<template>
</template>
<script>
import { Pagination } from '../common/pagination'
import Loading from '../components/Loading.vue'
import { defineComponent } from 'vue'

export default {
  mounted() {
    if (!window.pagination) {
      window.pagination = new Pagination()
    }
    if ($('body[baidu]').length) {
      console.log('页面已经被标记')
      return
    }
    defineComponent(Loading)
    const cleanAdsStyle = function() {
      const $elements = $('[baidu] #content_left > div:not(.result):not(.result-op):not(.c-group-wrapper)')
      $elements.each(function() {this.style = 'display: none !important;' })
      window.adBlocker = setTimeout(cleanAdsStyle, 100)
    }
    window.adBlocker = setTimeout(cleanAdsStyle, 100)
    Pagination.prototype.nextPage = function() {
      const next = $('#page a:contains("下一页")')
      if (!next.length || this.iframe.attr('src') === next.attr('href')) {
        return
      }
      if ($('#page .tuner-loading-block').length) {
        return
      }
      console.log('自动加载下一页')
      clearTimeout(window.adBlocker)
      if (!$('iframe#tuner-crx').length) {
        this.reloadFrame()
      }
      $('#page').css({ 'position': 'relative' })
      const loading = $.loading.mask('#page').start()
      this.iframe.on('load', () => {
        $('#content_left').append(this.select('#content_left').html())
        $('#page [class^="page-inner"]').html(this.select('#page [class^="page-inner"]').html())
        window.adBlocker = setTimeout(cleanAdsStyle, 100)
        loading.end().remove()
        console.log('下一页加载完成')
      })
      this.iframe.attr('src', next.attr('href'))
    }
    // const config = { ...data }
    const config = {}
    if (!config.hasOwnProperty('enable')) {
      config.enable = true
    }
    if (!config.hasOwnProperty('autoPaging')) {
      config.autoPaging = true
    }
    if (!config.enable) {
      // sendResponse('未开启百度页面配置')
      return
    }
    if (!config.autoPaging) {
      Pagination.prototype.nextPage = function() { }
    }

    function initial() {
      const $body = $('body')
      if (!$body.length) {
        setTimeout(initial)
        return
      }
      $body.attr('baidu', location.href.indexOf('wd=') >= 0 ? 'wd' : '')
      // const FaviconMapping = config.injectConfig && config.injectConfig.FaviconMapping || {}
      // const defaultIcon = 'https://baidu.com/favicon.ico'
      // function faviconParse(result) {
      //   const footer = result.querySelector('.c-showurl')
      //   if (!footer) {
      //     return defaultIcon
      //   }
      //   const text = footer.innerText
      //   const key = Object.keys(FaviconMapping).find(regex => new RegExp(regex, 'gi').test(text))
      //   if (key) {
      //     return FaviconMapping[key]
      //   }
      //   const hostIndex = text.indexOf('/')
      //   if (hostIndex >= 0) {
      //     return 'http://' + text.substring(0, hostIndex) + '/favicon.ico'
      //   }
      //   return defaultIcon
      // }
      // $('[baidu] #content_left .result,[baidu] #content_left .result-op').each(function() {
      //   const h3 = $(this).find('h3')
      //   if (h3.find("img").length) {
      //     return
      //   }
      //   $(`<img src="${faviconParse(this)}" alt=""/>`).css({
      //     width: '24px',
      //     height: '24px',
      //     margin: '0 5px',
      //     display: 'inline-block'
      //   }).on('error', function() {
      //     this.src = defaultIcon
      //   }).prependTo(h3)
      // })
      const target = $('[baidu] #content_left')[0]
      if (!target) {
        setTimeout(initial)
        return
      }
      // Firefox和Chrome早期版本中带有前缀
      const MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver
      // 选择目标节点
      // 配置观察选项,传入目标节点和观察选项
      new MutationObserver(mutations => {
        mutations.flatMap(mutation => Array.from(mutation.addedNodes))
            .filter(node => node.querySelector && node.querySelector('[class*="ec_tuiguang_pplink"]'))
            .forEach(node => (node.className += ' tuner-ads-block'))
      }).observe(target, { childList: true })
      // 随后,你还可以停止观察
      // observer.disconnect()
      // sendResponse('已完成百度页面配置初始化')
    }

    setTimeout(initial)
  }
}
</script>
<style>
html {
  overflow-y: auto !important;
}

[baidu] [mu*="://b2b.baidu.com"],
[baidu] #s-top-left.s-isindex-wrap,
[baidu] #s_wrap.s-isindex-wrap,
[baidu] #bottom_layer.s-isindex-wrap,
[baidu] .s-isindex-wrap .s-top-nav,
[baidu] #bottom_space.s-bottom-space,
[baidu] #s_side_wrapper, [baidu] #foot,
[baidu] #container #rs, [baidu] .toindex,
[baidu] #container #content_right,
[baidu] [href^='/sf/vsearch'],
[baidu] [href*='zhidao.baidu.com'],
[baidu] [href*='wenku.baidu.com'],
[baidu] [href*='b2b.baidu.com'],
[baidu] [mu*='.recommend_list.baidu.com'],
[baidu] .new-pmd .c-recommend, [baidu] .tuner-ads-block,
[baidu] #content_left > div.c-group-wrapper [class*="button-list_"] {
  display: none !important;
}

[baidu='wd'] div[tpl='rel-timeline'] {
  display: flex;
}

[baidu='wd'] div[tpl='rel-timeline'] > div {
  width: 100%;
}

[baidu='wd'] #content_left > div.c-group-wrapper ul[class*='timeline_'] {
  width: auto;
}

[baidu='wd'] #content_left div.c-row > a.c-img {
  margin: 0 10px;
}

[baidu='wd'] #content_left .op-tieba-star-maintable td {
  padding: 0 10px;
}

[baidu] #container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 !important;
  margin: 0 !important;
  width: auto !important;
}

[baidu] #head {
  display: flex;
  min-height: unset;
  justify-content: center;
}

[baidu='wd'] #head {
  backdrop-filter: blur(8px);
  background-color: rgba(255, 255, 255, 0.5);
  flex-direction: row-reverse;
}

[baidu] #head_wrapper {
  height: 100%;
}

[baidu] #head_wrapper .s_form {
  width: fit-content;
}

[baidu='wd'] div.wrapper_new {
  display: flex !important;
  align-items: center;
  flex-direction: column;
}

[baidu='wd'] div.wrapper_new #wrapper_wrapper {
  margin: 0;
}

[baidu='wd'] div.wrapper_new #head {
  max-width: 1200px;
}

[baidu='wd'] .wrapper_new .fm {
  margin: 15px 5px !important;
}

[baidu='wd'] .wrapper_new.wrapper_s .s_ipt_wr {
  width: calc(100% - 115px) !important;
}

[baidu='wd'] .wrapper_s .soutu-env-nomac #kw {
  width: calc(100% - 48px) !important
}

[baidu='wd'] .wrapper_new #s_tab.s_tab .s_tab_inner {
  padding: 0 !important;
  display: flex !important;
  justify-content: center;
}

[baidu='wd'] #head #head_wrapper,
[baidu='wd'] #head .head_wrapper {
  justify-content: center !important;
  width: fit-content !important;
  display: flex !important;
  margin: 0 !important;
}

[baidu='wd'] #u {
  position: relative;
}

[baidu='wd'] #container.sam_newgrid .search_tool_conter,
[baidu='wd'] #container.sam_newgrid .nums {
  display: flex;
  justify-content: space-between;
  flex-direction: row-reverse;
  width: 100% !important;
}

[baidu='wd'] .container_l.sam_newgrid {
  width: unset !important;
  margin: 0 !important;
}

[baidu='wd'], [baidu='wd'] .wrapper_new #head {
  min-width: unset !important;
}

[baidu] #s_tab, [baidu] #bdpcImgTab {
  padding: 60px 0 0 0 !important;
}

[baidu] #s_tab .s_tab_inner,
[baidu] #s_tab .tab-wrapper,
[baidu] #bdpcImgTab #bdpcImgTopTab {
  display: flex;
  justify-content: center;
}

[baidu] #content_left,
[baidu] .head_nums_cont_outer,
[baidu] .head_nums_cont_inner > div {
  width: 90% !important;
  min-width: 800px;
  max-width: 1200px;
}

/*[baidu] #container.sam_newgrid #content_left {*/
/*    min-width: 800px;*/
/*    max-width: 1200px;*/
/*}*/

[baidu] .new-pmd .c-span9,
[baidu] #content_left .result.c-container,
[baidu] #content_left .result-op.c-container {
  width: unset !important;
}

[baidu] #content_left {
  padding: 0 !important;
}

[baidu] #content_left .new-pmd.c-container {
  width: 100% !important;
}

[baidu] #content_left .result,
[baidu] #content_left-op .result {
  padding: 10px !important;
  margin: 10px 0 !important;
  border-radius: 4px;
  box-sizing: border-box;
  background-color: #fff;
  border: 1px solid #ebeef5;
  overflow: hidden;
  color: #303133;
  transition: .3s;
}

[baidu] #content_left .result:hover,
[baidu] #content_left .result-op:hover {
  background-color: transparent;
  box-shadow: rgba(0, 0, 0, .1) 0 0 12px 8px !important;
}

[baidu] #content_left .result h3,
[baidu] #content_left .result-op h3 {
  border-bottom: 1px solid #ebeef5;
  box-sizing: border-box;
  padding: 5px 0;
  font-size: 20px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

[baidu] #content_left .result h3:before,
[baidu] #content_left .result-op h3:before {
  margin: 0;
  width: 5px;
  left: -14px;
  content: '';
  height: 20px;
  border: none;
  position: relative;
  border-radius: 2.5px;
  background-color: #2196f3;
}

[baidu] #content_left .result .c-row,
[baidu] #content_left .result-op .c-row {
  width: 100%;
  display: flex;
}

[baidu] #content_left .result .c-row .c-span3,
[baidu] #content_left .result-op .c-row .c-span3 {
  width: auto;
  position: relative;
}

div.op-short-video-pc-img-new {
  height: auto;
}

[baidu] #content_left .result-op[tpl="game-page-office"] .c-row > div {
  width: 100%;
}

[baidu] #content_left .result > div:not(.c-row),
[baidu] #content_left .result-op > div:not(.c-row),
[baidu] #content_left .c-row > div {
  margin: 5px 10px !important;
  top: 0 !important;
}

[baidu] #content_left .result-op .op-short-video-pc,
[baidu] #content_left .result-op .op-img-address-desktop-cont {
  border: none;
  margin: 0 !important;
  display: flex !important;
  align-items: center !important;
  flex-direction: column !important;
  justify-content: space-evenly !important;
}

[baidu] #content_left .result-op .op-short-video-pc .c-row {
  margin: 0 5px !important;
}

[baidu] #content_left .result-op .op-img-address-link-menu {
  display: flex !important;
  justify-content: space-evenly !important;
}

[baidu] #page {
  display: flex;
  justify-content: center;
}

[baidu] #page [class^='page-inner'] {
  padding: 16px !important;
  display: inline-block;
  text-align: center;
}

[baidu] .op-img-address-divide-high {
  width: 50%;
  display: flex;
  justify-content: space-evenly;
}

[baidu] .op-img-address-desktop-cont {
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

[baidu] #container.sam_newgrid #content_left .result-op {
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-sizing: border-box;
  min-width: 1000px;
  padding: 10px;
}

[baidu] #container.sam_newgrid .c-container .t,
[baidu] #container.sam_newgrid .c-container .c-title {
  margin-left: 4px;
}

[baidu] .new-pmd [class^=gameinfo_] .c-img-s {
  padding-bottom: unset !important;
  overflow: visible !important;
}

[baidu] .new-pmd [class*=platform-img_] {
  width: auto !important;
}

[baidu] [class^='image-one-line'] {
  display: flex;
  justify-content: center;
}

[baidu] [class^='image-normal-tags'] {
  display: flex;
  justify-content: space-evenly;
}

[baidu] [class^='content_'] .c-row {
  display: flex;
  margin: 0 !important;
  justify-content: space-evenly;
}

[baidu] [class*='video-main-title'] {
  max-width: 128px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

[baidu] tr[class^='op-tieba-novel-tr'] td {
  padding: 4px;
  font-size: 16px;
  width: fit-content;
}

[baidu] tr[class^='op-tieba-novel-tr'] td:last-child {
  text-align: right;
}
</style>
