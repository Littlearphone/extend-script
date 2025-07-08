<template>
  <Settings
    panel-width="300px"
    panel-height="300px"
    ref="settingsElement"
    v-if="!isNestedWindow"
    @mounted="handleSettingsMounted"
  >
    <div class="nihility-config-item">
      <Switch label="注入配置" v-model="injectConfig"/>
    </div>
    <div class="nihility-config-item" v-if="injectConfig">
      <Switch label="自动翻页" v-model="autoPaging"/>
    </div>
    <div class="nihility-config-item" v-if="injectConfig">
      <Upload label="背景图片" @change="handleImageChange" @clear="handleImageClear" :thumbnail="background"/>
    </div>
    <div class="nihility-config-item" v-if="injectConfig">
      <Number label="背景模糊" v-model="bgBlur"/>
      <!--<Slider label="背景模糊" v-model="bgBlur" max="50">-->
      <!--  <template #tips="{value}">-->
      <!--    {{ value }}px-->
      <!--  </template>-->
      <!--</Slider>-->
    </div>
  </Settings>
</template>
<script setup>
import { toBase64 } from '../utils'
import { logger } from '../utils/logger.js'
import Number from '../components/Number.vue'
import Switch from '../components/Switch.vue'
import Upload from '../components/Upload.vue'
import { loading } from '../utils/loading.js'
import Settings from '../components/Settings.vue'
import { Pagination } from '../utils/pagination.js'
import { nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { addGlobalDraggableElement, DraggableElement } from '../utils/draggable.js'

const CONFIG_KEY = 'baidu-hack-config'

class BaiduPagination extends Pagination {
  nextPage() {
    if (!injectConfig.value || !autoPaging.value) {
      return logger.warn('该站点自动翻页未启用')
    }
    const nextPageLink = document.querySelector('#page strong + a')
    if (!nextPageLink) {
      return true
    }
    const mask = loading.mask({})
    const frameElement = top.document.createElement('iframe')
    frameElement.setAttribute('ref', 'noreferer')
    frameElement.setAttribute('scrolling', 'no')
    frameElement.onload = function () {
      mask.remove()
      const frames = top.document.querySelectorAll('iframe.nihility-frame')
      frames.forEach(frame => {
        const frameDocument = frame.contentWindow.document
        frame.style.height = frameDocument.documentElement.offsetHeight + 'px'
      })
      const frameDocument = frameElement.contentWindow.document
      const nestedPage = frameDocument.querySelector('.result-molecule:has(#page)')
      if (nestedPage) {
        frames[frames.length - 1].after(nestedPage)
      }
    }
    frameElement.classList.add('nihility-frame')
    frameElement.src = nextPageLink.href
    const pager = top.document.querySelector('.result-molecule:has(#page), #page')
    if (pager) {
      const frameWrapper = top.document.createElement('div')
      frameWrapper.classList.add('nihility-frame-wrapper')
      frameWrapper.appendChild(frameElement)
      pager.after(frameWrapper)
      pager.remove()
      const frameRect = frameElement.getBoundingClientRect()
      mask.update({
        selector: frameWrapper,
        layerStyle: {
          width: '100%',
          backdropFilter: 'none',
          backgroundColor: 'white',
          height: `${frameRect.height}px`,
          top: `${frameElement.offsetTop}px`,
        }
      }).start()
    }
    return true
  }
}

const isNestedWindow = ref(document.querySelector('body[nested-window]'))
const config = reactive(JSON.parse(GM_getValue(CONFIG_KEY, '{}')))
const injectConfig = ref(config.injectConfig || false)
const autoPaging = ref(config.autoPaging || false)
const background = ref(config.background || '')
const bgBlur = ref(config.bgBlur || 0)
const pagination = shallowRef(new BaiduPagination())
const settingsElement = shallowRef()

watch(injectConfig, value => {
  config.injectConfig = value
  GM_setValue(CONFIG_KEY, JSON.stringify(Object.assign({}, config)))
  nextTick(() => top.location.reload())
})
watch(autoPaging, value => {
  config.autoPaging = value
  pagination.value.scrollListener()
  GM_setValue(CONFIG_KEY, JSON.stringify(Object.assign({}, config)))
})
watch(background, value => {
  config.background = value
  setBodyBackground(value)
  GM_setValue(CONFIG_KEY, JSON.stringify(Object.assign({}, config)))
})
watch(bgBlur, value => {
  config.bgBlur = value
  setBodyBgBlur(value)
  GM_setValue(CONFIG_KEY, JSON.stringify(Object.assign({}, config)))
})

async function handleImageChange(files) {
  background.value = await toBase64(files[0])
}

function handleImageClear() {
  background.value = ''
}

function setBodyBackground(image) {
  if (typeof image === 'string') {
    top.document.body.style.setProperty('--baidu-background-image', `url('${image}')`)
  }
}

function setBodyBgBlur(blur) {
  top.document.body.style.setProperty('--baidu-background-blur', `${blur}px`)
}

function reactiveHandler() {
  const selector = '[data-placeid]:has([data-tuiguang])'
  if (!document.querySelector(selector)) {
    return setTimeout(reactiveHandler, 500)
  }
  const adList = document.querySelectorAll(selector)
  adList.forEach(item => item.remove())
}

let pagingTimer

function detectHeight() {
  if (!location.host.endsWith('baidu.com')) {
    return
  }
  if (pagingTimer) {
    clearTimeout(pagingTimer)
  }
  if (pagination.value.isPageBottom() && !document.querySelector('.nihility-frame .tuner-loading-layer')) {
    pagination.value.scrollListener()
  }
  pagingTimer = setTimeout(detectHeight, 300)
}

class BaiduSettingsButton extends DraggableElement {
  dragFinish() {
    nextTick(() => settingsElement.value.updatePosition())
  }
}

function handleSettingsMounted() {
  nextTick(() => {
    if (isNestedWindow.value) {
      return logger.debug('百度搜索分页加载完成')
    }
    logger.debug('初始化百度搜索设置按钮')
    const settingsButton = settingsElement.value.button
    const bounds = settingsButton.getBoundingClientRect()
    addGlobalDraggableElement(new BaiduSettingsButton(settingsButton, {
      initialX: 80,
      initialY: window.innerHeight - 80 - bounds.height,
      minX: 0, maxX: window.innerWidth - bounds.width,
      minY: 0, maxY: window.innerHeight - bounds.height
    }))
    settingsElement.value.updatePosition()
    settingsElement.value.closePanel()
  })
  pagination.value.offScrollListener()
  requestAnimationFrame(detectHeight)
  logger.debug('注入百度搜索页面背景')
  if (injectConfig.value && background.value) {
    setBodyBackground(background.value)
  }
  if (injectConfig.value && bgBlur.value) {
    setBodyBgBlur(bgBlur.value)
  }
}

onMounted(() => {
  reactiveHandler()
})
</script>
<style lang="scss">
html:has([www-baidu-com]) {
  overflow-y: auto !important;

  :root {
    --baidu-background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Vg8AAnEBdzTCX3oAAAAASUVORK5CYII=);
    --baidu-background-color: #f6f6f6;
    --baidu-background-blur: 12px;
  }

  .nihility-config-item {
    .slider-tips {
      white-space: nowrap;
    }
  }
}

[www-baidu-com] {
  min-height: auto;
  min-width: 1125px;

  .nihility-frame-wrapper {
    &, .nihility-frame {
      width: 100%;
      border: none;
      z-index: 100;
      position: relative;
    }
  }

  #foot,
  #top-ad,
  .toindex,
  div.c-tools,
  div#searchTag,
  #container #rs,
  #s_side_wrapper,
  #header_top_bar,
  .tuner-ads-block,
  .tenon_pc_material,
  .new-pmd .c-recommend,
  #s_wrap.s-isindex-wrap,
  [href*='b2b.baidu.com'],
  [mu*="://b2b.baidu.com"],
  #container #content_right,
  .result:has(.baozhang-new),
  #s-top-left.s-isindex-wrap,
  .s-isindex-wrap .s-top-nav,
  [class*='sku-item_'] a span,
  #bottom_space.s-bottom-space,
  #bottom_layer.s-isindex-wrap,
  [tpl="ads_b2c_universal_card"],
  [class*='first-item-sub-abs_'],
  .result-op:has(.wd-ai-index-pc),
  [mu*='.recommend_list.baidu.com'],
  .s_tab_inner [href^='/sf/vsearch'],
  div.result:has([href*='baidu.php']),
  [data-placeid]:has([data-tuiguang]),
  .s_tab_inner [href*='wenku.baidu.com'],
  .s_tab_inner [href*='zhidao.baidu.com'],
  div.result-molecule.new-pmd:has(#rs_new),
  #content_left > div.c-group-wrapper [class*="button-list_"] {
    display: none !important;
  }

  &[nested-window] {
    background-color: transparent;

    #wrapper_wrapper > :not(#container),
    #wrapper > :not(#wrapper_wrapper),
    #container > :not(#content_left),
    > :not(#wrapper),
    &::before,
    &::after {
      display: none !important;
    }
  }

  iframe[class="tuner-page-frame"],
  &[nested-window] #wrapper_wrapper {
    border: 0;
    width: 100%;
  }

  &.cos-pc .wd-ai-index-pc {
    width: 100%;
  }

  &::before,
  &::after {
    position: fixed;
    height: 100%;
    width: 100%;
    content: '';
    left: 0;
    top: 0;
  }

  &::after {
    backdrop-filter: blur(var(--baidu-background-blur));
  }

  &::before {
    background-image: var(--baidu-background-image);
    background-color: var(--baidu-background-color);
    background-position: center;
    background-repeat: repeat-y;
    background-size: cover;
  }

  div[tpl='rel-timeline'] {
    display: flex;

    & > div {
      width: 100%;
    }
  }


  #content_left {
    margin: 0 !important;
    padding: 0 !important;

    .result,
    &-op .result {
      color: #303133;
      transition: .3s;
      overflow: hidden;
      border-radius: 4px;
      margin: 0 !important;
      box-sizing: border-box;
      border: 1px solid #ebeef5;
      padding: 0 10px !important;
      background-color: #ffffffaa;
      backdrop-filter: blur(12px);
      margin-bottom: 8px !important;
    }

    &-op .result {
      position: relative;
    }

    .result,
    .result-op {
      position: relative;

      &:has(.cosc-card-content) {
        display: none !important;
      }

      &:hover {
        background-color: white;
        box-shadow: 0 0 16px 0 #056de888 !important;
      }

      &.c-container {
        width: unset !important;
      }

      h3 {
        display: flex;
        padding: 5px 0;
        font-size: 20px;
        align-items: center;
        box-sizing: border-box;
        justify-content: flex-start;
        border-bottom: 1px solid #ebeef5;

        &:before {
          width: 5px;
          content: '';
          height: 20px;
          border: none;
          margin-right: 8px;
          position: relative;
          border-radius: 2.5px;
          background-color: #2196f3;
        }
      }

      .c-row .c-span3 {
        width: auto;
        position: relative;
      }

      .c-row:not([class*='select-wrapper_']):not([class*='video-wrapper_']):not([class*='blog-divider']) {
        width: 100%;
        display: flex;
        align-items: center;
      }
    }

    .result-op[tpl="game-page-office"] .c-row > div {
      width: 100%;
    }

    .result > div:not(.c-row):not([class*='blog-more-wrap']),
    .result-op > div:not(.c-row):not([class*='blog-more-wrap']),
    .c-row > div:not([class*='blog-more-wrap']) {
      margin: 8px 10px;
      top: 0 !important;

      &.c-result-content,
      &[class*=_aladdin_] {
        margin: 8px 0;
      }
    }

    div[class*='blog-more-wrap'] {
      margin: 8px auto;

      a {
        padding: 8px 0;
      }
    }

    .result-op {
      .op-short-video-pc,
      .op-img-address-desktop-cont {
        border: none;
        margin: 0 !important;
        display: flex !important;
        align-items: center !important;
        flex-direction: column !important;
        justify-content: space-evenly !important;
      }

      .op-short-video-pc .c-row {
        margin: 0 5px !important;
      }

      .op-img-address-link-menu {
        display: flex !important;
        justify-content: space-evenly !important;
      }
    }


    .new-pmd.c-container {
      width: 100% !important;
    }

    & > div.c-group-wrapper ul[class*='timeline_'] {
      width: auto;
    }

    div.c-row > a.c-img {
      margin: 0 10px;
    }

    .op-tieba-star-maintable td {
      padding: 0 10px;
    }

    div.new-pmd span.c-color-gray2 ~ a {
      width: calc(100% - 256px);
    }

    div.new-pmd span.c-color-gray2 ~ div {
      margin: 0 !important;
    }
  }

  #head {
    display: flex;
    min-height: unset;
    justify-content: center;
    backdrop-filter: blur(8px);
    flex-direction: row-reverse;
    background-color: rgba(255, 255, 255, 0.5);

    &.no-box-shadow {
      box-shadow: 0 0 14px 2px #00000066 !important;
    }

    &_wrapper,
    .head_wrapper {
      height: 100%;
      }
    }

    &_wrapper,
    .head_wrapper {
      display: flex !important;
      margin: 0 !important;
    }
  }

  div.wrapper_new {
    display: flex !important;
    align-items: center;
    flex-direction: column;

    &.wrapper_s .s_ipt_wr {
      width: calc(100% - 115px) !important;
    }

    #wrapper_wrapper {
      margin: 0;
    }

    #head {
      left: 0;
      right: 0;
      margin: auto;
    }

    .fm {
      margin: 15px 5px !important;
    }

    #s_tab.s_tab .s_tab_inner {
      z-index: 1;
      width: 100%;
      max-width: 1125px;
      padding: 0 !important;
      justify-content: center;
      display: flex !important;
      backdrop-filter: blur(12px);
      background-color: #ffffffb0;
    }
  }


  .wrapper_s .soutu-env-nomac #kw {
    width: calc(100% - 48px) !important
  }

  div.result-molecule {
    #s_tab {
      &::after, &::before {
        display: none;
      }
    }

    #s_tab,
    &:has(#s_tab),
    &:has(#tsn_inner) {
      z-index: 1;
      width: 100%;
      display: flex;
      max-width: 1125px;
      justify-content: center;
      backdrop-filter: blur(12px);
    }
  }

  div.result-molecule:has(#tsn_inner) {
    margin-bottom: 8px;
  }

  div[tpl="app/search-tool"] {
    background-color: #ffffffb0;

    span[class^=hint_],
    div[class^=options_] {
      color: #222;
    }
  }

  #u {
    position: absolute;
  }

  #container.sam_newgrid .search_tool_conter,
  #container.sam_newgrid .nums {
    display: flex;
    justify-content: space-between;
    flex-direction: row-reverse;
    width: 100% !important;
  }

  .container_l.sam_newgrid {
    width: unset !important;
    margin: 0 !important;
  }

  #s_tab, #bdpcImgTab {
    padding: 72px 0 0 0 !important;
  }

  #s_tab .s_tab_inner,
  #s_tab .tab-wrapper,
  #bdpcImgTab #bdpcImgTopTab {
    display: flex;
    justify-content: center;
  }

  #content_left,
  .head_nums_cont_outer,
  .head_nums_cont_inner > div {
    width: 100% !important;
    min-width: 800px;
    max-width: 1125px;
  }

  .new-pmd .c-span9 {
    width: unset !important;
  }

  div[class*='video-wrapper_'] {
    &[class*='show_'] ~ .c-row div.c-span12[class*='main-info_'] {
      width: 100%;
    }

    video {
      width: 100%;
      background-color: black;
    }
  }


  div[class*='avatar-wrapper'] a[class*='text-pc'] {
    position: unset;
    transform: none;
    max-width: fit-content;
    -webkit-transform: none;
  }

  div[class*='image-wallpaper-span_'] {
    width: fit-content;
  }

  div[class*='image-wallpaper-card_'] {
    div.c-row:not([class*='select-wrapper_']) {
      justify-content: center;
    }

    div[class*='image-tags-menu_'] {
      justify-content: space-evenly;
    }
  }

  div.op-short-video-pc-img-new {
    height: auto;
  }

  #page {
    margin: 0;
    z-index: 1;
    display: flex;
    position: relative;
    justify-content: center;

    [class^='page-inner'] {
      padding: 16px !important;
      display: inline-block;
      text-align: center;
    }
  }

  .op-img-address-divide-high {
    width: 50%;
    display: flex;
    justify-content: space-evenly;
  }

  .op-img-address-desktop-cont {
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.05);
  }

  #container {
    z-index: 1;
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
    padding: 0 !important;
    margin: 0 !important;
    width: auto !important;

    #gotoPage {
      padding: 0 6px;
      background-color: #fff6;
    }

    &.sam_newgrid {
      #content_left {
        .result-op {
          border: 1px solid rgba(0, 0, 0, 0.05);
          background-color: #ffffffaa;
          backdrop-filter: blur(12px);
          box-sizing: border-box;
          margin-bottom: 8px;
          min-width: 1000px;
          padding: 10px;

          &:hover {
            transition: .3s;
            background-color: white;
          }
        }

        table.result-op {
          margin: 0;
          width: 100%;

          td {
            padding: 10px;
          }

          #op_wiseapp {
            margin: 0;
            padding: 0;
            width: 100%;
          }
        }
      }

      .c-container .t,
      .c-container .c-title,
      #content_left table.result-op h3 {
        margin-left: 4px;
      }
    }

    div.new-pmd.c-container h3.c-title {
      margin-left: -6px;
    }
  }

  .new-pmd {
    [class^=gameinfo_] .c-img-s {
      padding-bottom: unset !important;
      overflow: visible !important;
    }

    [class*=platform-img_] {
      width: auto !important;
    }
  }

  [class^='image-one-line'],
  [class^='image-two-line'] {
    display: flex;
    justify-content: center;
  }

  [class^='image-normal-tags'] {
    display: flex;
    justify-content: space-evenly;
  }

  [class^='content_'] .c-row {
    display: flex;
    margin: 0 !important;
    justify-content: space-evenly;
  }

  [class*='video-main-title'] {
    max-width: 128px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  tr[class^='op-tieba-novel-tr'] td {
    padding: 4px;
    font-size: 16px;
    width: fit-content;
  }

  tr[class^='op-tieba-novel-tr'] td:last-child {
    text-align: right;
  }

  //.newTimeFactor_before_abs,
  .new-pmd span.c-color-gray2 {
    //width: 72px;
    padding: 2px 8px;
    margin-right: 8px;
    text-align: center;
    color: white !important;
    border: 1px solid #409eff;
    background-color: #409eff;
  }

  div[class*='first-item-title'],
  div[class*='c-gap-bottom-mini'] {
    margin-bottom: 3px;
    justify-content: space-between;
  }

  .newTimeFactor_before_abs,
  .c-gap-top-small span.c-color-gray2,
  .c-gap-top-middle span.c-color-gray2 {
    padding: 0 8px;
    white-space: nowrap;
    width: fit-content !important;
  }

  //.newTimeFactor_before_abs > *,
  //.c-gap-top-small span.c-color-gray2,
  //.c-gap-top-middle span.c-color-gray2 {
  //  color: white !important;
  //}

  a.kuaizhao,
  [data-click*='snapshot'] {
    top: 10px;
    right: 10px;
    padding: 0 8px;
    border-radius: 4px;
    position: absolute;
    display: inline-block;
    color: #555 !important;
    border: 1px solid #dadada;
    transition: background-color 500ms;
    background-image: linear-gradient(to bottom, #fcfcfc, #f0f0f0);
  }

  a.kuaizhao:hover,
  .new-pmd .kuaizhao:hover,
  .new-pmd .snapshoot:hover,
  [data-click*='snapshot']:hover {
    background-color: rgba(144, 147, 153, .8);
  }

  #wrapper #con-at {
    padding: 0;
  }

  .wrapper_l #con-at .result-op {
    display: flex;
    justify-content: center;
  }

  .wrapper_l #con-at .result-op [class*='boiling-all_'] {
    margin-left: 0;
  }

  [tpl="sp_hot_sale"] .c-row {
    justify-content: space-evenly;
  }

  [class*='sku-item_'] {
    display: flex;
    align-items: center;
    flex-direction: column;
  }

  [class*='sku-item_'] [class*='desc_'] {
    width: 128px;
  }

  [class*='sku-item_'] a {
    padding: 0;
    display: contents;
  }

  [class*='sku-item_'] a img {
    box-shadow: 0 2px 10px 0 rgba(0, 0, 0, .1);
  }

  [class*='sku-item_'] a img:hover {
    box-shadow: 0 2px 10px 0 rgba(0, 0, 0, .3);
  }

  .op_dict3_lineone_result {
    width: 100%;
  }

  .op_dict3_linetwo_result {
    width: 100%;
    padding-left: 90px;
  }
}
</style>
