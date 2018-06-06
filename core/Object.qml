///the most basic QML Object, generic event emitter, properties and id links holder
EventEmitter {
	constructor: {
		this.parent = parent
		this.children = []
		this.__properties = {}
		this.__attachedObjects = []
		if (parent)
			parent.__attachedObjects.push(this)

		this._context = parent? parent._context: null
		if (row) {
			var local = this._local
			local.model = row
			local._delegate = this
		}
		this._changedConnections = []
		this._properties = {}
	}

	/// discard object
	function discard() {
		this._changedConnections.forEach(function(connection) {
			connection[0].removeOnChanged(connection[1], connection[2])
		})
		this._changedConnections = []

		var attached = this.__attachedObjects
		this.__attachedObjects = []
		attached.forEach(function(child) { child.discard() })

		var parent = this.parent
		if (parent) {
			var discardIdx = parent.__attachedObjects.indexOf(this)
			if (discardIdx >= 0)
				parent.__attachedObjects.splice(discardIdx, 1)
		}

		this.children = []

		this.parent = null
		this._local = {}

		var properties = this.__properties
		for(var name in properties) //fixme: it was added once, then removed, is it needed at all? it double-deletes callbacks
			properties[name].discard()
		this._properties = {}

		_globals.core.EventEmitter.prototype.discard.apply(this)
	}

	/**@param child:Object object to add
	adds child object to children*/
	function addChild(child) {
		this.children.push(child);
	}

	/// @private sets id
	function _setId(name) {
		var p = this;
		while(p) {
			p._local[name] = this;
			p = p.parent;
		}
	}

	///@private register callback on property's value changed
	function onChanged(name, callback) {
		var storage = this._createPropertyStorage(name)
		storage.onChanged.push(callback)
	}

	///@private
	function connectOnChanged(target, name, callback) {
		target.onChanged(name, callback)
		this._changedConnections.push([target, name, callback])
	}

	///@private removes 'on changed' callback
	function removeOnChanged(name, callback) {
		var storage = this.__properties[name]
		var removed
		if (storage !== undefined)
			removed = storage.removeOnChanged(callback)

		if ($manifest$trace$listeners && !removed)
			log('failed to remove changed listener for', name, 'from', this)
	}

	/// @private removes dynamic value updater
	function _removeUpdater (name) {
		var storage = this.__properties[name]
		if (storage !== undefined)
			storage.removeUpdater()
	}

	/// @private replaces dynamic value updater
	function _replaceUpdater (name, callback, deps) {
		this._createPropertyStorage(name).replaceUpdater(this, callback, deps)
	}

	///@private creates property storage
	function _createPropertyStorage(name, value) {
		var storage = this.__properties[name]
		if (storage !== undefined)
			return storage

		return this.__properties[name] = new _globals.core.core.PropertyStorage(value)
	}

	///mixin api: set default forwarding _target
	function setPropertyForwardingTarget(name, target) {
		this._createPropertyStorage(name).forwardTarget = target
	}

	///@private patch property storage directly without signalling.
	function _setProperty(name, value) {
		//cancel any running software animations
		var storage = this._createPropertyStorage(name, value)
		var animation = storage.animation
		if (animation !== undefined)
			animation.disable()
		storage.setCurrentValue(this, null, value)
		if (animation !== undefined)
			animation.enable()
	}
}
