//simple demo

let Dynamic = require('VMBase/VMDynamic')

let vmo = new Dynamic("js code", window.SCRIPT_CONTEXT || {});
vmo.run();
