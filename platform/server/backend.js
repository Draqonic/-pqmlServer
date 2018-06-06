/*** @using { core.RAIIEventEmitter } **/

exports.capabilities = {}
var runtime = _globals.server.runtime
exports.init = function(ctx) {
	//log('backend initialization...')
	//ctx._updatedItems = []
}

exports.initSystem = function(system) { }

exports.run = function(ctx, callback) {
	callback()
}
exports.tick = function(ctx) {
}