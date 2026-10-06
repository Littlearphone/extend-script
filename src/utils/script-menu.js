// 油猴面板（点扩展图标弹出的那个）里的菜单项。
//
// 菜单显示的是**当前标签页里活跃脚本注册了什么**，所以"按页面注册不同条目"是天然支持的：
// 每个 view 在自己的挂载点注册自己的那几条就行，没有匹配脚本的页面自然什么都不显示。
//
// 两个必须自己处理的事：
//   1. **SPA 跳转不会重跑脚本** —— 注册过的条目不会跟着 URL 变，得在导航后重新注册；
//   2. **iframe 会各注册一份** —— 同名条目会合并成一条，但回调默认在每个注册过的 frame 里都跑，
//      所以调用方应当只在顶层窗口注册（见 BilibiliVideo.vue 里的 window.top 判断）。

// 同一个 key 重复注册时走 `id` 更新，而不是越挂越多条
const registeredIds = new Map()

export function menuCommandAvailable() {
  return typeof GM_registerMenuCommand === 'function'
}

/**
 * 注册/更新一条面板菜单。
 * @param key 本地标识（用来找回上一次的条目 id）
 * @param name 显示文案（下载中要改文字就再调一次）
 * @param handler 点它的时候干什么
 * @param options 透传给 GM_registerMenuCommand（accessKey / title / clickedFrame 等）
 */
export function setMenuCommand(key, name, handler, options = {}) {
  if (!menuCommandAvailable()) {
    // 本地开发与 Playwright 注入时没有这个 API，安静跳过（别让整页脚本挂掉）
    return null
  }
  const id = registeredIds.get(key)
  const newId = GM_registerMenuCommand(name, handler, id === undefined ? options : { ...options, id })
  registeredIds.set(key, newId)
  return newId
}
