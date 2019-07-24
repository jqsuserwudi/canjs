
class VMSignal {
  constructor(type, value) {
    this.type = type
    this.value = value
  }

  static Return(value) {
    return new VMSignal('return', value)
  }

  static Break(label = null) {
    return new VMSignal('break', label)
  }

  static Continue(label) {
    return new VMSignal('continue', label)
  }

  static isReturn(vmsignal) {
    return vmsignal instanceof VMSignal && vmsignal.type === 'return'
  }

  static isContinue(vmsignal) {
    return vmsignal instanceof VMSignal && vmsignal.type === 'continue'
  }

  static isBreak(vmsignal) {
    return vmsignal instanceof VMSignal && vmsignal.type === 'break'
  }

  static isSignal(vmsignal) {
    return vmsignal instanceof VMSignal
  }
}

module.exports = VMSignal
