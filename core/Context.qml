///root item
Object {
	property string language;	///< localisation language
	property string buildIdentifier; ///< @private

	///@private
	constructor: {
		this.options = arguments[2]
		this.l10n = this.options.l10n || {}

		this._local['context'] = this
		this._context = this
		this._started = false
		this._completed = false
		this._processingActions = false
		this._delayedActions = []
		this._stylesRegistered = {}
		this._asyncInvoker = _globals.core.safeCall(this, [], function (ex) { log("async action failed:", ex, ex.stack) })

		this.backend = _globals._backend()

		this._init()
	}

	/// returns tag for corresponding element
	function getTag() { return 'div' }

	/// returns tag for corresponding element
	function getClass() { return '' }
	
	///@private
	function _init() {
		//log('Context: initializing...')
		new this.backend.init(this)
	}

	///@private
	function init() {
		this.backend.initSystem(this.system)
	}

	///@private
	function _onCompleted(object, callback) {
		this.scheduleAction(function() { callback.call(object) })
	}

	///@internal
	function scheduleComplete() {
		this.delayedAction('completed', this, this._processActions)
	}

	///@private
	function start(instance) {
		var c = {}
		this.children.push(instance)
		instance.$c(c)
		instance.$s(c)
		c = undefined
		//log('Context: created instance')
		// log('Context: calling on completed')
		return instance;
	}

	function wrapNativeCallback(callback) {
		var ctx = this
		return function() {
			try {
				var r = callback.apply(this, arguments)
				ctx._processActions()
				return r
			} catch(ex) {
				ctx._processActions()
				throw ex
			}
		}
	}

	///@internal
	///generally you don't need to call it yourself
	///if you need to call it from native callback, use wrapNativeCallback method
	function _processActions() {
		if (!this._started || this._processingActions)
			return

		this._processingActions = true

		var invoker = this._asyncInvoker
		var delayedActions = this._delayedActions

		while (delayedActions.length) {
			var actions = delayedActions.splice(0, delayedActions.length)
			for(var i = 0, n = actions.length; i < n; ++i)
				invoker(actions[i])
		}

		this._processingActions = false
		this.backend.tick(this)
	}

	///@private
	function scheduleAction(action) {
		this._delayedActions.push(action)
	}

	///@private
	function delayedAction(name, self, method, delay) {
		var registry = self._registeredDelayedActions

		if (registry === undefined)
			registry = self._registeredDelayedActions = {}

		if (registry[name] === true)
			return

		registry[name] = true

		var callback = function() {
			registry[name] = false
			method.call(self)
		}

		if (delay > 0) {
			setTimeout(callback, delay)
		} else if (delay === 0) {
			this.backend.requestAnimationFrame(callback)
		} else {
			this.scheduleAction(callback)
		}
	}

	/**@param text:string text that must be translated
	Returns input text translation*/
	function qsTr(text) {
		var args = arguments
		var lang = this.language
		var messages = this.l10n[lang] || {}
		var contexts = messages[text] || {}
		for(var name in contexts) {
			text = contexts[name] //fixme: add context handling here
			break
		}
		return text.replace(/%(\d+)/, function(text, index) { return args[index] })
	}

	///@private
	function run() {
		this.backend.run(this, this._run.bind(this))
	}

	///@private
	function _run() {
		//log('Started')
		this._started = true
		this._processActions()
		this._completed = true
	}
}
