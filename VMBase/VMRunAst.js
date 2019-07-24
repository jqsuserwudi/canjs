
const VMSignal          = require('VMSignal')

const NodeHandler = {
    Program(nodeIterator) {
        for (const node of nodeIterator.node.body) {
            nodeIterator.traverse(node)
        }
    },
    VariableDeclaration(nodeIterator) {
        const kind = nodeIterator.node.kind
        for (const declaration of nodeIterator.node.declarations) {
            const { name } = declaration.id
            const value = declaration.init ? nodeIterator.traverse(declaration.init) : null;
            // 在作用域当中定义变量
            if (nodeIterator.scope.type === 'block' && kind === 'var') {
                nodeIterator.scope.parentScope.declare(name, typeof value !='undefined' ? value : null, kind)
            } else {
                nodeIterator.scope.declare(name, typeof value !='undefined' ? value : null, kind)
            }
        }
    },
    Identifier(nodeIterator) {
        if (nodeIterator.node.name === 'undefined') {
            return undefined
        }
        return nodeIterator.scope.get(nodeIterator.node.name)
    },
    Literal(nodeIterator) {
        return nodeIterator.node.value
    },

    ExpressionStatement(nodeIterator) {
        return nodeIterator.traverse(nodeIterator.node.expression)
    },
    CallExpression(nodeIterator) {
        const func = nodeIterator.traverse(nodeIterator.node.callee)
        const args = nodeIterator.node.arguments.map(arg => nodeIterator.traverse(arg))

        let value
        if (nodeIterator.node.callee.type === 'MemberExpression') {
            value = nodeIterator.traverse(nodeIterator.node.callee.object)
        }
        return func.apply(value, args)
    },
    MemberExpression(nodeIterator) {
        const obj = nodeIterator.traverse(nodeIterator.node.object)
        let name = null
        if (nodeIterator.node.property.type == "MemberExpression"){
            let objV = nodeIterator.traverse(nodeIterator.node.property.object)
            const key = getPropertyName(nodeIterator.node.property, nodeIterator)
            name = objV[key];
        }
        else if(nodeIterator.node.property.type=='BinaryExpression'){
            const a = nodeIterator.traverse(nodeIterator.node.property.left)
            const b = nodeIterator.traverse(nodeIterator.node.property.right)
            name = NodeHandler.BinaryExpressionOperatortraverseMap[nodeIterator.node.property.operator](a, b)
        }
        else {
            if (typeof nodeIterator.node.property.name != 'undefined'){
                name = nodeIterator.node.property.name
            }
            else if(typeof nodeIterator.node.property.value != 'undefined'){
                name = nodeIterator.node.property.value
            }
        }
        if (typeof obj[name] !='undefined'){
            return obj[name]
        }
        else{
            let value = nodeIterator.scope.get(name)
            return obj[value]
        }
    },
    ObjectExpression(nodeIterator) {
        const obj = {}
        for (const prop of nodeIterator.node.properties) {
            let key
            if (prop.key.type === 'Literal') {
                key = `${prop.key.value}`
            } else if (prop.key.type === 'Identifier') {
                key = prop.key.name
            } else {
                throw new Error(`Dynamic:  [ObjectExpression] Unsupported property key type "${prop.key.type}"`)
            }
            obj[key] = nodeIterator.traverse(prop.value)
        }
        return obj
    },
    ArrayExpression(nodeIterator) {
        return nodeIterator.node.elements.map(ele => nodeIterator.traverse(ele))
    },

    BlockStatement(nodeIterator) {
        let scope = nodeIterator.createScope('block')

        // 处理块级节点内的每一个节点
        for (const node of nodeIterator.node.body) {
            if (node.type === 'FunctionDeclaration') {
                nodeIterator.traverse(node, { scope })
            } 
        }

        // 提取关键字（return, break, continue）
        for (const node of nodeIterator.node.body) {
            if (node.type === 'FunctionDeclaration') {
                continue
            }
            else if (node.type === 'VariableDeclaration' && node.kind === 'var') {
                for (const declaration of node.declarations) {
                    if (declaration.init) {
                        scope.declare(declaration.id.name, nodeIterator.traverse(declaration.init, { scope }), node.kind)
                    } else {
                        scope.declare(declaration.id.name, undefined, node.kind)
                    }
                }
            }
            const signal = nodeIterator.traverse(node, { scope })
            if (VMSignal.isSignal(signal)) {
                return signal
            }
        }
    },
    FunctionDeclaration(nodeIterator) {
        return NodeHandler.FunctionExpression(nodeIterator)
    },
    FunctionExpression(nodeIterator) {
        const node = nodeIterator.node
        /**
         * 1、定义函数需要先为其定义一个函数作用域，且允许继承父级作用域
         * 2、注册`this`, `arguments`和形参到作用域的变量空间
         * 3、检查return关键字
         * 4、定义函数名和长度
         */
        const fn = function () {
            const scope = nodeIterator.createScope('function')
            scope.constDeclare('this', this)
            scope.constDeclare('arguments', arguments)

            node.params.forEach((param, index) => {
                const name = param.name
                scope.varDeclare(name, typeof arguments[index] !='undefined' ? arguments[index] : null) //函数初始化参数不要设置为undefined
            })

            const signal = nodeIterator.traverse(node.body, { scope })
            if (VMSignal.isReturn(signal)) {
                return signal.value
            }
        }

        Object.defineProperties(fn, {
            name: { value: node.id ? node.id.name : '' },
            length: { value: node.params.length }
        })
        if (nodeIterator.node.id){
            nodeIterator.scope.varDeclare(nodeIterator.node.id.name, fn)
        }
        return fn
    },
    ThisExpression(nodeIterator) {
        const value = nodeIterator.scope.get('this')
        return value ? value : null
    },
    NewExpression(nodeIterator) {
        const func = nodeIterator.traverse(nodeIterator.node.callee)
        const args = nodeIterator.node.arguments.map(arg => nodeIterator.traverse(arg))
        return new (func.bind(null, ...args))
    },

    UpdateExpression(nodeIterator) {
        if (nodeIterator.node.argument.type=='MemberExpression') {
            let obj = nodeIterator.traverse(nodeIterator.node.argument.object)
            const name = getPropertyName(nodeIterator.node.argument, nodeIterator)
            if (nodeIterator.node.operator === '++') {
                nodeIterator.node.prefix ? ++obj[name] : obj[name]++
            } else {
                nodeIterator.node.prefix ? --obj[name] : obj[name]--
            }
            return;
        }
        //Identifier
        let value = nodeIterator.scope.get(nodeIterator.node.argument.name)
        if (nodeIterator.node.operator === '++') {
            nodeIterator.node.prefix ? ++value : value++
        } else {
            nodeIterator.node.prefix ? --value : value--
        }
        nodeIterator.scope.set(nodeIterator.node.argument.name, value)
        return value
    },
    AssignmentExpressionOperatortraverseMap: {
        '=': (value, v, name) => value instanceof Object ? value[name] = v: value = v,
        '+=': (value, v, name) => value instanceof Object ? value[name] += v : value += v,
        '-=': (value, v, name) => value instanceof Object ? value[name] -= v : value -= v,
        '*=': (value, v, name) => value instanceof Object ? value[name] *= v : value *= v,
        '/=': (value, v, name) => value instanceof Object ? value[name] /= v : value /= v,
        '%=': (value, v, name) => value instanceof Object ? value[name] %= v : value %= v,
        '**=': () => { throw new Error('Dynamic:  es5 doen\'t supports operator "**=') },
        '<<=': (value, v, name) => value instanceof Object ? value[name] <<= v : value <<= v,
        '>>=': (value, v, name) => value instanceof Object ? value[name] >>= v : value >>= v,
        '>>>=': (value, v, name) => value instanceof Object ? value[name] >>>= v : value >>>= v,
        '|=': (value, v, name) => value instanceof Object ? value[name] |= v : value |= v,
        '^=': (value, v, name) => value instanceof Object ? value[name] ^= v : value ^= v,
        '&=': (value, v, name) => value instanceof Object ? value[name] &= v : value &= v
    },
    AssignmentExpression(nodeIterator) {
        const node = nodeIterator.node
        if (node.left.type === 'Identifier') {
            let value = nodeIterator.traverse(node.right)
            if (node.operator){
                let leftValue = nodeIterator.traverse(node.left)
                value = NodeHandler.AssignmentExpressionOperatortraverseMap[node.operator](leftValue, value)
            }
            if (!nodeIterator.scope.set(node.left.name, value)){
                nodeIterator.scope.varDeclare(node.left.name, value)
            }
            return value;
        } else if (node.left.type === 'MemberExpression') {
            const value = nodeIterator.traverse(node.right) //优先计算右半边
            const obj = nodeIterator.traverse(node.left.object)
            const name = getPropertyName(node.left, nodeIterator)
            return NodeHandler.AssignmentExpressionOperatortraverseMap[node.operator](obj, value, name)
        } else {
            throw new Error(`Dynamic:  Not support to get value of node type "${node.type}"`)
        }
    },
    UnaryExpressionOperatortraverseMap: {
        '-': (nodeIterator) => -nodeIterator.traverse(nodeIterator.node.argument),
        '+': (nodeIterator) => +nodeIterator.traverse(nodeIterator.node.argument),
        '!': (nodeIterator) => !nodeIterator.traverse(nodeIterator.node.argument),
        '~': (nodeIterator) => ~nodeIterator.traverse(nodeIterator.node.argument),
        'typeof': (nodeIterator) => {
            if (nodeIterator.node.argument.type === 'Identifier') {
                try {
                    const value = nodeIterator.scope.get(nodeIterator.node.argument.name)
                    return value ? typeof value : undefined
                } catch (err) {
                    if (err.message === `${nodeIterator.node.argument.name} is not defined`) {
                        return undefined
                    } else {
                        throw err
                    }
                }
            } else {
                return typeof nodeIterator.traverse(nodeIterator.node.argument)
            }
        },
        'void': (nodeIterator) => void nodeIterator.traverse(nodeIterator.node.argument),
        'delete': (nodeIterator) => {
            const argument = nodeIterator.node.argument
            if (argument.type === 'MemberExpression') {
                const obj = nodeIterator.traverse(argument.object)
                const name = getPropertyName(argument, nodeIterator)
                return delete obj[name]
            } else if (argument.type === 'Identifier') {
                return false
            } else if (argument.type === 'Literal') {
                return true
            }
        }
    },
    UnaryExpression(nodeIterator) {
        return NodeHandler.UnaryExpressionOperatortraverseMap[nodeIterator.node.operator](nodeIterator)
    },
    BinaryExpressionOperatortraverseMap: {
        '==': (a, b) => a == b,
        '!=': (a, b) => a != b,
        '===': (a, b) => a === b,
        '!==': (a, b) => a !== b,
        '<': (a, b) => a < b,
        '<=': (a, b) => a <= b,
        '>': (a, b) => a > b,
        '>=': (a, b) => a >= b,
        '<<': (a, b) => a << b,
        '>>': (a, b) => a >> b,
        '>>>': (a, b) => a >>> b,
        '+': (a, b) => a + b,
        '-': (a, b) => a - b,
        '*': (a, b) => a * b,
        '/': (a, b) => a / b,
        '%': (a, b) => a % b,
        '**': (a, b) => { throw new Error('Dynamic:  es5 doesn\'t supports operator "**"') },
        '|': (a, b) => a | b,
        '^': (a, b) => a ^ b,
        '&': (a, b) => a & b,
        'in': (a, b) => a in b,
        'instanceof': (a, b) => a instanceof b
    },
    BinaryExpression(nodeIterator) {
        const a = nodeIterator.traverse(nodeIterator.node.left)
        const b = nodeIterator.traverse(nodeIterator.node.right)
        return NodeHandler.BinaryExpressionOperatortraverseMap[nodeIterator.node.operator](a, b)
    },
    LogicalExpressionOperatortraverseMap: {
        '||': (a, b) => a || b,
        '&&': (a, b) => a && b
    },
    LogicalExpression(nodeIterator) {
        const a = nodeIterator.traverse(nodeIterator.node.left)
        if (nodeIterator.node.operator=="&&" && (typeof a == 'undefined' || !a)){
            return a;
        }
        else if (nodeIterator.node.operator=="||" && a){
            return a;
        }
        const b = nodeIterator.traverse(nodeIterator.node.right)
        return NodeHandler.LogicalExpressionOperatortraverseMap[nodeIterator.node.operator](a, b)
    },

    ForStatement(nodeIterator) {
        const node = nodeIterator.node
        if (node.init && node.init.type === 'VariableDeclaration') { // && node.init.kind !== 'var'
            nodeIterator.scope = nodeIterator.createScope('block')
        }
        let scope = nodeIterator.scope
        for (
            node.init && nodeIterator.traverse(node.init, { scope });
            node.test ? nodeIterator.traverse(node.test, { scope }) : true;
            node.update && nodeIterator.traverse(node.update, { scope })
        ) {
            const signal = nodeIterator.traverse(node.body, { scope })

            if (VMSignal.isBreak(signal)) {
                break
            } else if (VMSignal.isContinue(signal)) {
                continue
            } else if (VMSignal.isReturn(signal)) {
                return signal
            }
        }
    },
    ForInStatement(nodeIterator) {
        const { left, right, body } = nodeIterator.node
        let scope = nodeIterator.scope
        let name
        if (left.type === 'VariableDeclaration') {
            const id = left.declarations[0].id
            scope.letDeclare(id.name, 'default', left.kind)
            name = id.name;
        } else if (left.type === 'Identifier') {
            //value = scope.get(left.name, true)
            name = left.name;
        } else {
            throw new Error(`Dynamic:  [ForInStatement] Unsupported left type "${left.type}"`)
        }
        let obj = nodeIterator.traverse(right)
        for (const key in obj) {
            scope.set(name, key);
            const signal = nodeIterator.traverse(body, { scope })

            if (VMSignal.isBreak(signal)) {
                break
            } else if (VMSignal.isContinue(signal)) {
                continue
            } else if (VMSignal.isReturn(signal)) {
                return signal
            }
        }
    },
    WhileStatement(nodeIterator) {
        while (nodeIterator.traverse(nodeIterator.node.test)) {
            const signal = nodeIterator.traverse(nodeIterator.node.body)

            if (VMSignal.isBreak(signal)) {
                break
            } else if (VMSignal.isContinue(signal)) {
                continue
            } else if (VMSignal.isReturn(signal)) {
                return signal
            }
        }
    },
    DoWhileStatement(nodeIterator) {
        do {
            const signal = nodeIterator.traverse(nodeIterator.node.body)

            if (VMSignal.isBreak(signal)) {
                break
            } else if (VMSignal.isContinue(signal)) {
                continue
            } else if (VMSignal.isReturn(signal)) {
                return signal
            }
        } while (nodeIterator.traverse(nodeIterator.node.test))
    },

    ReturnStatement(nodeIterator) {
        let value
        if (nodeIterator.node.argument) {
            value = nodeIterator.traverse(nodeIterator.node.argument)
        }
        return VMSignal.Return(value)
    },
    BreakStatement(nodeIterator) {
        let label
        if (nodeIterator.node.label) {
            label = nodeIterator.node.label.name
        }
        return VMSignal.Break(label)
    },
    ContinueStatement(nodeIterator) {
        let label
        if (nodeIterator.node.label) {
            label = nodeIterator.node.label.name
        }
        return VMSignal.Continue(label)
    },

    IfStatement(nodeIterator) {
        if (nodeIterator.traverse(nodeIterator.node.test)) {
            return nodeIterator.traverse(nodeIterator.node.consequent)
        } else if (nodeIterator.node.alternate) {
            return nodeIterator.traverse(nodeIterator.node.alternate)
        }
    },
    SwitchStatement(nodeIterator) {
        const discriminant = nodeIterator.traverse(nodeIterator.node.discriminant)

        for (const theCase of nodeIterator.node.cases) {
            if (!theCase.test || discriminant === nodeIterator.traverse(theCase.test)) {
                const signal = nodeIterator.traverse(theCase)

                if (VMSignal.isBreak(signal)) {
                    break
                } else if (VMSignal.isContinue(signal)) {
                    continue
                } else if (VMSignal.isReturn(signal)) {
                    return signal
                }
            }
        }
    },
    SwitchCase(nodeIterator) {
        for (const node of nodeIterator.node.consequent) {
            const signal = nodeIterator.traverse(node)
            if (VMSignal.isSignal(signal)) {
                return signal
            }
        }
    },
    ConditionalExpression(nodeIterator) {
        return nodeIterator.traverse(nodeIterator.node.test)
            ? nodeIterator.traverse(nodeIterator.node.consequent)
            : nodeIterator.traverse(nodeIterator.node.alternate)
    },

    ThrowStatement(nodeIterator) {
        throw nodeIterator.traverse(nodeIterator.node.argument)
    },
    TryStatement(nodeIterator) {
        const { block, handler, finalizer } = nodeIterator.node
        try {
            return nodeIterator.traverse(block)
        } catch (err) {
            if (handler) {
                const param = handler.param
                const scope = nodeIterator.createScope('block')
                scope.letDeclare(param.name, err)
                return nodeIterator.traverse(handler, { scope })
            }
            throw err
        } finally {
            if (finalizer) {
                return nodeIterator.traverse(finalizer)
            }
        }
    },
    CatchClause(nodeIterator) {
        return nodeIterator.traverse(nodeIterator.node.body);
    },
    SequenceExpression(nodeIterator) {
        for (let i=0; i<nodeIterator.node.expressions.length; i++) {
            let node = nodeIterator.node.expressions[i];
            if (i==nodeIterator.node.expressions.length-1){
                return nodeIterator.traverse(node)
            }
            else{
                nodeIterator.traverse(node)
            }
        }
    },
}

function getPropertyName(node, nodeIterator) {
    if (node.computed) {
        return nodeIterator.traverse(node.property)
    } else {
        return node.property.name
    }
}

function getIdentifierOrMemberExpressionValue(node, nodeIterator) {
    if (node.type === 'Identifier') {
        return nodeIterator.scope.get(node.name)
    } else if (node.type === 'MemberExpression') {
        const obj = nodeIterator.traverse(node.object)
        const name = getPropertyName(node, nodeIterator)
        return {obj:name}
    } else {
        throw new Error(`Dynamic:  Not support to get value of node type "${node.type}"`)
    }
}

module.exports = NodeHandler
