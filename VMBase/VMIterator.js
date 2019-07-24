
const nodeHandler = require('VMRunAst')
const VMScope = require('VMScope')

class NodeIterator {
    constructor(node, scope) {
        this.node = node
        this.scope = scope
        this.nodeHandler = nodeHandler
    }

    traverse(node, options = {}) {
        const scope = options.scope || this.scope
        const nodeIterator = new NodeIterator(node, scope)
        const _eval = this.nodeHandler[node.type]
        if (!_eval) {
            console.log(`Scope: Unknown node type "${node.type}".`)
            return;
        }
        return _eval(nodeIterator)
    }

    createScope(blockType = 'block') {
        return new VMScope(blockType, this.scope)
    }
}

module.exports = NodeIterator
