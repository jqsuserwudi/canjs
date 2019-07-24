class VMScope {
    constructor(type, parentScope) {
        this.type = type
        this.parentScope = parentScope
        this.declaration = Object.create(null) // 每次都新建一个全新的作用域
    }

    addDeclaration(name, value) {
        window[name] = value
    }

    get(name) {
        if (typeof this.declaration[name] !='undefined') {
            return this.declaration[name]
        } else if (this.parentScope) {
            return this.parentScope.get(name)
        } else if (typeof window[name]!='undefined') {
            return window[name]
        } 
        else{
            console.log("scope get an error", `${name}`);
        }
        return undefined;
    }

    set(name, value) {
        if (typeof this.declaration[name] !='undefined') {
            this.declaration[name] = value
        } else if (this.parentScope) {
            this.parentScope.set(name, value)
        } else if (typeof window[name]!='undefined') {
            window[name]  = value
        } else {
            console.log("scope set an error", `${name}`);
            return false;
        }
        return true
    }

    declare(name, value, kind = 'var') {
        if (kind === 'var') {
            return this.varDeclare(name, value)
        } else if (kind === 'let') {
            return this.letDeclare(name, value)
        } else if (kind === 'const') {
            return this.constDeclare(name, value)
        } else {
            throw new Error(`Dynamic:  Invalid Variable Declaration Kind of "${kind}"`)
        }
    }

    varDeclare(name, value) {
        let scope = this
        // 若当前作用域存在非函数类型的父级作用域时，就把变量定义到父级作用域
        while (scope.parentScope && scope.type !== 'function') {
            scope = scope.parentScope
        }
        scope.declaration[name] = value
        return scope.declaration[name]
    }

    letDeclare(name, value) {
        // 不允许重复定义
        if (typeof this.declaration[name] !='undefined') {
            throw new SyntaxError(`Identifier ${name} has already been declared`)
        }
        this.declaration[name] = value
        return this.declaration[name]
    }

    constDeclare(name, value) {
        // 不允许重复定义
        if (typeof this.declaration[name] !='undefined') {
            throw new SyntaxError(`Identifier ${name} has already been declared`)
        }
        this.declaration[name] = value
        return this.declaration[name]
    }
}

module.exports = VMScope
