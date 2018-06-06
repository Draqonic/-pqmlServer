/*** @using { core.RAIIEventEmitter } **/

var registerGenericListener = function(target) {
	var prefix = '__nativeEventHandler_'
	target.onListener('',
		function(name) {
			log('registering generic event', name)
			var pname = prefix + name
			var callback = target[pname] = function() {
				COPY_ARGS(args, 0)
				target.emitWithArgs(name, args)
			}
			//target.dom.addEventListener(name, callback)
		},
		function(name) {
			log('removing generic event', name)
			var pname = prefix + name
			//target.dom.removeEventListener(name, target[pname])
		}
	)
}
