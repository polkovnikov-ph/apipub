var common = require('./');
var expressWs = require('express-ws');
function server(app, url, addHandlers) {
	if (!app.ws) {
		expressWs(app);
	}
	app.ws(url, function (wsClient, request) {
		var rpc = common.makeRpc(wsClient);
		addHandlers(wsClient, request);
		rpc();
		wsClient.emit('connect');
	});
}
server.noReturn = common.noReturn;
module.exports = server;