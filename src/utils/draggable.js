// 拖拽范围的最小/最大值。
//
// ⚠️ `maxX`/`maxY` 在两种用法里含义不同，**不能一刀切**：
//   - 浮动按钮（`viewportBound: true`）：上限是"视口减去自身尺寸"，**必须每次按当前视口重算**。
//     初始化时算一次的话，窗口变大后按钮拖不到新的右边/下边（范围被锁在旧视口里）。
//   - 滑块（Slider.vue）：`maxX` 是**轨道长度**，是语义范围不是视口范围，只能原样用。
function boundsFor(element, options) {
  const minX = options.minX || 0
  const minY = options.minY || 0
  if (options.viewportBound) {
    const rect = element.getBoundingClientRect()
    return {
      minX,
      minY,
      maxX: Math.max(minX, window.innerWidth - rect.width),
      maxY: Math.max(minY, window.innerHeight - rect.height),
    }
  }
  return {
    minX,
    minY,
    // 视口仍然是硬上限（滚动条出现、窗口缩小都算），只是上限本身不再随视口增长
    maxX: typeof options.maxX === 'undefined' ? window.innerWidth : Math.min(options.maxX, window.innerWidth),
    maxY: typeof options.maxY === 'undefined' ? window.innerHeight : Math.min(options.maxY, window.innerHeight),
  }
}

export class DraggableElement {
  constructor(element, options) {
    const self = this
    this.options = options || {}
    this.element = typeof element === 'string' ? document.querySelector(element) : element

    // 计算视口约束下的初始位置，避免小窗口时跑到视口外
    const bounds = boundsFor(this.element, this.options)
    this.defaultPosition = Object.assign({}, {
      x: this.clamp(options.initialX || 0, bounds.minX, bounds.maxX),
      y: this.clamp(options.initialY || 0, bounds.minY, bounds.maxY),
    })

    this.state = {
      eventToCoordinates(event) {
        return { x: event.clientX, y: event.clientY }
      },
      location: false,
      dragging: false,
      _pos: this.defaultPosition,
      get pos() {
        return this._pos
      },
      set pos(p) {
        const options = self.options
        const { minX, minY, maxX, maxY } = boundsFor(self.element, options)
        const pos = {
          x: self.clamp(p.x, minX, maxX),
          y: self.clamp(p.y, minY, maxY),
        }
        this._pos = pos
        if (options.fragment) {
          const step = options.step
          const minValue = options.minValue || 0
          const maxValue = typeof options.maxValue === 'undefined' ? 100 : options.maxValue
          const maxSegment = Math.floor((maxValue - minValue) / step)
          if (options.vertical) {
            const stepLength = (maxY - minY) / maxSegment
            const actualStep = Math.round(pos.y / stepLength)
            const newY = stepLength * actualStep
            if (pos.y !== newY) {
              self.updateProgress(minValue + actualStep * step)
            }
          } else {
            const stepLength = (maxX - minX) / maxSegment
            const actualStep = Math.round(pos.x / stepLength)
            const newX = stepLength * actualStep
            if (pos.x !== newX) {
              self.updateProgress(minValue + actualStep * step)
            }
          }
        } else {
          if (options.vertical) {
            self.updateProgress(pos.y * 100 / maxY)
          } else {
            self.updateProgress(pos.x * 100 / maxX)
          }
        }
        self.triggerMove(this._pos)
      },
    }
    this.element.addEventListener('pointerdown', this.start.bind(this))
    this.element.addEventListener('pointerup', this.end.bind(this))
    this.element.addEventListener('pointercancel', this.end.bind(this))
    this.element.addEventListener('pointermove', this.move.bind(this))
    this.triggerMove(this.defaultPosition)
  }

  clamp(value, min, max) {
    return value < min ? min : value > max ? max : value
  }

  // from https://www.redblobgames.com/making-of/draggable/
  start(event) {
    if (event.button !== 0) {
      return
    }
    // left button only
    const { x, y } = this.state.eventToCoordinates(event)
    this.state.location = { dx: this.state.pos.x - x, dy: this.state.pos.y - y }
    this.element.setPointerCapture(event.pointerId)
  }

  move(event) {
    if (!this.state.location) {
      return
    }
    const { x, y } = this.state.eventToCoordinates(event)
    const originalX = this.state.pos.x
    const originalY = this.state.pos.y
    const currentX = x + this.state.location.dx
    const currentY = y + this.state.location.dy
    this.state.dragging = currentX !== originalX || currentY !== originalY
    this.state.pos = { x: currentX, y: currentY }
  }

  end(event) {
    this.element.releasePointerCapture(event.pointerId)
    if (this.state.dragging) {
      this.dragFinish()
    }
    this.state.dragging = false
    this.state.location = false
  }

  updateProgress(value) {

  }

  dragFinish() {

  }

  triggerMove(position) {
    const translateValue = `translate(${position.x}px,${position.y}px)`
    this.element.style.setProperty('--draggable-element-translate', translateValue)
  }
}

const draggableElements = []

// 窗口尺寸变化后把元素拉回可见区域。
//
// 这里只处理"越界"，不做"跟随"：用户拖到哪儿是哪儿。四条边都要看——只判右下的话，
// 窗口缩小到元素左边之外就会出现负坐标。赋值本身会经过 state.pos 的钳制。
export function relocateDraggableElements() {
  draggableElements.forEach(item => {
    const bounds = item.element.getBoundingClientRect()
    const { minX, minY } = boundsFor(item.element, item.options)
    const pos = Object.assign({}, item.state.pos)
    if (item.state.pos.x + bounds.width > window.innerWidth) {
      pos.x = window.innerWidth - bounds.width
    }
    if (item.state.pos.y + bounds.height > window.innerHeight) {
      pos.y = window.innerHeight - bounds.height
    }
    pos.x = Math.max(pos.x, minX)
    pos.y = Math.max(pos.y, minY)
    item.state.pos = pos
  })
}

window.addEventListener('resize', relocateDraggableElements)

export function addGlobalDraggableElement(element) {
  if (!element || draggableElements.some(draggableElement => draggableElement.element === element.element)) {
    return
  }
  draggableElements.push(element)
}

export function getGlobalDraggableElement(element) {
  return element && draggableElements.find(draggableElement => draggableElement.element === element)
}
