const TEMPLATE = `
<i class="tuner-loading-layer display-none">
  <i class="tuner-loading-wrapper">
    <i class="tuner-loading-block">
      <i class="tuner-loading-path1"></i>
      <i class="tuner-loading-path2"></i>
      <i class="tuner-loading-path3"></i>
      <i class="tuner-loading-path4"></i>
    </i>
  </i>
</i>`

class LoadingMask {
  constructor(options) {
    this.options = options
  }

  create() {
    const selector = this.options.selector || 'body'
    const layerStyle = $.extend({}, this.options.layerStyle)
    const spinnerStyle = $.extend({}, this.options.spinnerStyle)
    this.loaded = $(TEMPLATE).css(layerStyle)
      .find('.tuner-loading-block').css(spinnerStyle).end()
      .appendTo(selector)
    return this
  }

  update(options) {
    $.extend(true, this.options, options)
    return this
  }

  start(countDown) {
    countDown = countDown || 0
    if (this.countDown) {
      this.countDown += countDown
    } else {
      this.countDown = countDown
    }
    if (!this.loaded || !this.loaded.length) {
      this.create()
    } else {
      this.loaded.css($.extend({}, this.options.layerStyle))
    }
    this.loaded.removeClass('display-none')
    return this
  }

  end() {
    if (this.countDown) {
      this.countDown--
    }
    if (this.countDown > 0) {
      return this
    }
    this.loaded.addClass('display-none')
    return this
  }

  remove() {
    return this.loaded.remove()
  }
}

if (!window.loading) {
  window.loading = new LoadingMask({})
  window.loading.mask = function () {
    if (arguments.length <= 0) {
      return window.loading
    }
    let options = { layerStyle: { 'position': 'absolute' } }
    const selector = arguments[0]
    if (typeof selector === 'string') {
      options.selector = selector
    } else if (typeof selector === 'object') {
      options = $.extend(true, options, selector)
    }
    return new LoadingMask(options)
  }
}
export const loading = window.loading
