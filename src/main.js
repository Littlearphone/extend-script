import './styles/index.scss'
import { createApp } from 'vue'
import { MAPPINGS } from './mappings'
import { logger } from './utils/logger.js'


function loadModule(module) {
  if (!module) {
    return logger.info('没有合适的模块可启动')
  }

  function loadApp() {
    logger.debug(`页面结构加载完成，开始加载模块：${MAPPINGS[module].__name}`)
    document.removeEventListener('DOMContentLoaded', loadApp)
    if (top !== window) {
      document.body.setAttribute('nested-window', '')
    }
    document.body.setAttribute(location.hostname.replaceAll(/[.]/g, '-'), '')
    const dataId = 'nihility-entry'
    const nihilityEntry = document.createElement('div')
    nihilityEntry.setAttribute('data-id', dataId)
    document.body.appendChild(nihilityEntry)
    createApp(MAPPINGS[module]).mount(`[data-id="${dataId}"]`)
  }

  if (!document.body) {
    logger.debug('页面结构加载中...')
    return document.addEventListener('DOMContentLoaded', loadApp)
  }
  loadApp()
}

loadModule(Object.keys(MAPPINGS).find(key => new RegExp(key).test(location.href)))
