(function(){
	//* @protected
	enyo.global = this;
    //*@protected
    enyo._idCounter = 0;


    //*@public
    /**
        An IE8 compatible polyfill-replacement for the String object's
        indexOf method. If that method exists it will be used instead.
        Accepts the string to search and the needle (string) to search
        for within that string. Returns the index at which the needle
        was first encountered and -1 if it could not be found.
    */
    var stringIndexOf = enyo.stringIndexOf = function (haystack, needle) {
        var idx = -1;
        if ("string" === typeof haystack) {
            if (haystack.indexOf) return haystack.indexOf(needle);
            else {
                // TODO: need to test the performance of a string
                // brute-force walk/search versus a regular expression
                // test/fallback
            }
        }

        return -1;
    };
    
    //*@public
    /**
        Simple test condition to determine if a target is undefined.
    */
    var exists = enyo.exists = function (target) {
        return !(undefined === target);
    };
    
    //*@protected
    /**
        Internally used method to strip leading '.' from string paths.
    */
    var preparePath = function (path) {
        var idx = 0;
        while ("." === path[idx]) ++idx;
        if (0 !== idx) path = path.slice(idx);
        return path;
    };
    
    //*@protected
    /**
        Internally used method to detect if the given value exists,
        is a function and a computed property. Returns true if these
        tests are successful false otherwise.
    */
    var isComputed = function (target) {
        return target && "function" === typeof target && true === target.isProperty;
    };
    
    //*@protected
    /**
        Internally used method to detect if the given value exists,
        is a function and an overloaded getter. Returns true if these
        tests are successful false otherwise.
    */
    var isOverloaded = function (target) {
        return target && "function" === typeof target && true === target.overloaded;
    };

    //*@public
    /**
        A fast-path enabled global getter that takes a string path that
        can be a full-path (from context window/enyo) or a relative path
        (to the execution context of the method). It knows how to check for
        and call the backwards-compatible generated getters as well as
        handle computed properties. This is an optimized recursive-search.
        Will return undefined if the object at the given path could not be
        found. Can safely be called on non-existent paths.
    */
    enyo.getPath = function (path, recursive) {
        // if we don't have a path or it isn't a string we can't do anything
        if (!exists(path) || "string" !== typeof path) return undefined;
        // on rare occasions this method would be called under the context
        // of enyo itself, the problem is detecting when this is intended since
        // under normal circumstances a general call would assume a window
        // context - here we see the _recursive_ parameter taking a double
        // meaning as enyo should _never be used as a reference on another object_
        // and as long as that is true this will never fail - so if enyo is to be
        // used as the context root and not window pass the second parameter as true
        // knowing during recursion enyo should never be the context and its normal
        // use case would prevail
        var cur = this === enyo && true !== recursive? window: this;
        var idx = 0;
        var val;
        var part;
        var fn;
        // clear any leading periods
        path = preparePath(path);
        // find the initial period if any from our ie8 safe polyfill
        idx = stringIndexOf(path, ".");
        // if there isn't any try and find the path relative to our
        // current context, this is the fast path
        if (-1 === idx) {
            // figure out what our default/backwards-compatible getter
            // function would be
            fn = "get" + enyo.cap(path);
            // if that path exists relative to our context check to see
            // if it is an overloaded getter and call that if it is otherwise
            // just grab that path knowing if we get undefined that is ok
            val = isOverloaded(cur[fn])? cur[fn].call(this): cur[path];
        } else {
            // begin our recursive search
            part = path.substring(0, idx);
            path = path.slice(idx);
            if ("object" === typeof cur[part]) {
                // if we can find the given part of the string path
                // we recursively call the getPath method using that
                // as the new context
                val = enyo.getPath.call(cur[part], path, true);
            } else {
                // we have no idea what we could do because we can't find
                // anything useful
                return undefined;
            }
        }
        // if the return value is a function check to see if it is
        // a computed property and if this is _not a recursive search_
        // go ahead and call it, otherwise return it as a function
        if ("function" === typeof val && true === val.isProperty) {
            if (true !== recursive) return val.call(this);
        }
        // otherwise we've reached the end so return whatever we have
        return val;
    };
    
    //*@public
    /**
        A global setter that takes a string path (relative to the methods
        execution context) or a full-path (relative to window). It attempts
        to automatically retrieve any previous value if it exists to supply
        to any observers. If the context is an enyo.Object or subkind it will
        use the notifyObservers method to trigger listeners for the path
        being set. If the previous value is the equivalent of the newly set
        value observers will not be triggered by default. If the third
        parameter is present and an explicit boolean true it will trigger
        the observers regardless. Optionally the third parameter can be a
        function-comparator that accepts two parameters, left and right
        respectively that is expected to return a truthy-falsy value to
        determine whether or not the notifications will be fired. Returns
        the context from which the method was executed. Unlike its getter
        counter-part this is not a recursive method.
    */
    enyo.setPath = function (path, value, force) {
        // if there are less than 2 parameters we can't do anything
        if(!(exists(path) && exists(value)) || "string" !== typeof path) return this;
        var cur = this;
        var target;
        var parts;
        var notify = true === force? true: false;
        var comparator = "function" === typeof force? force: undefined;
        // attempt to retrieve the previous value if it exists
        var prev = enyo.getPath.call(this, path);
        // clear any leading periods
        path = preparePath(path);
        // find the inital index of any period in the path
        idx = stringIndexOf(path, ".");
        // if there wasn't one we can attempt to fast-path this setter
        if (-1 === idx) {
            target = this[path];
            // if the target path leads us to a function and it is a computed
            // property we will actually call the computed property passing it
            // the value
            if (true === isComputed(target)) {
                target.call(this, value);
            } else {
                // otherwise we just plain overwrite the method, this is the
                // expected behavior
                this[path] = value;
            }
        } else {
            // we have to walk the path until we find the end
            parts = path.split(".");
            // while we have any other parts to inspect
            while (parts.length) {
                target = parts.shift();
                // the rare case where the path could specify enyo
                // and is executed under the context of enyo
                if ("enyo" === target && enyo === this) continue;
                // if this is the last piece we test to see if it is a computed
                // property and if it is we call it with the new value
                // as in the fast path
                if (0 === parts.length) {
                    if (true === isComputed(target)) {
                        target.call(this, value);
                    } else {
                        // otherwise we overwrite it just like in the fast-path
                        cur[target] = value;
                    }
                } else {
                    // we update our current reference context and if it does
                    // not exist at the requested path it will be created
                    if ("object" !== typeof cur[target]) cur[target] = {};
                    cur = cur[target];
                }
            }
        }
        // now we need to determine if we are going to issue notifications
        // first check to see if notify is already forced true
        if (true !== notify) {
            // now check to see if we have a comparator and if so use it
            // to determine if we're going to trigger observers
            if (comparator) {
                notify = comparator(prev, value);
            } else {
                // do the default which is to test the previous value
                // versus the new value
                notify = !(prev === value);
            }
        }
        if (true === notify) {
            if (this.notifyObservers) {
                this.notifyObservers(path, prev, value);
            }
        }
        // return the callee
        return this;
    };

  //*@protected
  /**
    For any property of an object that can be implemented with a
    _String_ representation of the class, _String_ representation of
    an instance, a _Function_/_Constructor_ for a class or a reference
    to an instance. They call this function using call/apply so the
    method may use _this_ and the name of the _property_ to inspect and
    qualify. It follows a strict pattern to ensure a normalized behavior.
    Typically not called directly.
  */
  enyo._findAndInstance = function (property, fn) {
    var ident, ctor, inst, klass = property.toLowerCase() + "Class",
        name = klass + "Name";
    ident = this[property];
    if (!ident) return fn(ctor, inst);
    if ("string" === typeof ident) {
      ctor = enyo.getPath(ident);
      if (!ctor) {
        this[name] = ident;
        this[property] = undefined;
      } else if ("function" !== typeof ctor) {
        inst = ctor;
        ctor = null;
      }
    } else if ("function" === typeof ident) {
      ctor = ident;
      this[klass] = ctor;
    } else {
      inst = ident;
      this[name] = inst.kindName || inst.kind;
      this[property] = inst;
    }
    if (ctor && !inst) inst = new ctor();
    this[property] = inst;
    fn(ctor, inst);
  };

  //*@public
  /**
    Create a unique id with an optional prefix.
  */
  enyo.uid = function (prefix) {
    var id = enyo._idCounter++;
    return prefix? prefix + id: id;
  };
  
	enyo._getProp = function(parts, create, context) {
		var obj = context || enyo.global;
		for(var i=0, p; obj && (p=parts[i]); i++){
			obj = (p in obj ? obj[p] : (create ? obj[p]={} : undefined));
		}
		return obj;
	};

	//* @public

	/**
		Sets object _name_ to _value_. _name_ can use dot notation and intermediate objects are created as necessary.

			// set foo.bar.baz to 3. If foo or foo.bar do not exist, they are created.
			enyo.setObject("foo.bar.baz", 3);

		Optionally, _name_ can be relative to object _context_.

			// create foo.zot and sets foo.zot.zap to null.
			enyo.setObject("zot.zap", null, foo);
	*/
	enyo.setObject = function(name, value, context) {
		var parts=name.split("."), p=parts.pop(), obj=enyo._getProp(parts, true, context);
		return obj && p ? (obj[p]=value) : undefined;
	};

	/**
		Gets object _name_. _name_ can use dot notation. Intermediate objects are created if _create_ argument is truthy.

			// get the value of foo.bar, or undefined if foo doesn't exist.
			var value = enyo.getObject("foo.bar");

			// get the value of foo.bar. If foo.bar doesn't exist,
			// it's assigned an empty object, which is returned
			var value = enyo.getObject("foo.bar", true);

		Optionally, _name_ can be relative to object _context_.

			// get the value of foo.zot.zap, or undefined if foo.zot doesn't exist
			var value = enyo.getObject("zot.zap", false, foo);
	*/
	enyo.getObject = function(name, create, context) {
		return enyo._getProp(name.split("."), create, context);
	};

	//* Returns a random Integer between 0 and inBound (0 <= results < inBound).
	//
	//		var randomLetter = String.fromCharCode(enyo.irand(26) + 97);
	//
	enyo.irand = function(inBound) {
		return Math.floor(Math.random() * inBound);
	};

	//* Returns _inString_ with the first letter capitalized.
	enyo.cap = function(inString) {
		return inString.slice(0, 1).toUpperCase() + inString.slice(1);
	};

	//* Returns _inString_ with the first letter un-capitalized.
	enyo.uncap = function(inString) {
		return inString.slice(0, 1).toLowerCase() + inString.slice(1);
	};

	enyo.format = function(inVarArgs) {
		var pattern = /\%./g;
		var arg = 0, template = inVarArgs, args = arguments;
		var replacer = function(inCode) {
			return args[++arg];
		};
		return template.replace(pattern, replacer);
	};

	var toString = Object.prototype.toString;

	//* Returns true if _it_ is a string.
	enyo.isString = function(it) {
		return toString.call(it) === "[object String]";
	};

	//* Returns true if _it_ is a function.
	enyo.isFunction = function(it) {
		return toString.call(it) === "[object Function]";
	};

	//* Returns true if _it_ is an array.
	enyo.isArray = Array.isArray || function(it) {
		return toString.call(it) === "[object Array]";
	};

	//* Returns true if the argument is true
	enyo.isTrue = function(it) {
		return !(it === "false" || it === false || it === 0 || it === null || it === undefined)
	}

	//* Returns the index of the element in _inArray_ that is equivalent (==) to _inElement_, or -1 if no element is found.
	enyo.indexOf = function(inElement, inArray, fromIndex) {
		if (inArray.indexOf) {
			return inArray.indexOf(inElement, fromIndex);
		}

		if (fromIndex) {
			if (fromIndex < 0) {
				fromIndex = 0;
			}

			if (fromIndex > inArray.length) {
				return -1;
			}
		}

		for (var i=fromIndex || 0, l=inArray.length, e; (e=inArray[i]) || (i<l); i++) {
			if (e == inElement) {
				return i;
			}
		}
		return -1;
	};

	//* Removes the first element in _inArray_ that is equivalent (==) to _inElement_.
	enyo.remove = function(inElement, inArray) {
		var i = enyo.indexOf(inElement, inArray);
		if (i >= 0) {
			inArray.splice(i, 1);
		}
	};

	/**
		Invokes _inFunc_ on each element of _inArray_.
		If _inContext_ is specified, _inFunc_ is called with _inContext_ as _this_.
	*/
	enyo.forEach = function(inArray, inFunc, inContext) {
		if (inArray) {
			var c = inContext || this;
			if (enyo.isArray(inArray) && inArray.forEach) {
				inArray.forEach(inFunc, c);
			} else {
				var a = Object(inArray);
				var al = a.length >>> 0;
				for (var i = 0; i < al; i++) {
					if (i in a) {
						inFunc.call(c, a[i], i, a);
					}
				}
			}
		}
	};

	/**
		Invokes _inFunc_ on each element of _inArray_, and returns the results as an Array.
		If _inContext_ is specified, _inFunc_ is called with _inContext_ as _this_.
	*/
	enyo.map = function(inArray, inFunc, inContext) {
		var c = inContext || this;
		if (enyo.isArray(inArray) && inArray.map) {
			return inArray.map(inFunc, c);
		} else {
			var results = [];
			var add = function(e, i, a) {
				results.push(inFunc.call(c, e, i, a));
			};
			enyo.forEach(inArray, add, c);
			return results;
		}
	};


  /**
    Concatenate any number of arrays but only the unique entries
    relative to the base (first) array.
  */
  enyo.merge = function () {
    var r = [], args = enyo.toArray(arguments), a, i = 0, j;
    for (; args.length; ++i) {
      a = args.shift();
      if (!enyo.isArray(a)) continue;
      if (i === 0) r = enyo.clone(a);
      else {
        for (j = 0; j < a.length; ++j)
          if (r.indexOf(a[j]) > -1) continue;
          else r.push(a[j]);
      }
    }
    return r;
  };
  
  /**
    Return a union of any number of arrays.
    
    TODO: come back to this off the cuff atrocity
  */
  enyo.union = function () {
    var c = Array.prototype.concat.apply([], arguments), s = [], r = [];
    enyo.forEach(c, function (v, i) {
      if (!~s.indexOf(v)) {
        s.push(v);
        if (i === c.lastIndexOf(v)) r.push(v);
      }
    });
    return r;
  };
  
  enyo.only = function (inProps, inObject) {
    var r = [], k;
    if (!inProps || !inObject) return r;
    if (!enyo.isArray(inProps) && inProps) inProps = [inProps];
    for (k in inObject)
      if (!inObject.hasOwnProperty(k)) continue;
      else if (inProps.indexOf(k) !== -1 && r.indexOf(k) === -1)
        r.push(inObject[k]);
    return r;
  };
  
  enyo.except = function (inProps, inObject) {
    var r = {}, keep = enyo.union(inProps, enyo.keys(inObject));
    enyo.forEach(keep, function (k) {r[k] = inObject[k]});
    return r;
  };
  
  /**
    Take an array of objects of a common structure and return
    a hash of those objects keyed by the unique value _inProp_.
    An optional filter/resolution method may be provided to
    handle exception cases. It receives parameters in the order:
    the property, the current object in the array, a reference to
    the return object, and a copy of the original array.
    
    TODO: This should be capable of a few other things...
  */
  enyo.indexBy = function (inProp, inArray, inFilter) {
    var k = inProp, a = inArray, r = {}, v, c = enyo.clone(inArray),
        fn = enyo.isFunction(inFilter)? inFilter: undefined, i = 0;
    for (; i < a.length; ++i) {
      v = a[i];
      if (v && v[k]) {
        if (fn) fn(k, v, r, c);
        else r[v[k]] = v;
      }
    }
    return r;
  };
  
  enyo.allKeys = function (inObj) {
    var k, o = inObj, r = [];
    for (k in inObj) r.push(k);
    return r;
  };

  enyo.pluck = function (inProp, inArray) {
    var r = [], i = 0, a;
    a = enyo.isArray(inArray)? inArray: [inArray];
    for (; i < a.length; ++i) {
      if (!a[i]) continue;
      if (a[i][inProp]) r.push(a[i][inProp]);
    }
    return r;
  };

	/**
		Creates a new array with all elements of _inArray_ that pass the test implemented by _inFunc_.
		If _inContext_ is specified, _inFunc_ is called with _inContext_ as _this_.
	*/
	enyo.filter = function(inArray, inFunc, inContext) {
		var c = inContext || this;
		if (enyo.isArray(inArray) && inArray.filter) {
			return inArray.filter(inFunc, c);
		} else {
			var results = [];
			var f = function(e, i, a) {
				var eo = e;
				if (inFunc.call(c, e, i, a)) {
					results.push(eo);
				}
			};
			enyo.forEach(inArray, f, c);
			return results;
		}
	};

	/**
		Returns an array of all own enumerable properties found on _inObject_.
	*/
	enyo.keys = Object.keys || function(inObject) {
		var results = [];
		var hop = Object.prototype.hasOwnProperty;
		for (var prop in inObject) {
			if (hop.call(inObject, prop)) {
				results.push(prop);
			}
		}
		// *sigh* IE 8
		if (!({toString: null}).propertyIsEnumerable("toString")) {
			var dontEnums = [
				'toString',
				'toLocaleString',
				'valueOf',
				'hasOwnProperty',
				'isPrototypeOf',
				'propertyIsEnumerable',
				'constructor'
			];
			for (var i = 0, p; p = dontEnums[i]; i++) {
				if (hop.call(inObject, p)) {
					results.push(p);
				}
			}
		}
		return results;
	};

	/**
		Clones an existing Array, or converts an array-like object into an Array.
		
		If _inOffset_ is non-zero, the cloning is started from that index in the source Array.
		The clone may be appended to an existing Array by passing the existing Array as _inStartWith_.
		
		Array-like objects have _length_ properties, and support square-bracket notation ([]).
		Often array-like objects do not support Array methods, such as _push_ or _concat_, and
		must be converted to Arrays before use.
		
		The special _arguments_ variable is an example of an array-like object.
	*/
	enyo.cloneArray = function(inArrayLike, inOffset, inStartWith) {
		var arr = inStartWith || [];
		for(var i = inOffset || 0, l = inArrayLike.length; i<l; i++){
			arr.push(inArrayLike[i]);
		}
		return arr;
	};
	enyo.toArray = enyo.cloneArray;

	/**
		Shallow-clones an object or an array.
	*/
	enyo.clone = function(obj) {
		return enyo.isArray(obj) ? enyo.cloneArray(obj) : enyo.mixin({}, obj);
	};

	//* @protected
	var empty = {};

	//* @public
	/**
		Copies custom properties from the _source_ object to the _target_ object.
		If _target_ is falsey, an object is created.
		If _source_ is falsey, the target or empty object is returned.
	*/
	enyo.mixin = function(target, source) {
		target = target || {};
		if (source) {
			var name, s, i;
			for (name in source) {
				// the "empty" conditional avoids copying properties in "source"
				// inherited from Object.prototype.  For example, if target has a custom
				// toString() method, don't overwrite it with the toString() method
				// that source inherited from Object.prototype
				s = source[name];
				if (empty[name] !== s) {
					target[name] = s;
				}
			}
		}
		return target;
	};

	//* @public
	/**
		Returns a function closure that will call (and return the value of)
		function _method_, with _scope_ as _this_.

		_method_ can be a function or the string name of a function-valued
		property on _scope_.

		Arguments to the closure are passed into the bound function.

			// a function that binds this to this.foo
			var fn = enyo.bind(this, "foo");
			// the value of this.foo(3)
			var value = fn(3);

		Optionally, any number of arguments may be prefixed to the bound function.

			// a function that binds this to this.bar, with arguments ("hello", 42)
			var fn = enyo.bind(this, "bar", "hello", 42);
			// the value of this.bar("hello", 42, "goodbye");
			var value = fn("goodbye");

		Functions may be bound to any scope.

			// binds function 'bar' to scope 'foo'
			var fn = enyo.bind(foo, bar);
			// the value of bar.call(foo);
			var value = fn();
	*/
	enyo.bind = function(scope, method/*, bound arguments*/){
		if (!method) {
			method = scope;
			scope = null;
		}
		scope = scope || enyo.global;
		if (enyo.isString(method)) {
			if (scope[method]) {
				method = scope[method];
			} else {
				throw(['enyo.bind: scope["', method, '"] is null (scope="', scope, '")'].join(''));
			}
		}
		if (enyo.isFunction(method)) {
			var args = enyo.cloneArray(arguments, 2);
			if (method.bind) {
				return method.bind.apply(method, [scope].concat(args));
			} else {
				return function() {
					var nargs = enyo.cloneArray(arguments);
					// invoke with collected args
					return method.apply(scope, args.concat(nargs));
				};
			}
		} else {
			throw(['enyo.bind: scope["', method, '"] is not a function (scope="', scope, '")'].join(''));
		}
	};

	/**
		Calls method _inMethod_ on _inScope_ asynchronously.

		Uses _window.setTimeout_ with minimum delay, usually
		around 10ms.

		Additional arguments are passed to _inMethod_ when
		it is invoked.
	*/
	enyo.asyncMethod = function(inScope, inMethod/*, inArgs*/) {
		return setTimeout(enyo.bind.apply(enyo, arguments), 1);
	};

	/**
		Calls named method _inMethod_ (String) on _inObject_ with optional
		arguments _inArguments_ (Array), if the object and method exist.

			enyo.call(myWorkObject, "doWork", [3, "foo"]);
	*/
	enyo.call = function(inObject, inMethod, inArguments) {
		var context = inObject || this;
		if (inMethod) {
			var fn = context[inMethod] || inMethod;
			if (fn && fn.apply) {
				return fn.apply(context, inArguments || []);
			}
		}
	};

	/**
		Returns the current time.

		The returned value is equivalent to _new Date().getTime()_.
	*/
	enyo.now = Date.now || function() {
		return new Date().getTime();
	};

	//* @protected

	enyo.nop = function(){};
	enyo.nob = {};
	enyo.nar = [];

	// this name is reported in inspectors as the type of objects created via delegate,
	// otherwise we would just use enyo.nop
	enyo.instance = function() {};

	// some platforms need alternative syntax (e.g., when compiled as a v8 builtin)
	if (!enyo.setPrototype) {
		enyo.setPrototype = function(ctor, proto) {
			ctor.prototype = proto;
		};
	}

	// boodman/crockford delegation w/cornford optimization
	enyo.delegate = function(obj) {
		enyo.setPrototype(enyo.instance, obj);
		return new enyo.instance();
	};
	
	//* @public

	/**
		Provides a stub function for _g11n_ string translation. This allows
		strings to be wrapped in preparation for localization. If the _g11n_
		library is not loaded, this function will return the string as is.

			$L('Welcome')

		If the _g11n_ library is loaded, this function will be replaced by the
		_g11n_ library version, which translates wrapped strings to strings from
		a developer-provided resource file corresponding to the current user
		locale.
	*/
	$L = function(string) {
		return string;
	};
})();
