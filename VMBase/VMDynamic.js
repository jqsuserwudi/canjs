
const { parse } = require('VMAcorn')
const NodeIterator = require('VMIterator')
const VMScope = require('VMScope')

class Dynamic {
    constructor(code = '', extraDeclaration = {}) {
        this.code = code
        this.extraDeclaration = extraDeclaration
        this.ast = parse(code)
        this.nodeIterator = null
        this.init()
    }

    init() {
        const globalScope = new VMScope('function')
        Object.keys(this.extraDeclaration).forEach((key) => {
            globalScope.addDeclaration(key, this.extraDeclaration[key])
        })
        this.nodeIterator = new NodeIterator(null, globalScope)
    }

    run() {
        return this.nodeIterator.traverse(this.ast)
    }
}

module.exports = Dynamic
