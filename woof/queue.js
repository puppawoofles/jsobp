
class PromiseIdAttr {
	static generate(elt) {
		var current = PromiseIdAttr.get(elt);
		if (current) return current;
		var newId = Utils.UUID();
		PromiseIdAttr.set(elt, newId);
		return newId;
	}		
}
Utils.classMixin(PromiseIdAttr, StringAttr, "promise-id");

class EffectQueue {
	static InvokePhase = new ScopedAttr("invoke-phase", StringAttr);
	static Phase = new ScopedAttr("phase", StringAttr);

	static find(elt) {
		return Utils.bfind(elt, 'body', "[woof-queue]");
	}

	static findUp(elt) {
		var found = WoofType.findUp(elt, "EffectQueue");
		if (found) return found;
		
		found = Utils.findUp(elt, "[woof-queue]");
		if (!found) return null;
		
		return qs(found, found.getAttribute('woof-queue'));		
	}
	
	static findDown(elt) {
		return qs(elt, '[wt="EffectQueue"]');
	}

	static getHandlerContainer(elt) {
		var queue = EffectQueue.findUp(elt);
		if (!queue) {
			queue = EffectQueue.findDown(elt);
		}
		return qs(queue, 'handlers');
	}
	
	static findHandlersFor(element) {
		var queue = EffectQueue.findUp(element);
		var eventType = GameEffect.getType(element);
		var phase = EffectQueue.Phase.get(element) || 'before';
		var type;
		if (phase == 'started') {
			type = eventType;
		} else {
			type = eventType + ":" + phase;
		}
		Logger.trace("Attempting " + type );
		
		return qsa(queue, "[event-types~='" + type + "']");
	}
	
	static findDefaultHandler(element) {
		return WoofRootController.controller(qs(element, 'effects > handlers').getAttribute("default"));
	}

	static currentQueue(element) {
		var queue = EffectQueue.find(element);
		return EffectQueue.findCurrentQueue(queue);
	}
	
	static findCurrentEvent(element) {
		var current = qs(element, 'queue > game-effect');
		if (!current) {
			current = bf(element, 'game-effect');
			if (!current) return null;
		};
		var next = qs(current, 'queue > game-effect');
		if (!next) return current;
		
		while (next) {
			current = next;
			next = qs(current, 'queue > game-effect');
		}
		return current;		
	}

	static findCurrentQueue(element) {
		var event = EffectQueue.findCurrentEvent(element);
		if (!event) {
			return Utils.bfind(element, 'body', 'queue');
		}
		return event;
	}
	

	static Handler = new ScopedAttr("handler", FunctionAttr);
	static invokeHandler(handler, current, args) {
		var result = EffectQueue.Handler.findAInvoke(handler, args);
		if (!!result && typeof(result["then"]) == "function") {
			// This is a promise.  We should do our ticketing BS.
			var ticket = PendingOpAttr.takeTicket(current, "auto");
			result = result.then(function(result) {
				PendingOpAttr.returnTicket(current, ticket);
				return result;
			})
		}
		return Promise.resolve(result);
	}

	static pendingPromises = {};	
	static pushEvent(element, event) {
		var id = IdAttr.generate(event);
		var promiseId = PromiseIdAttr.generate(event);
		if (!element.matches('queue')) {
			element = qs(element, 'queue');
		}
		if (!EffectQueue.pendingPromises[promiseId]) {
			EffectQueue.pendingPromises[promiseId] = new PromiseSetter();
		}
		element.appendChild(event);
		return EffectQueue.pendingPromises[promiseId].promise();
	}

    static Value = new ScopedAttr("value", BlobAttr);
    static SkipLog = new ScopedAttr('skip-log', BoolAttr);
    static Label = new ScopedAttr('label', StringAttr);
		
	static Invoked = new ScopedAttr("invoked", BoolAttr);
	static evoke(queue) {
		var current = EffectQueue.findCurrentEvent(queue);
		if (!current) return;
		var id = IdAttr.get(current);
		if (!id) IdAttr.generate(current);				
		var children = GameEffect.getChildEvents(current);
		if (children.length > 0) throw boom("EffectQueue got non-bottom child", current);		
		var pending = GameEffect.IsPending.get(current);
		
		if (pending) {
			// Blocked on something else.  Gotta wait for that.
			return false;
		}
		
		var pendingOp = PendingOpAttr.get(current);
		if (pendingOp.length > 0) {
			// Blocked on something else.
			return false;
		}
		
		var phase = EffectQueue.Phase.get(current);
		var result;
		var promiseId = PromiseIdAttr.get(current);
		var promiseSetter = !!promiseId ? EffectQueue.pendingPromises[promiseId] : null;
		
		switch (phase) {
			case null:
			    EffectQueue.Phase.set(current, 'before');
			case 'before':
				// First phase: Basically for pre-empting / counterspelling.
				if (EffectQueue.InvokePhase.get(current) != 'before') {
					var handlers = EffectQueue.findHandlersFor(current);
					for (var handler of handlers) {
						EffectQueue.invokeHandler(handler, current, [current, handler]);
					}
					EffectQueue.InvokePhase.set(current, 'before');
				}

				// If it's cancelled, finish canceling it.

				if (GameEffect.cancelled(current)) {
					// Event was cancelled.
					if (!!promiseSetter) {
						promiseSetter.reject("cancelled");
						delete EffectQueue.pendingPromises[promiseId];
					}
					current.parentNode.removeChild(current);
				}

				// If it's pending, wait for it to wrap up.
				if (GameEffect.IsPending.get(current)) return false;
				if (GameEffect.IsPending.get(current).length > 0) return false;

				// Hooray, we can move on.
				EffectQueue.Phase.set(current, 'started');
			case 'started':
				// Second phase: Actually invoking it.
				if (!EffectQueue.Invoked.get(current)) {
					if (EffectQueue.InvokePhase.get(current) != 'started') {
						var handlers = EffectQueue.findHandlersFor(current);
					
						// We force exactly 1 handler here.  It makes dealing
						// with results easier.
						if (handlers.length != 1) throw boom("Unexpected number of invocation handlers", handlers);	
						var resultPromise = EffectQueue.invokeHandler(handlers[0], current, [current, handlers[0]])
						EffectQueue.Invoked.set(current, true);
						EffectQueue.InvokePhase.set(current, 'started');
						resultPromise.then(function(actualResult) {
							// Set our result.
							if (!!actualResult) {
								GameEffect.setRawResult(current, actualResult);
								EffectQueue.Phase.set(current, 'after');
							}
						});
					}
				}

				// If it's pending, wait for it to wrap up.
				if (GameEffect.IsPending.get(current)) return false;
				if (GameEffect.IsPending.get(current).length > 0) return false;
				result = GameEffect.getResult(current);
				// No result?  We gotta wait.
				if (result === undefined || result === null) return false;

				// Hooray, we can move on.
				EffectQueue.Phase.set(current, 'after');				
			case 'after':
				// Third phase: Posting the results.
				result = result || GameEffect.getResult(current);				
				
				if (EffectQueue.InvokePhase.get(current) != 'after') {
					var handlers = EffectQueue.findHandlersFor(current);					
					for (var handler of handlers) {
						EffectQueue.invokeHandler(handler, current, [current, handler]);
					}
					EffectQueue.InvokePhase.set(current, 'after');
				}
				
				if (GameEffect.IsPending.get(current)) return false;
				if (PendingOpAttr.get(current).length > 0) return false;
				
				EffectQueue.Phase.set(current, 'complete');				
			case 'complete':
				// We already did a pending check above.  Only thing left
				// is to get rid of this element once we resolve the promise.				
				result = result || GameEffect.getResult(current);
				if (!!promiseSetter) {
					promiseSetter.resolve(result);
					delete EffectQueue.pendingPromises[promiseId];					
				}

                // Next up, we need to clean up this event.  We want to accomplish this in 2 ways:
                // 1) Create a result blob for this event.
                // 2) Add all our child results to it.
                // 3) Append it to our parent.

                // This will eventually slow the DOM to a crawl, but whatevs lol.
                var resultElt = GameEffect.dumpToResult(current);
                var parentEffect = GameEffect.getParent(current);
                GameEffect.addResultElt(parentEffect, resultElt);
				current.parentNode.removeChild(current);
				break;
		}
		return true;
	}
}

class PromiseSetter {
	constructor() {
		this.isSet_ = false;
		this.resolve_ = null;
		this.reject_ = null;
		this.temp_ = null;
		this.promise_ = new Promise(this.init.bind(this));
	}
	
	init(resolve, reject) {
		if (this.isSet_) {			
			if (this.resolve_) {
				resolve.apply(null, this.temp_);
			} else {
				reject.apply(null, this.temp_);				
			}
			return;
		}		
		this.resolve_ = resolve;
		this.reject_ = reject;
	}
	
	promise() { return this.promise_; }
	resolve() {
		if (this.isSet_) return;
		this.isSet_ = true;
		if (this.resolve_) this.resolve_.apply(null, arguments);
		this.temp_ = arguments;
		this.resolve_ = true;
	}
	reject() {
		if (this.isSet_) return;
		this.isSet_ = true;
		if (this.reject_) this.reject_.apply(null, arguments);
		this.temp_ = arguments;
		this.reject_ = true;
	}
	completed() { return this.isSet_; }
}


/** Intended to be a base class. */
class GameEffect {
    static Label = new ScopedAttr('label', StringAttr);
    static HandlerLabel = new ScopedAttr('handler-label', StringAttr);
	static create(type, opt_config, opt_handler) {
		var element = Templates.inflate("game_effect", {
			ID: Utils.UUID(),
			TYPE: type
		});
		if (opt_config) GameEffect.setParams(element, opt_config);
        if (opt_handler && GameEffect.Label.has(opt_handler)) GameEffect.HandlerLabel.set(element, GameEffect.Label.get(opt_handler));
		return element;		
	}
	
	static getType(elt) {
		return elt.getAttribute("type");
	}
	
	static getParent(elt) {
		if (WoofType.has(elt, "Effect")) elt = elt.parentNode;
		return WoofType.findUp(elt, "Effect");
	}
	
	static findParentByType(elt, type) {
		return Utils.findUp(elt, "[type='" + type + "']");
	}
	
	static getParams(elt) {
		var params = elt.getAttribute("params") || null;
		if (!params) return null;
		var json = JSON.parse(params);
		return GameEffect.denormalize(elt, json);
	}
	
	static getResult(elt) {
		var result = elt.getAttribute("result") || null;
		if (!result) return null;
		var json = JSON.parse(result);
		return GameEffect.denormalize(elt, json);
	}

    static ResultValue = new ScopedAttr('value', BlobAttr);
    static addChildResult(elt, type, blob) {
        var container = qs(elt, 'results');
        var child = Templates.inflateIn('game_effect_result', container, {
            TYPE: type
        });
        GameEffect.ResultValue.set(child, blob)
    }
	
	static createResults(effect, selfResult) {
        if (selfResult === undefined) selfResult = {};
        selfResult.type = GameEffect.getType(effect);
        return selfResult;
	}

    static Params = new ScopedAttr('params', BlobAttr);
	static setParams(elt, params) {
        GameEffect.Params.set(elt, params);
		return elt;
	}

	static __simpleClone(obj) {
		var clone;
		if (obj instanceof HTMLElement || obj == null) {
			clone = obj; // No clone.
		} else if (Array.isArray(obj)) {
			clone = [];
			for (var i = 0; i < obj.length; i++) {
				clone[i] = GameEffect.__simpleClone(obj[i]);
			}
		} else if (typeof obj === 'object') {
			clone = {};
			for (var [key, value] of Object.entries(obj)) {
				if (obj.hasOwnProperty(key)) clone[key] = GameEffect.__simpleClone(value);
			}
		} else {
			clone = obj; // No clone.
		}
		return clone;
	}
	
	static normalize(elt, params) {	
		params = GameEffect.__simpleClone(params);
		var serializeFn = function(obj) {
			Object.keys(obj).forEach(function(key) {
				var value = obj[key];
				if (value instanceof HTMLElement) {
					obj[key] = {
						____: true,
						element: WoofType.buildSelectorFor(value)
					}
				} else if (typeof obj[key] === 'object' && obj[key] !== null) {
					serializeFn(obj[key]);
				}
			});	
		}
		serializeFn(params);

		if (!params.type) {
			params.type = GameEffect.getType(elt);
		}
		return params;
	}

	static denormalize(elt, params) {

		var deserializeFn = function(obj) {
			Object.keys(obj).forEach(function(key) {
				if (obj[key] !== null && obj[key]["____"] && obj[key].element) {
					obj[key] = Utils.bfind(elt, 'body', obj[key].element);
				} else if (typeof obj[key] === 'object' && obj[key] !== null) {
					deserializeFn(obj[key]);
				}
			});
		};
		deserializeFn(params);

		return params;
	}

    static Result = new ScopedAttr('result', BlobAttr);
	static setResult(elt, result) {
        return GameEffect.setRawResult(elt, GameEffect.createResults(elt, result));
	}

    static setRawResult(elt, result) {
        GameEffect.Result.set(elt, result || {});
		return elt;
	}
	
	static push(base, newBoy) {
		if (!newBoy) return;
		return EffectQueue.pushEvent(base, newBoy);
	}
	
	static enqueue(base, newBoy) {
		var queue = EffectQueue.findUp(base);
		if (!queue) throw boom("Can't find effect queue from", base);		
		return EffectQueue.pushEvent(queue, newBoy);		
	}
	
	static getChildEvents(base) {
		return qsa(base, ":scope > queue > game-effect");
	}
	
	static before(actualFn) {
		return (current, handler) => {
			var params = GameEffect.getParams(current);
			return Promise.resolve(actualFn(handler, current, params));
		};
	}
	
	static handle(actualFn) {
		return (current, handler) => {
			var params = GameEffect.getParams(current);
			return Promise.resolve(actualFn(handler, current, params));
		}
	}
	
	static after(actualFn) {
		return (current, handler) => {
			var params = GameEffect.getParams(current);
			var result = GameEffect.getResult(current);
			return Promise.resolve(actualFn(handler, current, params, result));
		}
	}
	
	static Type = new ScopedAttr("type", StringAttr);
	static getType(event) {
		return GameEffect.Type.findGet(event);
	}
	
	static IsPending = new ScopedAttr("is-pending", BoolAttr);
	static OnChildChange(event, handler) {
		var parent;
		if (WoofType.has(event.target, "Effect")) {
			parent = WoofType.findUp(event.target.parentNode, "Effect");
		} else {
			parent = WoofType.findUp(event.target, "Effect");
		}

        if (parent) GameEffect.IsPending.set(parent, !!qs(parent, 'queue').childElementCount);
	}

	static findById(relativeElt, id) {
		return Utils.bfind(relativeElt, 'body', WoofType.buildSelectorFrom('Effect', id));
	}

	static Cancelled = new ScopedAttr("cancelled", BoolAttr);
	static cancel(effect) {
		GameEffect.Cancelled.set(effect, true);
	}

	static cancelled(effect) {
		return !!GameEffect.Cancelled.get(effect);
	}

    static dumpToResult(effect) {
        var resultElt = Templates.inflate('game_effect_result', {
            TYPE: GameEffect.getType(effect)
        });
        // Copy our params and results.
        GameEffect.Params.copy(resultElt, effect);
        GameEffect.ResultValue.set(resultElt, GameEffect.getResult(effect));

        // Copy over our label if it helps us know why this happened.
        if (GameEffect.Label.has(effect)) {
            GameEffect.Label.copy(resultElt, effect);
        }

        // Move our child results over.
        var childResults = qs(effect, 'results');
        Utils.moveChildren(childResults, resultElt);
        return resultElt;
    }

    static addResultElt(effect, newResult) {
        qs(effect, 'results').appendChild(newResult);
    }
}
WoofRootController.register(GameEffect);

class GameEffectInvoker {	
	static Timeout = new ScopedAttr("timeout", IntAttr);

	static start(queueElt) {
		try {
			var start = window.performance.now();
			/** Ensure 60 FPS */
			while (window.performance.now() - start < (1000.0 / 60)) {					
				if (!EffectQueue.evoke(queueElt)) {
					break;
				}
			}
		} catch (e) {
			Logger.err(e);
		}
		GameEffectInvoker.Timeout.set(queueElt, null);
		var current = EffectQueue.findCurrentEvent(queueElt);
		if (!!current && PendingOpAttr.size(current) == 0) {
			// Set a timeout if we want to pick this up, but only if there are no pending
			// operations.
			var timeout = window.setTimeout(GameEffectInvoker.start.bind(this, queueElt), 0);	
			GameEffectInvoker.Timeout.set(queueElt, timeout);
		}
	}	
	
	static stopTimer(queueElt) {
		var timer = GameEffectInvoker.Timeout.get(queueElt);
		if (typeof(timer) == 'number') {
			window.clearTimeout(timer);
		}		
	}
	
	static OnNewElement(event, handler) {
		var queue = EffectQueue.findDown(handler);
		
		var event = EffectQueue.findCurrentEvent(handler);
		if (event) {
			var timeout = GameEffectInvoker.Timeout.get(handler);
			if (isNaN(timeout)) {
				GameEffectInvoker.start(queue);
			}
		} else {
			GameEffectInvoker.stopTimer(queue);
		}
	}
}
WoofRootController.register(GameEffectInvoker);
