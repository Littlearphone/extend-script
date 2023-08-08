<script setup>
if ($ && !$.loading) {
  const TEMPLATE = `
<i class="tuner-loading-layer displayNone">
  <i class="tuner-loading-wrapper">
    <i class="tuner-loading-block">
      <i class="tuner-loading-path1"></i>
      <i class="tuner-loading-path2"></i>
      <i class="tuner-loading-path3"></i>
      <i class="tuner-loading-path4"></i>
    </i>
  </i>
</i>`
  const LoadingMask = function(options) {
    const selector = options.selector || 'body'
    const layerStyle = $.extend({}, options.layerStyle)
    const spinnerStyle = $.extend({}, options.spinnerStyle)
    this.loaded = $(TEMPLATE).css(layerStyle)
        .find('.tuner-loading-block').css(spinnerStyle).end()
        .appendTo(selector)
  }
  LoadingMask.prototype.start = function(countDown) {
    countDown = countDown || 0
    if (this.countDown) {
      this.countDown += countDown
    } else {
      this.countDown = countDown
    }
    this.loaded.removeClass("displayNone")
    return this
  }
  LoadingMask.prototype.end = function() {
    if (this.countDown) {
      this.countDown--
    }
    if (this.countDown > 0) {
      return this
    }
    this.loaded.addClass("displayNone")
    return this
  }
  LoadingMask.prototype.remove = function() {
    return this.loaded.remove()
  }
  $.loading = new LoadingMask({})
  $.loading.mask = function() {
    if (arguments.length <= 0) {
      return $.loading
    }
    let options = {}
    const selector = arguments[0]
    if (typeof selector === 'string') {
      options.selector = selector
    } else if (typeof selector === 'object') {
      options = $.extend(options, selector)
    }
    options.layerStyle = $.extend({ 'position': 'absolute' }, options.layerStyle)
    return new LoadingMask(options)
  }
}
if ($ && !$.detect) {
  $.detect = function(selector, callback) {
    const element = $(selector)
    if (!element.length) {
      setTimeout(() => $.detect(selector, callback), 100)
      return
    }
    console.log('找到', element)
    callback(element)
  }
}
</script>
<style>
.displayNone {
  display: none;
}

.tuner-loading-layer {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  position: fixed;
  backdrop-filter: blur(8px);
  background-color: rgba(255, 255, 255, .5);
}

.tuner-loading-block {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 64px;
  height: 64px;
  margin: auto;
  line-height: 82px;
  text-align: center;
  position: absolute;
  display: inline-block !important;
}

.tuner-loading-block i {
  opacity: .3;
  color: #2196f3;
  line-height: 0;
  font-size: 36px;
  font-weight: bold;
  display: inline-block;
  animation: icon-scale 1.5s infinite;
}

.tuner-loading-block i:before {
  content: 'I';
  font-style: italic;
}

.tuner-loading-path1 {
  animation-delay: 0s !important;
  transform-origin: 6% 50% 0;
}

.tuner-loading-path2 {
  animation-delay: .2s !important;
  transform-origin: 36% 50% 0;
}

.tuner-loading-path3 {
  animation-delay: .4s !important;
  transform-origin: 66% 50% 0;
}

.tuner-loading-path4 {
  animation-delay: .6s !important;
  transform-origin: 96% 50% 0;
}

@keyframes icon-scale {
  0%, to {
    opacity: .3;
    -webkit-transform: scale(1) translateZ(0);
    transform: scale(1) translateZ(0)
  }

  20%, 80% {
    opacity: .3;
    -webkit-transform: scale(1) translateZ(0);
    transform: scale(1) translateZ(0)
  }

  50% {
    opacity: 1;
    -webkit-transform: scale(1.7) translateZ(0);
    transform: scale(1.7) translateZ(0)
  }
}
</style>
