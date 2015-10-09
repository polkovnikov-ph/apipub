var common = require('./');
var WebSocket = require('simple-websocket');
function getWsAbsoluteUrl(relative) {
    var loc = window.location;
    var proto = loc.protocol === 'https:' ? 'wss://' : 'ws://';
    var port = loc.port || (loc.protocol === 'https:' ? 443 : 80);
    return proto + loc.hostname + ':' + port + relative;
}
function client(url, addHandlers) {
	var wsServer = new WebSocket(getWsAbsoluteUrl('/'));
	var rpc = common.makeRpc(wsServer);
	addHandlers(wsServer);
	rpc();
}
client.noReturn = common.noReturn;
module.exports = client;