window.CONSOLE_BLUE = 'color: white;background: #409eff;padding: 0 8px;'
window.CONSOLE_DEBUG = 'color: white;background: #909399;padding: 0 4px'
window.CONSOLE_INFO = 'color: white;background: #67C23A;padding: 0 4px'
window.CONSOLE_WARN = 'color: white;background: #E6A23C;padding: 0 4px'
window.CONSOLE_ERROR = 'color: white;background: #F56C6C;padding: 0 4px'
if (!window.tuner) {
  function mergeArguments(from, to) {
    if (from && from.length) {
      Array.from(from).forEach(parameter => to.push(parameter))
    }
    return to
  }

  function formatMessage() {
    const parameters = Array.from(arguments)
    const level = parameters.shift()
    let message = document.title || location.hostname
    if (typeof parameters[0] === 'string' && parameters[0]) {
      message = parameters.shift()
    }
    let extraAction = null
    if (typeof parameters[0] === 'function') {
      extraAction = parameters.shift()
    }
    const prefix = logger.depth ? '' : '%cTuner-crx%c []~(￣▽￣)~* '
    const args = [
      prefix + `%c# ${message} %c`,
      CONSOLE_BLUE,
      '',
      level,
      ''
    ]
    if (logger.depth) {
      args.splice(1, 2)
    }
    if (parameters && parameters.length) {
      parameters.forEach(parameter => args.push(parameter))
    }
    if (!extraAction) {
      return console.log.apply(window, args)
    }
    console.groupCollapsed.apply(window, args)
    console.trace(location.href)
    if (typeof extraAction === 'function') {
      logger.depth++
      const result = extraAction()
      if (typeof result === 'string') {
        logger.debug(result)
      }
      logger.depth--
    }
    console.groupEnd()
  }

  window.tuner = {
    logger: {
      depth: 0,
      debug() {
        formatMessage.apply(this, mergeArguments(arguments, [CONSOLE_DEBUG]))
      },
      info() {
        formatMessage.apply(this, mergeArguments(arguments, [CONSOLE_INFO]))
      },
      warn() {
        formatMessage.apply(this, mergeArguments(arguments, [CONSOLE_WARN]))
      },
      error() {
        formatMessage.apply(this, mergeArguments(arguments, [CONSOLE_ERROR]))
      },
      table(name, data, columns) {
        console.log(`%c${name}`, CONSOLE_BLUE)
        console.table(data, columns)
      },
    }
  }
  window.logger = window.tuner.logger
}

export const logger = window.logger
export const tuner = window.tuner
