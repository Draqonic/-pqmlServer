_globals.core.os = 'unknown'
_globals.core.userAgent = 'unknown'
_globals.core.language = 'en'

if (typeof process !== 'undefined') {
	exports.core.os = process.platform
	exports.core.userAgent = process.release.name
}

_globals._backend = function() { return _globals.server.backend }
_globals.core.__locationBackend = function() { return _globals.server.backend }
