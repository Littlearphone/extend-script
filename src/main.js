import './styles/index.scss'
import { createApp } from 'vue'
import { MAPPINGS } from './mappings'
import { logger } from './utils/logger.js'
import { installCopyGuard } from './utils/copy-guard.js'

// 必须在 document-start 就装：页面的复制限制是解析阶段注册的监听器，
// 等 DOMContentLoaded 再装就晚了一步（详见 utils/copy-guard.js）
if (/(^|\.)csdn\.net$/.test(location.hostname)) {
  installCopyGuard()
}


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
    // 内联关键样式，确保不依赖外部 CSS 加载时序
    Object.assign(nihilityEntry.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
    })
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
