// 解除站点的"复制限制"。必须在 document-start 阶段装，晚于页面脚本的话
// 页面先注册的监听器会比我们早跑（stopImmediatePropagation 只对"之后注册的"有效）。
//
// 两种限制方式都要处理：
//   1) addEventListener / jQuery .on()  → 捕获阶段拦下来，不让事件到达页面监听器
//   2) document.oncopy = ... 这类属性   → 定义成 getter 为 null、setter 空，
//      页面写了也挂不上（生效点是我们比它早，且它永远写不进去）
//
// 注意：只 stopImmediatePropagation，**不 preventDefault**——复制、选中、右键菜单
// 这些浏览器原生的行为要照常发生，我们只是不让页面的处理器插手。

const STOP_EVENTS = ['copy', 'cut', 'paste', 'selectstart', 'contextmenu', 'dragstart', 'beforecopy', 'beforecut', 'beforepaste']

const HANDLER_PROPS = [
  'oncopy', 'oncut', 'onpaste', 'onselectstart', 'oncontextmenu', 'ondragstart',
  'onbeforecopy', 'onbeforecut', 'onbeforepaste', 'onmousedown', 'onmouseup', 'onkeydown',
]

const INSTALLED_FLAG = '__nihilityCopyGuardInstalled'

// 输入框里的粘贴/快捷键别拦：站点的富文本框（评论框、代码编辑器）要靠这些事件
// 才能正确插入内容，拦掉虽然默认行为还在，但编辑器会当成"没有粘贴过"
function isEditable(target) {
  if (!target || !target.tagName) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!target.isContentEditable
}

function neutralizeHandlerProperties(target) {
  if (!target) return
  for (const prop of HANDLER_PROPS) {
    try {
      Object.defineProperty(target, prop, {
        configurable: true,
        get: () => null,
        // 页面想挂处理器？挂不上，静默吞掉
        set: () => undefined,
      })
    } catch (error) {
      // 少数对象不允许重定义，忽略即可（还有捕获阶段的拦截兜着）
    }
  }
}

// 行内属性写法的 <body oncopy="return false"> 也要清掉
function stripInlineHandlers(element) {
  if (!element) return
  for (const prop of HANDLER_PROPS) {
    if (element.hasAttribute?.(prop)) element.removeAttribute(prop)
  }
}

export function installCopyGuard() {
  if (window[INSTALLED_FLAG]) return
  window[INSTALLED_FLAG] = true

  const doc = document
  const stop = event => {
    if (isEditable(event.target)) return
    event.stopImmediatePropagation()
  }

  for (const type of STOP_EVENTS) {
    doc.addEventListener(type, stop, true)
  }

  // Ctrl/Cmd + C / X / A 是另一条常见路径（页面用 keydown 拦）
  doc.addEventListener('keydown', event => {
    if (isEditable(event.target)) return
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && /^[cCxXaA]$/.test(event.key)) {
      event.stopImmediatePropagation()
    }
  }, true)

  neutralizeHandlerProperties(doc)
  neutralizeHandlerProperties(window)
  stripInlineHandlers(doc.documentElement)

  // body 在 document-start 时可能还不存在
  const guardBody = () => {
    if (!document.body) {
      requestAnimationFrame(guardBody)
      return
    }
    neutralizeHandlerProperties(document.body)
    stripInlineHandlers(document.body)
    // 页面可能之后又给新元素挂 unselectable
    document.querySelectorAll('[unselectable]').forEach(element => element.removeAttribute('unselectable'))
  }
  guardBody()
}
