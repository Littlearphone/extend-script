export class DraggableElement {
  constructor(element, options) {
    const self = this
    this.options = options || {}
    this.element = typeof element === 'string' ? document.querySelector(element) : element
    this.defaultPosition = Object.assign({}, {
      x: options.initialX || 0,
      y: options.initialY || 0
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
        const minX = options.minX || 0
        const minY = options.minY || 0
        const maxX = typeof options.maxX === 'undefined' ? window.innerWidth : options.maxX
        const maxY = typeof options.maxY === 'undefined' ? window.innerHeight : options.maxY
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

function relocateDraggableElements() {
  draggableElements.forEach(item => {
    const bounds = item.element.getBoundingClientRect()
    const pos = Object.assign({}, item.state.pos)
    if (item.state.pos.x + bounds.width > window.innerWidth) {
      pos.x = window.innerWidth - bounds.width
    }
    if (item.state.pos.y + bounds.height > window.innerHeight) {
      pos.y = window.innerHeight - bounds.height
    }
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
