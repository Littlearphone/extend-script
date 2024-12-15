window.GM_setValue = function (key, value) {
  return sessionStorage.setItem(key, value)
}
window.GM_getValue = function (key, defaultValue) {
  return sessionStorage.getItem(key) || defaultValue
}
