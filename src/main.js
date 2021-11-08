import { createApp } from 'vue'
import Baidu from './views/Baidu.vue'
import Bing from './views/Bing.vue'

const mappings = {
  'http(s)?:\/\/(www.)?baidu.com.*': Baidu,
  'http(s)?:\/\/cn.bing.com(\/search)?.*([?&]q=.*).*': Bing
}

function loadModule(module) {
  if (!module) {
    return
  }

  function loadApp() {
    document.removeEventListener('DOMContentLoaded', loadApp)
    const dataId = 'extend-script'
    document.body.innerHTML += `<div data-id="${dataId}"></div>`
    createApp(mappings[module]).mount(`[data-id="${dataId}"]`)
  }

  if (!document.body) {
    document.addEventListener('DOMContentLoaded', loadApp)
    return
  }
  loadApp()
}

loadModule(Object.keys(mappings).filter(key => new RegExp(key).test(location.href)))
