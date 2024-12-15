export function toggleClass(selector, className) {
  const panel = typeof selector === 'string' ? $(selector)[0] : selector
  if (panel.classList.contains(className)) {
    panel.classList.remove(className)
  } else {
    panel.classList.add(className)
  }
}

export function addStyle(id, style) {
  const styleElement = document.querySelector(`#${id}`) || (function () {
    const element = document.createElement('style')
    document.head.appendChild(element)
    element.id = id
    return element
  })()
  styleElement.innerHTML = style
  // const sheet = styleElement.sheet
  // sheet.insertRule(style, (sheet.rules || sheet.cssRules || []).length)
}

export function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
  })
}
