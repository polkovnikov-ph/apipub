var zlib = require('zlib');

var FUN = 0;
var ARR = 1;
var OBJ = 2;
var VAL = 3;

var TYPE = 0;
var FUNID = 1;
var NORET = 2;
var ITEMS = 1;
var FIELDS = 1;
var VALUE = 1;

var API = 0;
var CALL = 1;

var CTYPE = 0;
var CFUNID = 1;
var CARGS = 2;
var CRET = 3;
var CROOTS = 1;

function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function makeRpc(ws) {
    // wire format
    var funCache = {};
    var currFunId = 0;

    function serialize(o, p, nr) {
        var isNoRetFun = typeof o === 'object' && o && o.__noReturn;
        var isFun = typeof o === 'function';
        if (isNoRetFun) {
            o = o.fun;
        }
        if (isNoRetFun || isFun) {
            var funId = currFunId++;
            funCache[funId] = function (args, ret) {
                var a = deserialize(args);
                if (isNoRetFun || nr > 0) {
                    o.apply(p, a)
                } else {
                    var promise = deserialize(ret);
                    try {
                        var retVal = o.apply(p, a);
                        if (typeof retVal === 'object' && retVal.constructor && retVal.constructor.name === 'Promise') {
                            retVal.then(promise.resolve, promise.reject);
                        } else {
                            promise.resolve(retVal);
                        }
                    } catch (e) {
                        promise.reject(e);
                    }
                }
            };
            return [FUN, funId, isNoRetFun || nr > 0];
        } else if (Array.isArray(o) && o.constructor && o.constructor.name === 'Array') {
            return [ARR, o.map(function (i) { return serialize(i, null, nr - 1); })];
        } else if (typeof o === 'object') {
            var fields = [OBJ];
            for (var field in o) {
                fields.push(isNumeric(field) ? parseFloat(field) : field);
                fields.push(serialize(o[field], o, nr - 1));
            }
            return fields;
        } else {
            return [VAL, o];
        }
    }

    function deserialize(a) {
        switch (a[TYPE]) {
        case FUN:
            return function (/* args */) {
                var args = Array.prototype.slice.call(arguments);
                return new Promise(function (resolve, reject) {
                    var o = [CALL, a[FUNID], serialize(args, null, 2)];
                    if (!a[NORET]) {
                        o.push(serialize({resolve: resolve, reject: reject}, null, 2));
                    }
                    send(o);
                });                
            };
        case ARR:
            return a[ITEMS].map(deserialize);
        case OBJ:
            var ret = {}, len = a.length;
            for (var i = 1; i < len; i += 2) {
                ret[a[i]] = deserialize(a[i + 1]);
            }
            return ret;
        case VAL:
            return a[VALUE];
        default:
            throw 'Unknown value type';
        }
    }
    
    // helper
    function mapValues(o, f) {
        var r = {};
        for (var i in o) if (o.hasOwnProperty(i)) {
            r[i] = f(o[i]);
        }
        return r;
    }
    
    // handshake
    function send(o) {
        //ws.send(new Buffer(JSON.stringify(o)));
        zlib.deflateRaw(new Buffer(JSON.stringify(o)), function (err, result) {
            if (err) throw err;
            ws.send(result);
        });
    }
    
    var roots = {};
    
    function sendApiDescr() {
        send([API, roots]);
    }
    
    function mount(root, o) {
        roots[root] = serialize(o);
    }
    
    var remoteApi;
    
    function handler(msg) {
        zlib.inflateRaw(msg, function (err, msg) {
            var o = JSON.parse(msg.toString());
            /*try {
                var o = msg;
                o = JSON.parse(o);
            } catch (e) {}*/
            switch (o[CTYPE]) {
            case API:
                remoteApi = mapValues(o[CROOTS], deserialize);
                ws.emit('join', remoteApi);
                return;
            case CALL:
                funCache[o[CFUNID]](o[CARGS], o[CRET]);
                return;
            default:
                throw 'Unknown request type: ' + o.type;
            }
        });
    }
    
    function loop() {
		ws.on('connect', function () {
            sendApiDescr();
		});
		ws.on('data', handler);
		ws.on('message', handler);
	}
    
    ws.mount = mount;
    return loop;
}

function noReturn(f) {
    return {
        __noReturn: true,
        fun: f
    };
}

module.exports = {
    makeRpc: makeRpc,
    noReturn: noReturn
};