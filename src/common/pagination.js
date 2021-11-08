export const Pagination = function() {
  this.initial()
}
Pagination.prototype.initial = function(selector) {
  this.iframe = $('iframe#tuner-crx')
  if (!this.iframe.length) {
    console.log('创建隐藏iframe')
    this.iframe = $('<iframe></iframe>')
  }
  this.iframe.hide()
  this.iframe.attr('id', 'tuner-crx')
  this.iframe.appendTo('body')
}
Pagination.prototype.select = function(selector) {
  return $(selector, this.iframe.prop('contentDocument'))
}
Pagination.prototype.reloadFrame = function() {
  this.iframe.remove()
  this.initial()
}
Pagination.prototype.nextPage = function() {
  console.log('自动加载下一页')
}
window.PRELOAD_MARGIN = 200
// Listen for the scroll event
const scrollListener = event => {
  if (window.innerHeight >= document.body.scrollHeight) {
    return
  }
  if (window.innerHeight + window.scrollY < document.body.scrollHeight - window.PRELOAD_MARGIN) {
    return
  }
  window.pagination && window.pagination.nextPage()
}
document.removeEventListener('scroll', scrollListener)
document.addEventListener('scroll', scrollListener)
