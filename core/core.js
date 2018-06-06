//WARNING: no log() function usage before init.js

exports.core.device = 0
exports.core.vendor = ""
exports.core.__videoBackends = {}

/* ${init.js} */

if (!Function.prototype.bind) {
	Function.prototype.bind = function(oThis) {
		if (typeof this !== 'function') {
			throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable')
		}

		var aArgs = Array.prototype.slice.call(arguments, 1),
			fToBind = this,
			fNOP    = function() {},
			fBound  = function() {
				return fToBind.apply(this instanceof fNOP && oThis
					? this
					: oThis,
					aArgs.concat(Array.prototype.slice.call(arguments)))
			}

			fNOP.prototype = this.prototype;
			fBound.prototype = new fNOP();

			return fBound;
	}
}

if (log === null)
	log = console.log.bind(console)

var safeCallImpl = function(callback, self, args, onError) {
	try { return callback.apply(self, args) } catch(ex) { onError(ex) }
}

exports.core.safeCall = function(self, args, onError) {
	return function(callback) { return safeCallImpl(callback, self, args, onError) }
}

/**
 * @constructor
 */
var CoreObjectComponent = exports.core.CoreObject = function(parent) {
	this._local = Object.create(parent? parent._local: null)
}

var CoreObjectComponentPrototype = CoreObjectComponent.prototype
CoreObjectComponentPrototype.componentName = 'core.CoreObject'
CoreObjectComponentPrototype.constructor = CoreObjectComponent

/** @private **/
CoreObjectComponentPrototype.$c = function() { }

/** @private **/
CoreObjectComponentPrototype.$s = function() { }

///@private gets object by id
CoreObjectComponentPrototype._get = function(name, unsafe) {
	if (name in this) //do not remove in here, properties may contain undefined!
		return this[name]

	if (name in this._local)
		return this._local[name]

	if (unsafe)
		return null
	else
		throw new Error("invalid property requested: '" + name + "'")
}

exports.addLazyProperty = function(proto, name, creator) {
	var get = function(object) {
		var storage = object.__properties[name]
		if (storage !== undefined) {
			if (storage.value === undefined)
				storage.value = creator(object)
			return storage
		}

		return object.__properties[name] = new PropertyStorage(creator(object))
	}

	Object.defineProperty(proto, name, {
		get: function() {
			return get(this).value
		},

		set: function(newValue) {
			var storage = get(this)
			if (storage.forwardSet(this, name, newValue, null))
				return

			throw new Error('could not set lazy property ' + name + ' in ' + proto.componentName)
		},
		enumerable: true
	})
}

exports.addConstProperty = function(proto, name, getter) {
	Object.defineProperty(proto, name, {
		get: function() {
			return getter.call(this)
		},

		set: function(newValue) {
			throw new Error('could not set const property')
		},
		enumerable: true
	})
}

var PropertyStorage = function(value) {
	this.value = value
	this.onChanged = []
}
exports.PropertyStorage = PropertyStorage

var PropertyStoragePrototype = PropertyStorage.prototype

PropertyStoragePrototype.getAnimation = function(name, animation) {
	var a = this.animation
	if (!a || !a.enabled() || a._native)
		return null
	if (!a._context._completed)
		return null
	return a
}

PropertyStoragePrototype.removeUpdater = function() {
	var callback = this.callback
	if (callback === undefined)
		return

	this.deps.forEach(function(data) {
		var object = data[0]
		var name = data[1]
		object.removeOnChanged(name, callback)
	})
	this.deps = this.callback = undefined
}

PropertyStoragePrototype.replaceUpdater = function(parent, callback, deps) {
	this.removeUpdater()
	this.callback = callback
	this.deps = deps
	deps.forEach(function(data) {
		var object = data[0]
		var name = data[1]
		parent.connectOnChanged(object, name, callback)
	})
	callback()
}

PropertyStoragePrototype.forwardSet = function(object, name, newValue, defaultValue) {
	var forwardTarget = this.forwardTarget
	if (forwardTarget === undefined)
		return false

	var oldValue = this.getCurrentValue(defaultValue)
	if (oldValue !== null && (oldValue instanceof Object)) {
		//forward property update for mixins
		var forwardedOldValue = oldValue[forwardTarget]
		if (newValue !== forwardedOldValue) {
			oldValue[forwardTarget] = newValue
			this.callOnChanged(object, name, newValue, forwardedOldValue)
		}
		return true
	} else if (newValue instanceof Object) {
		//first assignment of mixin
		object.connectOnChanged(newValue, forwardTarget, function(v, ov) {
			var storage = object.__properties[name]
			if (storage !== undefined)
				storage.callOnChanged(object, name, v, ov)
		})
		return false
	}
}

PropertyStoragePrototype.discard = function() {

}

PropertyStoragePrototype.getSimpleValue = function(defaultValue) {
	var value = this.value
	return value !== undefined? value: defaultValue
}

PropertyStoragePrototype.getCurrentValue = function(defaultValue) {
	var value = this.interpolatedValue
	return value !== undefined? value: this.getSimpleValue(defaultValue)
}

PropertyStoragePrototype.setCurrentValue = function(object, name, newValue, defaultValue, callUpdate) {
	var oldValue = this.value
	this.interpolatedValue = undefined
	this.value = newValue
	if (callUpdate)
		this.callOnChanged(object, name, newValue, oldValue)
}

PropertyStoragePrototype.set = function(object, name, newValue, defaultValue, callUpdate) {
	var oldValue = this.value
	if (oldValue === undefined)
		oldValue = defaultValue

	if (oldValue === newValue)
		return
	if (this.forwardSet(object, name, newValue, defaultValue))
		return
	this.value = newValue
	if (callUpdate)
		this.callOnChanged(object, name, newValue, oldValue)
}

PropertyStoragePrototype.callOnChanged = function(object, name, value) {
	var protoCallbacks = object['__changed__' + name]
	var handlers = this.onChanged

	var hasProtoCallbacks = protoCallbacks !== undefined
	var hasHandlers = handlers !== undefined

	if (!hasProtoCallbacks && !hasHandlers)
		return

	var invoker = _globals.core.safeCall(object, [value], function(ex) { log("on " + name + " changed callback failed: ", ex, ex.stack) })

	if (hasProtoCallbacks)
		protoCallbacks.forEach(invoker)

	if (hasHandlers)
		handlers.forEach(invoker)
}

PropertyStoragePrototype.removeOnChanged = function(callback) {
	var handlers = this.onChanged
	var idx = handlers.indexOf(callback)
	if (idx >= 0)
		return handlers.splice(idx, 1)
}

exports.addProperty = function(proto, type, name, defaultValue) {
	var convert
	var animable = false
	switch(type) {
		case 'enum':
		case 'int':		convert = function(value) { return ~~value }; animable = true; break
		case 'bool':	convert = function(value) { return value? true: false }; break
		case 'real':	convert = function(value) { return +value }; animable = true; break
		case 'string':	convert = function(value) { return String(value) }; break

		case 'Color':	animable = true; //fallthrough
		default:		convert = function(value) { return value }; break
	}

	if (defaultValue !== undefined) {
		defaultValue = convert(defaultValue)
	} else {
		switch(type) {
			case 'enum': //fixme: add default value here
			case 'int':		defaultValue = 0; break
			case 'bool':	defaultValue = false; break
			case 'real':	defaultValue = 0.0; break
			case 'string':	defaultValue = ""; break
			case 'array':	defaultValue = []; break
			case 'Color':	defaultValue = '#0000'; break
			default:
				defaultValue = (type[0].toUpperCase() == type[0])? null: undefined
		}
	}

	var createStorage = function(newValue) {
		var storage = this.__properties[name]
		if (storage === undefined) { //no storage
			if (newValue === defaultValue) //value == defaultValue, no storage allocation
				return
			storage = this.__properties[name] = new PropertyStorage(defaultValue)
		}
		return storage
	}

	var simpleGet = function() {
		var storage = this.__properties[name]
		return storage !== undefined? storage.getSimpleValue(defaultValue): defaultValue
	}

	var simpleSet = function(newValue) {
		newValue = convert(newValue)
		var storage = createStorage.call(this, newValue)
		if (storage === undefined)
			return

		storage.set(this, name, newValue, defaultValue, true)
	}


	Object.defineProperty(proto, name, {
		get: simpleGet,
		set: simpleSet,
		enumerable: true
	})
}

exports.addAliasProperty = function(object, name, getObject, srcProperty) {
	var target = getObject()
	object.connectOnChanged(target, srcProperty, function(value) {
		var storage = object.__properties[name]
		if (storage !== undefined)
			storage.callOnChanged(object, name, value)
	})

	Object.defineProperty(object, name, {
		get: function() { return target[srcProperty] },
		set: function(value) { target[srcProperty] = value },
		enumerable: true
	})
}

exports.core.createSignal = function(name) {
	return function() {
		this.emitWithArgs(name, arguments)
	}
}
exports.core.createSignalForwarder = function(object, name) {
	return (function() {
		object.emitWithArgs(name, arguments)
	})
}

/** @constructor */
exports.core.EventBinder = function(target) {
	this.target = target
	this.callbacks = {}
	this.enabled = false
}

exports.core.EventBinder.prototype.on = function(event, callback) {
	if (event in this.callbacks)
		throw new Error('double adding of event (' + event + ')')
	this.callbacks[event] = callback
	if (this.enabled)
		this.target.on(event, callback)
}

exports.core.EventBinder.prototype.constructor = exports.core.EventBinder

exports.core.EventBinder.prototype.enable = function(value) {
	if (value != this.enabled) {
		var target = this.target
		this.enabled = value
		if (value) {
			for(var event in this.callbacks)
				target.on(event, this.callbacks[event])
		} else {
			for(var event in this.callbacks)
				target.removeListener(event, this.callbacks[event])
		}
	}
}

var protoEvent = function(prefix, proto, name, callback) {
	var sname = prefix + '__' + name
	//if property was in base prototype, create shallow copy and put our handler there or we would add to base prototype's array
	var storage = proto[sname]
	if (storage !== undefined) {
		var ownStorage = proto.hasOwnProperty(sname)
		if (ownStorage)
			storage.push(callback)
		else {
			var copy = storage.slice()
			copy.push(callback)
			proto[sname] = copy
		}
	} else
		proto[sname] = [callback]
}

exports.core._protoOn = function(proto, name, callback)
{ protoEvent('__on', proto, name, callback) }

exports.core._protoOnChanged = function(proto, name, callback)
{ protoEvent('__changed', proto, name, callback) }

exports.core._protoOnKey = function(proto, name, callback)
{ protoEvent('__key', proto, name, callback) }

var ObjectEnumerator = function(callback) {
	this._callback = callback
	this._queue = []
	this.history = []
}

var ObjectEnumeratorPrototype = ObjectEnumerator.prototype
ObjectEnumeratorPrototype.constructor = ObjectEnumerator

ObjectEnumeratorPrototype.unshift = function() {
	var q = this._queue
	q.unshift.apply(q, arguments)
}

ObjectEnumeratorPrototype.push = function() {
	var q = this._queue
	q.push.apply(q, arguments)
}

ObjectEnumeratorPrototype.enumerate = function(root, arg) {
	var args = [this, arg]
	var queue = this._queue
	queue.unshift(root)
	while(queue.length) {
		var el = queue.shift()
		this.history.push(el)
		var r = this._callback.apply(el, args)
		if (r)
			break
	}
}

exports.forEach = function(root, callback, arg) {
	var oe = new ObjectEnumerator(callback)
	oe.enumerate(root, arg)
	return arg
}
