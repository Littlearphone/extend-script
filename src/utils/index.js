function clamp(w, lo, hi) {
    return w < lo ? lo : w > hi ? hi : w
  }
  
  export function makeDraggable(el) {
    if (!el) {
      return
    }
    const bounds = el.getBoundingClientRect()
    const defaultPosition = Object.assign({}, { x: 80, y: window.innerHeight - 80 - bounds.height })
  
    function triggerMove(position) {
      el.style.transform = `translate(${position.x}px,${position.y}px)`
    }
  
    const state = {
      eventToCoordinates(event) {
        return { x: event.clientX, y: event.clientY }
      },
      location: false,
      dragging: false,
      _pos: defaultPosition,
      get pos() {
        return this._pos
      },
      set pos(p) {
        const bounds = el.getBoundingClientRect()
        this._pos = {
          x: clamp(p.x, 0, window.innerWidth - bounds.width),
          y: clamp(p.y, 0, window.innerHeight - bounds.height)
        }
        triggerMove(this._pos)
      },
    }
  
    // from https://www.redblobgames.com/making-of/draggable/
    function start(event) {
      if (event.button !== 0) {
        return
      }
      // left button only
      const { x, y } = state.eventToCoordinates(event)
      state.location = { dx: state.pos.x - x, dy: state.pos.y - y }
      el.setPointerCapture(event.pointerId)
    }
  
    function end(event) {
      el.releasePointerCapture(event.pointerId)
      if (state.dragging) {
        updatePosition('.nihility-config-panel', state)
      }
      state.dragging = false
      state.location = false
    }
  
    function move(event) {
      if (!state.location) {
        return
      }
      const { x, y } = state.eventToCoordinates(event)
      const originalX = state.pos.x
      const originalY = state.pos.y
      const currentX = x + state.location.dx
      const currentY = y + state.location.dy
      state.dragging = currentX !== originalX || currentY !== originalY
      state.pos = { x: currentX, y: currentY }
    }
  
    el.addEventListener('pointerdown', start)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
    el.addEventListener('pointermove', move)
  
    el.state = state
    locateConfigPanel()
    triggerMove(defaultPosition)
  }
  
  function locateConfigPanel() {
    const configElement = document.querySelector('.nihility-config-button')
    if (configElement && configElement.state) {
      updatePosition('.nihility-config-panel', configElement.state)
    }
  }
  
  export function toggleConfigPanel() {
    locateConfigPanel()
    toggleClass('.nihility-config-panel', 'nihility-config-panel-open')
  }
  
  export function updatePosition(selector, state) {
    const style = $(selector)[0].style
    style.inset = 'unset'
    if (state.pos.x > window.innerWidth - state.pos.x) {
      style.left = 'unset'
      style.right = `${window.innerWidth - state.pos.x - 20}px`
    } else {
      style.right = 'unset'
      style.left = `${state.pos.x + 40}px`
    }
    if (state.pos.y > window.innerHeight - state.pos.y) {
      style.top = 'unset'
      style.bottom = `${window.innerHeight - state.pos.y - 20}px`
    } else {
      style.bottom = 'unset'
      style.top = `${state.pos.y + 40}px`
    }
  }
  
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
  