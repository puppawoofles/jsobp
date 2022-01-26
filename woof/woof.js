// ###################################################################
// ###############      FRAMEWORKY SHIT UP HERE        ###############
// ###################################################################

/** Sanity extensions */
Element.prototype["insertChild"] = function(child, index) {
	if (!index) index = 0;
	if (index >= this.children.length) {
		this.appendChild(child);
	} else {
		this.insertBefore(child, this.children[index]);
	}
}

Array.prototype["contains"] = function(value) {
	return this.indexOf(value) > -1;
}

Array.prototype["remove"] = function(value) {
	var idx = this.indexOf(value);
	if (idx < 0) return;
	this.splice(idx, 1);
};

Array.prototype["clone"] = function() {
	var returnMe = [];
	for (var i = 0; i < this.length; i++) {
		returnMe.push(this[i]);
	}
	return returnMe;
}

Array.prototype["extend"] = function(newArr) {
	if (this == newArr) return;
	if (newArr === null || newArr === undefined) return;
	while (newArr.length > 0) {
		this.push(newArr.shift());
	}
	return this;
}

Array.prototype["extendNoMove"] = function(newArr) {
	if (this == newArr) return;
	var clone = newArr.clone();
	this.extend(clone);
	return this;
}

Array.prototype["toObject"] = function(keyFn, opt_valueFn) {
	var toPut = {};
	for (var i = 0; i < this.length; i++) {
		toPut[keyFn(this[i], i)] = !!opt_valueFn ?
				opt_valueFn(this[i], i) :
				this[i]
	}	
	return toPut;
}

Array.prototype["groupBy"] = function(groupFn) {
	var toPut = {};
	for (var i = 0; i < this.length; i++) {
		var key = groupFn(this[i]);
		toPut[key] = toPut[key] || [];
		toPut[key].push(this[i]);
	}	
	return toPut;
}

Array.prototype["expandToObject"] = function(valueFn) {
	var toPut = {};
	for (var i = 0; i < this.length; i++) {
		toPut[this[i]] = valueFn(this[i]);
	}	
	return toPut;
}

Array.prototype["shuffle"] = function() {
	var current = this.length;
	var temp;
	var rando;
  
	while (0 != current) {

		// Pick a remaining element...
		rando = Math.floor(Math.random() * current);
		current -= 1;

		// And swap it with the current element.
		temp = this[current];
		this[current] = this[rando];
		this[rando] = temp;

    }
	// Return for chaining.
	return this;
}

Array.prototype["peek"] = function() {
	if (this.length == 0) return undefined;
	return this[this.length - 1];
}

Array.prototype["merge"] = function(mergeFn) {
	var toReturn = null;
	for (var i = 0; i < this.length; i++) {
		if (!toReturn) {
			toReturn = this[i];
			continue;
		}
		toReturn = mergeFn(toReturn, this[i], i);
	}

	return toReturn;
}

Array.prototype["findFirst"] = function(predicateFn) {
	for (var i = 0; i < this.length; i++) {
		if (predicateFn(this[i])) return this[i];
	}
	return null;
}

/* Normalize queryselectorall */
qsa = function(element, matcher) {
	return Array.from(element.querySelectorAll(matcher) || []);
}

/* Shorten queryselector */
qs = function(element, matcher) {
	return element.querySelector(matcher) || null;
}

/* Simplify boomerang-find */
bf = function(element, downMatcher, opt_upMatcher) {
	var up = opt_upMatcher ? matchParent(element, opt_upMatcher) : (element.ownerDocument || element);
	return qs(up, downMatcher);
}

/* Simplify boomerang-find-all */
bfa = function(element, downMatcher, opt_upMatcher) {
	var up = opt_upMatcher ? matchParent(element, opt_upMatcher) : (element.ownerDocument || element);
	return qsa(up, downMatcher);
}

a = function(thing) {
	return Array.from(thing);
}

sumMerge = function(a, b) {
	return a + b;
};

NodeList.prototype["map"] = Array.prototype["map"];

HTMLCollection.prototype["indexOf"] = Array.prototype["indexOf"];

isInDocument = function(elt) {
	return !!matchParent(elt, 'body');
}

isElement = function(elt) {
	return elt instanceof Element;
};

emptyObjectFn = function() { return {}; }

arrayToObject = function(array, keyFn) {
	var returnMe = {};
	for (var i = 0; i < array.length; i++) {
		returnMe[keyFn(array[i])] = array[i];
	}
	return returnMe;
}

parseBoolean = function(thingToBool) {
	if (thingToBool === null || thingToBool === undefined) return null;
	thingToBool = thingToBool.toLowerCase();
	if (thingToBool === 'true') return true;
	if (thingToBool === 'false') return false;
	return null;
}

boom = function() {
	window.console.log.apply(window.console, arguments);
	return new Error(Array.from(arguments).join(" "));
}

matchParent = function(elt, matcher) {
	var doc = elt.ownerDocument;
	while (!!elt && elt != doc) {
		if (!elt.matches) return null;
		if (elt.matches(matcher)) return elt;
		elt = elt.parentNode;
	}
	return null;
}

randomInt = function(max) {
	return Math.floor(Math.random() * max);
}

randomValue = function(arr) {
	return arr[randomInt(arr.length)];
}

times = function(int) {
	return a(Array(int).keys());
}

/**
 * Adapted from Squirrel Eiserloh's http://eiserloh.net/noise/SquirrelNoise5.hpp
 * TODO figure out licensing / credit / whatever.  Suck it, RNG!
 **/
class Noise {
	static NOISE = [
		parseInt("11010010101010000000101000111111", 2),
		parseInt("10101000100001001111000110010111", 2),
		parseInt("01101100011100110110111101001011", 2),
		parseInt("10110111100111110011101010111011", 2),
		parseInt("00011011010101101100010011110101", 2)
	];

	// Everything after index 3 is me going off script trying to follow patterns.
	// This caps out at 6 dimensions.
	static PRIMES = [1|0, 198491317|0, 6542989|0, 357239|0, 20201|0, 2909|0, 467|0];

	static __seed = null;
	static SetSeed(int) {
		// For caching.
		Noise.__seed = int|0;
	}

	static __noise(int, opt_seed) {
		var seed = (opt_seed !== undefined && opt_seed !== null && !isNaN(opt_seed)) ? opt_seed : Noise.__seed || 0;
		var r = int|0;
		// Good thing I don't give a shit about perf on this project!
		for (var i = 0; i < Noise.NOISE.length; i++) {
			r = (((i % 2) == 0) ? (r * Noise.NOISE[i]) : (r + Noise.NOISE[i]))|0;
			r = i == 0 ? (r + seed)|0 : r;
			r = r ^ (r >>> (((i * 2) % 24) + 9))|0;
		}
		return r; // Should be good enough.
	}

	static noise(parts, opt_seed) {
		var chunk = parts;
		if (Array.isArray(parts)) {
			var chunk = parts.merge(function(total, next, index) {
				return (total + ((next * Noise.PRIMES[index]|0)))|0;
			});
		}
		return Noise.__noise(chunk, opt_seed);
	}

	static SIGN_BIT = parseInt("10000000000000000000000000000000", 2);
	static BIG_VALUE = parseInt("01000000000000000000000000000000", 2) * 2;
	static ONE_OVER_MAX_INT = 1 / 4294967295;
	static float(parts, opt_seed) {
		var raw = Noise.noise(parts, opt_seed);
		if (raw < 0) {
			// Gotta do some dumb JS shit.
			raw = raw ^ Noise.SIGN_BIT;  // Remove sign bit as 32-bit int.
			raw += Noise.BIG_VALUE; // Add sign bit as 64 bit int.
		}
		return raw * Noise.ONE_OVER_MAX_INT;
	}


	static intInRange(parts, min, max, opt_seed) {
		return Math.floor((Noise.float(parts, opt_seed) * (max - min)) + min);
	}


	/** Overly simplistic human distribution test */
	static testSeed(seed, prefixParts) {
		var distributions = [
			[0.0, 0.1],
			[0.1, 0.2],
			[0.2, 0.3],
			[0.3, 0.4],
			[0.4, 0.5],
			[0.5, 0.6],
			[0.6, 0.7],
			[0.7, 0.8],
			[0.8, 0.9],
			[0.9, 1.0]];
		var buckets = distributions.map(function() { return 0; });

		// 10 million is hopefully enough.
		for (var i = 0; i < 10000000; i++) {
			var val;
			if (prefixParts) {
				val = Noise.float(prefixParts.clone().extend([i]), seed);
			} else {
				val = Noise.float(i, seed);
			}
			for (var j = 0; j < distributions.length; j++) {
				var range = distributions[j];
				if (val <= range[1] && val > range[0]) {
					buckets[j]++;
					break;
				}
			}
		}

		return buckets;
	}


	// Adapted from stackoverflow somewhere, totally not crypto-friendly, but
	// that's not the damn point. :D
	// This is used to generate the seed for a run.
	static stringHash(str) {
		var v1 = 0xdeadbeef;  // Yum!!
		var v2 = 0x41c6ce57;  // What does this taste like?
		for (var i = 0; i < str.length; i++) {
			v1 = Math.imul((v1 ^ str.charCodeAt(i)), 2654435761);
			v2 = Math.imul((v2 ^ str.charCodeAt(i)), 1597334677);
		}
		v1 = Math.imul(v1 ^ (v1 >>> 16), 2246822507) ^ Math.imul(v2 ^ (v2 >>> 13), 3266489909);
		v2 = Math.imul(v2 ^ (v2 >>> 16), 2246822507) ^ Math.imul(v1 ^ (v1 >>> 13), 3266489909);		
		return Noise.noise(v1, v2);
	}
}


/** Super barebones template inflation class. */
class Templates {
	
	static inflate(nameOrElt, opt_subMap) {
		// Empty map otherwise.
		var substitutions = opt_subMap || {};

		var elt = nameOrElt;
		if (!isElement(elt)) {		
			elt = qs(document, ".templates > template[name='" + elt + "']");
			if (!elt) throw boom("Unknown template: " + nameOrElt);
		}
		var clone = elt.cloneNode(true);
		var html = clone.innerHTML;
		var html2 = html;
		for (var [k, v] of Object.entries(substitutions)) {
			html2 = html.replace(new RegExp(k, 'g'), v);			
			if (html == html2) {
				Logger.warn("Unknown key in template: " + k);
			}
			html = html2;
		}
		clone.innerHTML = html;		
		var content = clone.content;
		if (content.nodeType == Node.ELEMENT_NODE) return content;
		if (content.firstElementChild == content.lastElementChild) {
			return content.firstElementChild;
		}
		return content;
	}
	
	static inflateIn(name, parentElt, opt_subMap) {
		var fragment = Templates.inflate(name, opt_subMap);
		parentElt.appendChild(fragment);
		return fragment;
	}
	
	static toElement(fragmentMaybe) {
		if (fragmentMaybe.nodeType == Node.DOCUMENT_FRAGMENT_NODE &&
				fragmentMaybe.firstElementChild == fragmentMaybe.lastElementChild) {
			return fragmentMaybe.firstElementChild;		
		}
		return fragmentMaybe;
	}
}

class Att {
	static int(elt, attr, opt_default) {
		var intValue = elt.getAttribute(attr);
		if (!intValue) return opt_default || null;
		return parseInt(intValue);		
	}
	
	static str(elt, attr, opt_default) {
		var strValue = elt.getAttribute(attr);
		if (!strValue) return opt_default || strValue;
		return strValue;
	}
	
	static bool(elt, attr, opt_default) {
		var strValue = elt.getAttribute(attr);
		return parseBoolean(strValue) || false;
	}
}


/** Basically a whole framework or something. */
class WoofRootController {

	/** Register our controllers here. */
	static _controllers = {};
	static register(...controllers) {
		controllers.forEach(function(controller) {
			WoofRootController._controllers[controller.name] = controller;
		});		
	}
	
	static _roots = new Map();
	static _listeners = [
		// Preloaded with our custom mutation event types.
		"AddChild", "RemoveChild", "Create", "MoveFrom", "MoveTo", "Destroy",
		"Attr"
	];
	
	static roots() {
		return Array.from(WoofRootController._roots.keys());
	}
	
	static controllers() {
		return { ...WoofRootController._controllers };
	}
	
	static controller(controllerText) {
		var split = controllerText.split(".");
		if (split.length != 2) {
			Logger.warn("Got a crappy handler: " + controllerText);
			return;
		}
		var controller = WoofRootController._controllers[split[0]];
		if (!controller) {
			Logger.warn("Found handler without controller", controllerText);
			return;
		}
		if (!controller[split[1]]) {
			Logger.warn("Found controller with missing method", controllerText);
			return;
		}
		
		return controller[split[1]];		
	}

	static addRoot(root, opt_windowEventsToRedirect) {
		if (WoofRootController._roots.has(root)) return;

		var observer = new MutationObserver(WoofRootController.onMutations);
		observer.observe(root, {
			attributes: true,
			childList: true,
			subtree: true,
			attributeOldValue: true
		});
		WoofRootController._roots.set(root, observer);
		
		// Attach event listeners to the new root.
		WoofRootController._listeners.forEach(function(listener) {
			root.addEventListener(listener, WoofRootController.onBubble);
			root.addEventListener(listener, WoofRootController.onCapture, true);
		});
		
		// Add any special overrides for window overrides.
		if (!opt_windowEventsToRedirect) return;
		opt_windowEventsToRedirect.forEach(function(type) {
			var win = root.ownerDocument.defaultView;
			win.addEventListener(type, WoofRootController.onWindowEventBubble.bind(undefined, root));
			win.addEventListener(type, WoofRootController.onWindowEventCapture.bind(undefined, root), true);
		});
	}
	
	static removeRoot(root) {
		if (!WoofRootController._roots.has(root)) return;
		
		var observer = WoofRootController._roots.get(root);
		observer.disconnect();
		
		WoofRootController._roots.delete(root);
	}
	
	static addListener(listener) {
		if (!Array.isArray(listener)) {
			listener = [listener];
		}

		for (var i = 0; i < listener.length; i++) {
			var actual = listener[i];
			// Push our new event, if relevant.
			if (WoofRootController._listeners.contains(actual)) return;
			WoofRootController._listeners.push(actual);

			// Attach listener to all existing roots.
			for (var key of WoofRootController._roots.keys()) {
				key.addEventListener(actual, WoofRootController.onBubble);
				key.addEventListener(actual, WoofRootController.onCapture, true);
			}
		}
	}
	
	static addListeners(...listeners) {
		listeners.forEach(listener => WoofRootController.addListener(listener));
	}
	
	static onMutations(mutations, observer) {
		// First thing we need to look for is whether these mutations encompass aLinkcolor
		// move (moving a node from A to B).
		// NOTE: Using an element as a key doesn't work!!
		var nodesRemoved = new Map();
		var nodesMoved = new Map();
		var nodesAdded = new Map();
		var attributeChanges = [];
		for (var i = 0; i < mutations.length; i++) {
			var mutation = mutations[i];
			for (var j = 0; j < mutation.removedNodes.length; j++) {
				var node = mutation.removedNodes[j];
				if (node.nodeType == Node.ELEMENT_NODE && !Att.bool(node, 'woof-ignore')) nodesRemoved.set(node, {from: mutation.target, child: node, _wtarget: node });
			}
			for (var j = 0; j < mutation.addedNodes.length; j++) {
				var node = mutation.addedNodes[j];				
				if (node.nodeType != Node.ELEMENT_NODE || Att.bool(node, 'woof-ignore')) continue;
				// If it's in nodesRemoved, it's now a move.
				// Otherwise, it's an add.
				if (nodesRemoved.has(node)) {
					nodesMoved.set(node, {
						from: nodesRemoved.get(node).from,
						to: mutation.target,
						child: node,
						_wtarget: node
					});
					nodesRemoved.delete(node);
				} else {
					nodesAdded.set(node, {to: mutation.target, child: node, _wtarget: node});
				}				
			}
			if (mutation.attributeName) {
				var node = mutation.target;
				attributeChanges.push({
					node: node,
					attribute: mutation.attributeName,
					oldValue: mutation.oldValue,
					newValue: node.getAttribute(mutation.attributeName) || null
				});
			}
		}
		
		// At this point, we've divided these into adds, removes, and moves.
		// Next up, we want to convert these into events and fire them from
		// appropriate targets:
		// - Removes will fire a Destroy on the original target, as well as
		//   a RemoveChild from the original parent.
		// - Moves will fire a MoveAway from the original target, as well as aLinkcolor
		//   MoveTo from the new parent.
		// - Adds will fire a Create on the original target, as well as an
		//   AddChild from the parent.
		for (var [key, value] of nodesRemoved.entries()) {
			// Simulate the destroy on the node itself.
			var path = WoofRootController.__buildParentPath(value.from);
			path.push(key);
			WoofRootController.invokeHandlersOnPath(WoofRootController.buildNativeEvent("Destroy", value, false), path, "wh-c");
			WoofRootController.dispatchNativeOn(key, "Destroy", value, false);
			path.reverse();
			WoofRootController.invokeHandlersOnPath(WoofRootController.buildNativeEvent("Destroy", value, false), path, "wh-b");
			
			// Dispatch on the parent.
			// Simulate on the parent.
			WoofRootController.dispatchNativeOn(value.from, "RemoveChild", value, false);
		}
		for (var [key, value] of nodesAdded.entries()) {
			WoofRootController.dispatchNativeOn(key, "Create", value);
			WoofRootController.dispatchNativeOn(value.to, "AddChild", value, false);
		}
		for (var [key, value] of nodesMoved.entries()) {
			WoofRootController.dispatchNativeOn(value.from, "MoveFrom", value, false);
			WoofRootController.dispatchNativeOn(value.to, "MoveTo", value, false);
		}		
		for (var attrChange of attributeChanges) {
			if (attrChange.oldValue !== attrChange.newValue) {
				WoofRootController.dispatchNativeOn(attrChange.node, "Attr", attrChange, false);
			}
		}
	}

	static __buildParentPath(elt) {
		var path = [];
		var doc = elt.ownerDocument;
		while (!!elt && elt != doc && !WoofRootController._roots.has(elt)) {
			path.unshift(elt); // Add to path.
			elt = elt.parentNode;
		}
		return path;
	}
	
	static buildNativeEvent(type, detail, cancelable) {
		return new CustomEvent(type, {
			detail: detail,
			bubbles: true,
			cancelable: cancelable			
		});
	}
	
	static dispatchNativeOn(target, type, detail, cancelable) {
		target.dispatchEvent(WoofRootController.buildNativeEvent(type, detail, cancelable));
	}
	
	
	static redispatchNativeOn(target, type, baseEvent) {
		if (baseEvent.target == target && baseEvent.type == type) return;
		target.dispatchEvent(new baseEvent.constructor(type, baseEvent));
	}
	
	static onCapture(evt) {
		// Generic event-handler!
		// Find our path from a root to the event target.
		// Reverse it, because we're capturing (out to in).
		var path = WoofRootController.findPathToRoot(evt).reverse();
		if (!path) {
			Logger.warn("Failed to find root for event!");
			return;
		}
		WoofRootController.invokeHandlersOnPath(evt, path, "wh-c", true);
	}
		
	static onBubble(evt) {
		// Find our path from a root to the event target.
		// Leave it unaltered, because we're bubbling (in to out).
		var path = WoofRootController.findPathToRoot(evt);
		if (!path) {
			Logger.warn("Failed to find root for event!");
			return;
		}
		WoofRootController.invokeHandlersOnPath(evt, path, "wh-b");
	}
	
	static onWindowEventCapture(redirectTo, evt) {
		WoofRootController._onWindowEvent(redirectTo, evt, "wh-c");
	}
	
	
	static onWindowEventBubble(redirectTo, evt) {
		WoofRootController._onWindowEvent(redirectTo, evt, "wh-b");
	}
	
	static _onWindowEvent(redirectTo, evt, attrKey) {
		var keysToMatch = ["." + evt.type, "Window." + evt.type];
		var handlers = WoofRootController.parseHandlerAttribute(redirectTo, attrKey);
		if (!handlers) return;
		for (var j = 0; j < handlers.length; j++) {
			// For each handler, check if it fits the event.
			var handler = handlers[j];

			for (var k = 0; k < handler.eventParts.length; k++) {
				if (keysToMatch.contains(handler.eventParts[k])) {
					WoofRootController.invokeHandler(evt, redirectTo, handler.handlerPart);					
				}							
			}					
		}
	}
	
	static findPathToRoot(evt) {
		var path = evt.composedPath();
		var idx = -1;
		for (var i = 0; i < path.length && idx < 0; i++) {
			// Find our root; that's where we start looking for our special properties.
			if (WoofRootController._roots.has(path[i])) idx = i;			
		}
		if (idx < 0) {
			Logger.warn("Couldn't find root in event!");
			return null;
		}
		
		return path.slice(0, idx + 1);				
	}
	
	static parseHandlerAttribute(elt, attribute) {
		var allHandlers = elt.getAttribute(attribute);
		if (!allHandlers) return null;
		return WoofRootController.parseHandlers(allHandlers);		
	}
	
	static invokeHandlersOnPath(evt, path, attribute) {
		var targets = WoofRootController.buildEventTargets(evt);
		var types = WoofRootController.buildEventTypes(evt);

		// if (keysToMatch.contains("CardSet.")) debugger;
		
		for (var i = 0; i < path.length; i++) {
			var candidate = path[i];
			targets.extend(WoofRootController.getEventTargetsFor(candidate));
		
			var handlers = WoofRootController.parseHandlerAttribute(candidate, attribute);			
			
			var keysToMatch = WoofRootController.expandEventKeys(types, targets);			
			if (!handlers) continue;
			for (var j = 0; j < handlers.length; j++) {
				// For each handler, check if it fits the event.
				var handler = handlers[j];
				for (var k = 0; k < handler.eventParts.length; k++) {
					if (keysToMatch.contains(handler.eventParts[k])) {
						WoofRootController.invokeHandler(evt, candidate, handler.handlerPart);					
					}				
				}				
			}
		}
		
	}
	
	static invokeHandler(evt, elt, handlerString) {
		// We expect the handler string to be in the form of:
		// - ControllerName.MethodToCall[|OtherController.OtherMethod] (invokes the method(s))
		// - :[eventType] (re-emits the event from this element, updates type)
		var handlers = handlerString.split("|");
		for (var handler of handlers) {
			if (handler.indexOf(":") > -1) {
				// Re-emission case
				var type = handler.substr(1) || evt.type;
				WoofRootController.redispatchNativeOn(elt, type, evt);			
			} else {			
				WoofRootController.invokeController(handler, [evt, elt]);
			}			
		}
	}
	
	static invokeController(controllerText, params) {
		return WoofRootController.controller(controllerText).apply(this, params);
	}
	
	static expandEventKeys(eventTypes, objectTypes) {
		var toReturn = [];
		for (var i = 0; i < eventTypes.length; i++) {
			for (var j = 0; j < objectTypes.length; j++) {
				toReturn.push(objectTypes[j] + "." + eventTypes[i]);
			}			
		}
		return [...(new Set(toReturn))];
	}	
	
	/** Returns the set of keys to find in a wh-x tag for a given event. */
	static buildEventTypes(evt) {
		var eventTypes = ["", evt.type];
		// Special case: We also want to include the attribute type here.
		if (evt.type == "Attr") {
			eventTypes.push("Attr:" + evt.detail.attribute.toLowerCase());
		}
		return eventTypes;
	}
	
	/** Returns the set of targets to expand. */
	static buildEventTargets(evt) {
		var targetElt = evt.target || (evt.detail && evt.detail._wtarget);
		var objectTypes = [""];
		if (targetElt) {
			var types = WoofRootController.getEventTargetsFor(targetElt);
			if (evt.type == "Destroy") {
				// Hack: Destroy events are removed from the DOM, so we need to get all types below
				// to ensure that we capture all destroys.
				types.extend(WoofRootController.getEventTargetsRecursiveFor(targetElt));
			}
	
			objectTypes.extend(types);		
			objectTypes.extend(objectTypes.map(type => "!" + type));
		}
		
		return objectTypes;
	}
	
		
	/** Returns the set of targets to expand. */
	static getEventTargetsFor(element) {
		return WoofType.get(element);
	}
	
	/** Find all types below. */
	static getEventTargetsRecursiveFor(element) {
		return WoofType.findAll(element).map(function(elt) {
			return WoofType.get(elt);
		}).flat();
	}
	
	static parseHandlers(handlers) {
		var candidates = handlers.split(',');
		return candidates.map(function(string) {
			// We expect a string in the form of:
			// Type.Event>Controller.Method
			// Note that there's a special case:
			// Type.Attr:attribute-name>Controller.Method
			string = string.trim();
			var parts = string.split(">");
			if (parts.length != 2) {
				Logger.warn("Error parsing handler", string);
				return null;
			}
			
			var eventParts = parts[0];
			var eventSignatures = eventParts.split("|");
			
			return {
				eventParts: eventSignatures,
				handlerPart: parts[1].trim()
			};
		}).filter(function(val) {
			return !!val;
		});		
	}
}

/** Braindead logger class. */
class Logger {			

	// Argument order: 
	static __log(level, ...args) {		
		window.console.log.apply(window.console.log, args);

		var controllers = WoofRootController.controllers();
		var loggers = Logger.__findLoggers();
		for (var i = 0; i < loggers.length; i++) {
			var logger = loggers[i];
			var handler = logger.getAttribute('wlogger');
			var levels = ParamList.get(logger, 'wlogger-allow');
			if (!handler) {
				window.console.log("No wlogger attribute!");
				continue;
			}
			if (levels.length == 0) {
				window.console.log("No levels configured on logger.");
				continue;
			}
			if (!levels.contains(level)) {
				// Suppress this message!
				continue;
			}
			var split = handler.split('.');
			if (split.length != 2) {
				window.console.log("Badly configured wlogger in", handler);
				continue;
			}
			if (!controllers[split[0]]) {
				window.console.log("Unknown controller:", split[0]);
				continue;
			}
			var controller = controllers[split[0]];
			if (!controller.hasOwnProperty(split[1]) ||
					typeof(controller[split[1]]) != 'function') {
				window.console.log("Unable to invoke", split[1], "on", split[0]);
				continue;					
			}
						
			controller[split[1]](logger, ...args);
		}
	}
	
	static __findLoggers() {
		var returnMe = [];
		var roots = WoofRootController.roots();
		for (var i = 0; i < roots.length; i++) {
			var root = roots[i];
			var selector = '[wlogger]';
			returnMe.push(...qsa(root, selector));			
		}
		
		return returnMe;
	}

	static log(...args) {
		Logger.__log("RAW", ...args);
	}
	
	static info(...args) {
		args.unshift("[INFO]");
		Logger.__log("INFO", ...args);
	}
	
	static warn(...args) {
		args.unshift("[WARN]");
		Logger.__log("WARN", ...args);
	}
	
	static err(...args) {
		args.unshift("[ERR]");
		Logger.__log("ERR", ...args);
	}
	
	static trace(...args) {
		args.unshift("[TRACE]");
		Logger.__log("TRACE", ...args);
	}
	
	static game(...args) {
		args.unshift("[GAME]");
		Logger.__log("GAME", ...args);
	}
}

class WoofType {
	static add(element, type) {
		return ParamList.add(element, 'wt', type);
	}
	
	static remove(element, type) {
		return ParamList.remove(element, 'wt', type);
	}
	
	static has(element, type) {
		return ParamList.has(element, 'wt', type);
	}
	
	static get(element) {
		return ParamList.get(element, 'wt');
	}
	
	static put(element, types) {
		return ParamList.put(element, 'wt', types);
	}
	
	static findUp(element, type) {
		while (!!element && element.ownerDocument != null) {
			if (WoofType.has(element, type)) return element;
			element = element.parentNode;
		}
		return null;
	}

	static find(element, type) {
		return Utils.find(element, "[wt~='" + type + "']");
	}

	static findDown(element, type, opt_strict) {
		var selector = WoofType.buildSelector(type);
		if (!opt_strict) {
			if (element.matches(selector)) return element;
		}
		return qs(element, selector);
	}

	static findAll(element, value) {
		return Array.from(WoofType.queryAll(element, value));
	}
	
	static queryAll(element, value) {
		return qsa(element, WoofType.buildSelector(value));
	}

	static buildSelector(type) {
		if (!Array.isArray(type)) {
			type = [type];
		}

		return type.map(function(t) {
			if (t === undefined) {
				return "[wt]";
			}
			return "[wt~='" + t + "']";
		}).join(", ")
	}

	static buildSelectorFrom(type, id) {
		return "[wt~='" + type + "'][w-id='" + id + "']";
	}

	static buildSelectorFor(element) {
		var id = IdAttr.generate(element);
		var types = WoofType.get(element);
		if (types.length == 0) {
			// Default to tagname here.
			return element.tagName + "[w-id='" + id + "']";
		}
		var type = types[0];
		var id = IdAttr.generate(element);
		return WoofType.buildSelectorFrom(type, id);
	}
}
WoofRootController.register(WoofType);

/** Used for objects used to store relative scores of things. */
class Counters {
	static Increment(object, key) {
		object[key] = (object[key] || 0) + 1;
	}

	static Decrement(object, key) {
		object[key] = (object[key] || 0) - 1;
	}

	static MaxKey(object) {
		var winner = null;
		for (var [key, value] of Object.entries(object)) {
			if (winner === null || object[winner] < value) winner = key;
		}
		return winner;
	}

	static MinKey(object) {
		var winner = null;
		for (var [key, value] of Object.entries(object)) {
			if (winner === null || object[winner] > kvalueey) winner = key;
		}
		return winner;
	}

}

class WeightedValue {
	/**
	 * Obj has a set of KV pairs, where the K is the thing and the V is the weight.
	 */
	static getValue(obj, float) {
		var total = 0;
		var kInOrder = [];
		for (var [k, v] of Object.entries(obj)) {
			total += v;
			kInOrder.push(k);
		};
		if (total == 0) return null; // No valid options.
		var selected = Math.floor(float * total);
		return kInOrder.findFirst(function(v) {
			if (selected < obj[v]) {
				return true;
			}
			selected -= obj[v];
			return false;
		});
	}
}

class ParamList {
	static add(element, param, type) {
		param = param.toLowerCase();
		var parsed = ParamList.get(element, param);
		if (parsed.indexOf(type) > -1) return;
		parsed.push(type);
		ParamList.put(element, param, parsed);
	}
	
	static remove(element, param, type, clear) {
		clear = !!clear;
		param = param.toLowerCase();
		var parsed = ParamList.get(element, param);
		var index = parsed.indexOf(type);
		if (index == -1) return;
		parsed.splice(index, 1);
		if (clear && parsed.length == 0) {
			ParamList.clear(element, param);
		} else {
			ParamList.put(element, param, parsed);		
		}
	}
	
	static has(element, param, type) {
		param = param.toLowerCase();
		var parsed = ParamList.get(element, param);
		return parsed.indexOf(type) > -1;
	}
	
	static get(element, param) {
		param = param.toLowerCase();
		var value = element.getAttribute(param);
		if (!value) return [];
		return value.split(' ').map(val => val.trim());
	}
	
	static clear(element, param) {
		param = param.toLowerCase();
		element.removeAttribute(param);
	}
	
	static put(element, param, types) {
		param = param.toLowerCase();
		element.setAttribute(param, types.join(' '));
	}
}

/** Dumping grounds for utility methods. */
class Utils {	

	static diffSpaceLists(old, newV) {
		var oldValue = [];
		if (old != null) {
			oldValue = old.split(' ');
		}
		var newValue = [];
		if (newV != null) {
			newValue = newV.split(' ');
		}
		return {
			added: newValue.filter(function(e) { return !oldValue.includes(e); }),
			removed: oldValue.filter(function(e) { return !newValue.includes(e); })
		};
	}

	static redispatch(event, handler) {
		// Redispatches an event on the current handler.
		if (event.target == handler) return;
		WoofRootController.dispatchNativeOn(handler, event.type, event.detail, event.cancelable);		
	}

	static constantValues(cls) {
		var returnMe = [];
		for (var key of Object.getOwnPropertyNames(cls)) {
			if (typeof(cls[key]) != 'function' &&
					key !== 'length' &&
					key !== 'prototype' &&
					key !== 'name') {
				returnMe.push(cls[key]);
			}
		}
		return returnMe;
	}

	static setFragment(fragment) {
		window.location = "#" + fragment;
	}
	
	static clearChildren(node) {
		while (node.firstChild) {
			node.removeChild(node.firstChild);
		}
	}
	
	static moveChildren(nodeFrom, nodeTo) {
		while (nodeFrom.firstChild) {
			nodeTo.appendChild(nodeFrom.firstChild);
		}
	}

	static copyChildren(nodeFrom, nodeTo) {
		for (var i = 0; i < nodeFrom.childElementCount; i++) {
			nodeTo.appendChild(nodeFrom.children[i].cloneNode(true));
		}
	}
	
	static appendAllChildren(arrayOfNodes, newParent) {
		for (var i = 0; i < arrayOfNodes.length; i++) {
			newParent.appendChild(arrayOfNodes[i]);
		}
	}
		
	static find(element, matcher) {
		if (element.matches(matcher)) return element;
		var found = qs(element, matcher);
		if (found) return found;
		found = matchParent(element, matcher);
		if (found) return found;		
		return qs(element.ownerDocument, matcher);		
	}
	
	static findUp(element, matcher) {
		return matchParent(element, matcher);
	}
	
	static bfind(element, upMatcher, downMatcher) {
		if (!element) element = document.body;
		var up = Utils.findUp(element, upMatcher);
		if (!up) {
			var ups = qsa(element, upMatcher);
			if (ups.length == 1) {
				up = ups[0];
			}
		}
		if (!up) return null;
		return qs(up, downMatcher);
	}
	
	static bfindAll(element, upMatcher, downMatcher) {
		var up = Utils.findUp(element, upMatcher);
		if (!up) {
			var ups = qsa(element, upMatcher);
			if (ups.length == 1) {
				up = ups[0];
			}
		}
		if (!up) return null;
		return qsa(up, downMatcher);
	}
		
	static UUID() {
		return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
			(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
		);
	}
	
	static tag(elt) {
		return elt.tagName.toLowerCase();
	}

	static deserializeBlob(relativeTo, blob) {
		var parsed = JSON.parse(blob);
		return Utils.denormalizeBlob(relativeTo, parsed);
	}

	static denormalizeBlob(elt, params) {
		var deserializeFn = function(obj) {
			Object.keys(obj).forEach(function(key) {
				if (obj[key] !== null && obj[key]["____"] && obj[key].element) {
					var value = Utils.bfind(elt, 'body', obj[key].element);
					if (!value && obj[key]["fallback"]) {
						value = obj[key]["fallback"] || null;
					}
					obj[key] = value;
				} else if (typeof obj[key] === 'object' && obj[key] !== null) {
					deserializeFn(obj[key]);
				}
			});
		};
		deserializeFn(params);

		return params;
	}

	static normalizeBlob(elt, params) {
		params = GameEffect.__simpleClone(params);
		var serializeFn = function(obj) {
			Object.keys(obj).forEach(function(key) {
				var value = obj[key];
				if (value instanceof HTMLElement) {
					var types = WoofType.get(value);
					var baseObj = {
						____: true,
						element: WoofType.buildSelectorFor(value)
					};
					var serialized = false;
					var fallbackBlob = {
						____types: []
					};
					types.forEach(function(t) {
						if (!Utils.serializers[t]) return;
						var s = Utils.serializers[t].fallback(fallbackBlob, value);
						if (s) {
							serialized = true;
							fallbackBlob.____types.push(t);
						}
					});
					if (serialized) {
						baseObj.fallback = fallbackBlob
					}
					obj[key] = baseObj;
				} else if (typeof obj[key] === 'object' && obj[key] !== null) {
					serializeFn(obj[key]);
				}
			});	
		}
		serializeFn(params);
		return params;
	}

	static serializeBlob(elt, params) {
		var normalized = Utils.normalizeBlob(elt, params);
		return JSON.stringify(normalized);
	}

	static serializers = {};
	static registerBlobSerializer(type, fallback) {
     	Utils.serializers[type] = {
			fallback: fallback,
			t: type	
		};
	}
	
	static classMixin(intoThis, mixThis, opt_config) {
		for (var key of Object.getOwnPropertyNames(mixThis)) {
			if (typeof(mixThis[key]) != 'function') continue;
			if (!intoThis[key]) {
				if (opt_config) {
					intoThis[key] = mixThis[key].bind(null, opt_config);
				} else {
					intoThis[key] = mixThis[key].bind(null);					
				}
			}
		}
	}
}
WoofRootController.register(Utils);


/**
 * Note this is expecting 2 layers of inheritence: first with a config, second with a key.
 **/
class BaseAttr {
	static key(config, key) {
		return key;
	}

	static get(config, key, element) {
		return config.d(element.getAttribute(key));
	}

	static set(config, key, element, value) {
		if (value === undefined) {
			element.removeAttribute(key);
			return;
		}
		var updatedValue = config.s(value);
		if (updatedValue === undefined) {
			element.removeAttribute(key);
			return;
		}
		element.setAttribute(key, updatedValue);
	}

	static has(config, key, element) {
		return element.hasAttribute(key);
	}

	static selector(config, key, value) {
		if (value === undefined) {
			return '[' + key + ']';
		}
		var newVal = config.serializeForSelector(value);
		if (newVal === undefined) {
			return '[' + key + ']';
		}
		// This is to allow = vs ~=
		return '[' + key + config.selectorOperand + newVal + ']';
	}

	static copy(config, key, to, from) {
		BaseAttr.set(config, key, to, BaseAttr.get(config, key, from));
	}

	static find(config, key, element, value) {
		var selector = BaseAttr.selector(config, key, value);
		if (element.matches(selector)) return element;
		return qs(element, selector);
	}

	static findGet(config, key, element) {
		var elt = BaseAttr.find(config, key, element);
		if (!elt) return null;
		return BaseAttr.get(config, key, element);
	}

	static findDown(config, key, element, value) {
		var selector = BaseAttr.selector(config, key, value);
		return qs(element, selector);
	}

	static findUp(config, key, element, value) {
		var selector = BaseAttr.selector(config, key, value);
		return matchParent(element, selector);
	}

	static findAllDown(config, key, element, value) {
		var selector = BaseAttr.selector(config, key, value);
		return qsa(element, selector);
	}

	static findAll(config, key, element, value) {
		var selector = BaseAttr.selector(config, key, value);
		var returnMe = element.matches(selector) ? [element] : [];
		returnMe.extend(qsa(element, selector));
		return returnMe;
	}

	static findSetAll(config, key, element, value) {
		BaseAttr.findAll(config, key, element).forEach(function(found) {
			BaseAttr.set(config, key, found, value);
		});
	}
	
	static findSetAllDown(config, key, element, value) {
		BaseAttr.findAllDown(config, key, element).forEach(function(found) {
			BaseAttr.set(config, key, found, value);
		});
	}

	static matches(config, key, el1, el2) {
		return BaseAttr.get(config, key, el1) === BaseAttr.get(config, key, el2);
	}
}

class BoolAttr {
	static key(config) {
		return config;
	}
	
	static toggle(config, element) {
		return BoolAttr.set(config, element, !BoolAttr.get(config, element));
	}
	
	static get(config, element) {
		return parseBoolean(element.getAttribute(config)) || false;
	}
	
	static set(config, element, value, opt_clear) {
		if (value === undefined || value === null || (!value && !!opt_clear)) {
			element.removeAttribute(config);
		} else {
			element.setAttribute(config, value);
		}		
	}

	static has(config, element) {
		return element.hasAttribute(config);
	}

	static true(config, element) {
		BoolAttr.set(config, element, true);
	}

	static false(config, element) {
		BoolAttr.set(config, element, false);
	}

	static findGet(config, element) {
		var toFind = BoolAttr.find(config, element);
		if (!toFind) return null;
		return BoolAttr.get(config, toFind);
	}
	
	static find(config, element, value) {
		var selector = BoolAttr.buildSelector(config, value);
		if (element.matches(selector)) return element;
		return qs(element, selector);
	}
	
	static findAll(config, element, value) {
		return qsa(element, '[' + config +'=' + value + ']');		
	}

	static copy(config, to, from) {
		var value = BoolAttr.get(config, from);
		BoolAttr.set(config, to, value);
	}

	static buildSelector(config, value) {
		if (value === null || value === undefined) {
			return '[' + config + ']';
		}
		return '[' + config + '="' + value + '"]';
	}
}


class IntAttr {
	static has(config, elt) {
		return elt.hasAttribute(config);
	}

	static key(config) {
		return config;
	}

	static findGet(config, element) {
		var elt = IntAttr.find(config, element);
		if (!elt) return null;
		return IntAttr.get(config, elt);
	}

	static findSetAll(config, element, value) {
		var all = Array.from(IntAttr.findAll(config, element));
		if (element.matches(IntAttr.selector(config))) {
			all.push(element);
		}
		all.forEach(function(elt) {
			IntAttr.set(config, elt, value);
		});
	}

	static findUp(config, element) {
		return matchParent(element, IntAttr.selector(config));
	}

	static findUpGet(config, element, defaultValue) {
		var found = IntAttr.findUp(config, element);
		if (!found) return defaultValue || null;
		var result = IntAttr.get(config, found);
		if (result == null) return defaultValue || null;;
		return result;
	}

	static get(config, element) {
		return parseInt(element.getAttribute(config));
	}
	
	static set(config, element, value) {
		if (value === undefined || value === null) {
			element.removeAttribute(config);
			return;
		}
		element.setAttribute(config, value);
	}
	
	static find(config, element, value) {
		var selector = IntAttr.selector(config, value);
		if (element.matches(selector)) return element;
		return qs(element, selector);
	}

	static findDown(config, element, value) {
		var selector = IntAttr.selector(config, value);
		return qs(element, selector);
	}
	
	static findAll(config, element, value) {
		if (value !== undefined) {
			return qsa(element, '[' + config +'="' + value + '"]');		
		} else {
			return qsa(element, '[' + config + ']');
		}
	}

	static selector(config, value) {
		if (value === undefined) {
			return '[' + config + ']';
		}
		return '[' + config +'="' + value + '"]';
	}

	static copy(config, to, from) {
		var value = IntAttr.get(config, from);
		IntAttr.set(config, to, value);
	}
}

class StringAttr {
	static key(config) {
		return config;
	}

	static matches(config, elt1, elt2) {
		return StringAttr.get(config, elt1) === StringAttr.get(config, elt2);
	}

	static get(config, element) {
		return element.getAttribute(config);
	}
	
	static set(config, element, value) {
		if (value === null || value === undefined) {
			element.removeAttribute(config);
		} else {
			element.setAttribute(config, value);
		}		
	}

	static findGetCopySetAll(config, from, to) {
		var value = StringAttr.findGet(config, from);
		StringAttr.findSetAll(config, to, value);
	}

	static findSetAll(config, element, value) {
		var selector = StringAttr.buildSelector(config);
		if (element.matches(selector)) {
			StringAttr.set(config, element, value);
		}
		StringAttr.findAll(config, element).forEach(function(elt) {
			StringAttr.set(config, elt, value);
		});
	}

	static findGet(config, element) {
		var elt = StringAttr.findDown(config, element);
		return !!elt ? StringAttr.get(config, elt) : null;
	}

	static findDown(config, element, value) {
		var matcher = (value === undefined) ? '[' + config + ']' : '[' + config + '="' + value + '"]';
		if (element.matches(matcher)) {
			return element;
		}
		return qs(element, matcher);
	}
	
	static find(config, element, value) {
		if (value === undefined) {
			return Utils.find(element, '[' + config + ']');
		}
		return Utils.find(element, '[' + config + '="' + value + '"]');
	}
	
	static findAll(config, element, value) {
		if (value === undefined) {
			return qsa(element, '[' + config + ']');
		}
		return qsa(element, '[' + config + '="' + value + '"]');
	}

	static findUp(config, element, opt_value) {
		return Utils.findUp(element, StringAttr.buildSelector(config, opt_value));
	}
	
	static buildSelector(config, value) {
		if (value === undefined) {
			return '[' + config + ']';
		}
		return '[' + config + '="' + value + '"]';
	}

	static copy(config, to, from) {
		var value = StringAttr.get(config, from);
		StringAttr.set(config, to, value);
	}
	
	static append(config, element, value) {
		var og = StringAttr.get(config, element) || "";
		StringAttr.set(config, element, og + value);
	}

	static has(config, element) {
		var gotten = StringAttr.get(config, element);
		return gotten !== undefined && gotten !== null;
	}
}

class FunctionAttr {
	static key(config) {
		return config;
	}

	static bind(config, elt) {
		return function(...args) {
			return FunctionAttr.aInvoke(config, elt, args);
		};
	}

	static _invoke(config, elt, args) {
		var fnName = FunctionAttr.get(config, elt);
		return WoofRootController.invokeController(fnName, args);
	}


	static invoke(...args) {
		var config = args[0];
		var elt = args[1];
		var args = args.slice(2);

		return FunctionAttr._invoke(config, elt, args);
	}

	static aInvoke(config, elt, args) {
		return FunctionAttr._invoke(config, elt, args);
	}

	static findInvoke(...args) {
		var config = args[0];
		var elt = args[1];
		var args = args.slice(2);

		var realElt = FunctionAttr.findDown(config, elt);
		return FunctionAttr._invoke(config, realElt, args);	
	}

	static findAInvoke(config, elt, args) {
		var realElt = FunctionAttr.findDown(config, elt);
		return FunctionAttr.aInvoke(config, realElt, args);
	}

}
Utils.classMixin(FunctionAttr, StringAttr);

class IdAttr {
	static generateAll(elts) {
		elts.forEach(elt => IdAttr.generate(elt));
	}

	static eraseRecursive(elt) {
		IdAttr.set(elt);
		qsa(elt, IdAttr.buildSelector()).forEach(IdAttr.set);
	}
	
	static generate(elt) {
		var current = IdAttr.get(elt);
		if (current) return current;
		var id = Utils.UUID();
		IdAttr.set(elt, id);
		return id;
	}
		
	static buildSelector(value) {
		if (value === undefined) {
			return '[w-id]';
		}
		return '[w-id="' + value + '"]';
	}
}
Utils.classMixin(IdAttr, StringAttr, "w-id");


class ListAttr {
	static key(config) {
		return config;
	}

	static find(param, element, value) {
		var selector = ListAttr.buildSelector(param, value);
		if (element.matches(selector)) return element;
		return qs(element, selector);
	}

	static findGet(param, element, value) {
		var found = ListAttr.find(param, element, value);
		if (!found) return null;
		return ListAttr.get(param, found);
	}

	static findAll(param, element, value) {
		if (value === undefined) {
			return qsa(element, '[' + param + ']');
		}
		return qsa(element, '[' + param + '~="' + value + '"]');
	}

	static add(param, element, type) {
		return ParamList.add(element, param, type);
	}
	
	static remove(param, element, type, clear) {
		return ParamList.remove(element, param, type, clear);
	}
	
	static has(param, element, type) {
		if (type === undefined) {
			var thing = ListAttr.get(param, element);
			return thing !== undefined && thing !== null;
		}

		return ParamList.has(element, param, type);
	}
	
	static get(param, element) {
		return ParamList.get(element, param);
	}
	
	static clear(param, element) {
		return ParamList.clear(element, param);
	}
	
	static put(param, element, types) {
		return ParamList.put(element, param, types);
	}

	static set(param, element, types) {
		return ListAttr.put(param, element, types);
	}
	
	static size(param, element) {
		return ParamList.get(element, param).length;
	}

	static copy(param, to, from) {
		ParamList.put(to, param, ParamList.get(from, param));
	}

	static buildSelector(param, value) {
		if (value === undefined) {
			return "[" + param + "]";
		}
		return "[" + param + "~='" + value + "']";
	}
}



class BlobAttr {

}
Utils.classMixin(BlobAttr, BaseAttr, {
	d: Utils.deserializeBlob.bind(this, document),
	s: Utils.serializeBlob.bind(this, document),
	serializeForSelector: function() {} // No can do
});


/** Create attributes as instances on classes so they're scoped locally instead of globally. */
class ScopedAttr {
	constructor(tag, baseClass) {
		Utils.classMixin(this, baseClass, tag);
	}
}


/** Helper class for juggling <def> elements. */
class DefHelper {
	static Name = new ScopedAttr('name', StringAttr);
	static Value = new ScopedAttr('value', StringAttr);
	static Fn = new ScopedAttr('fn', FunctionAttr);
	static Params = new ScopedAttr('params', ListAttr);

	static processAll(defElts, defBlob, ...prefixParams) {
		return defElts.map(function(defElt) {
			return DefHelper.process(defElt, defBlob, ...prefixParams);
		}).merge(function(blob, next) {
			return Object.assign(blob, next);
		});
	}

	static _normalizeString(valueAsStr) {
		var valueAsBool = parseBoolean(valueAsStr);
		if (valueAsBool !== null) return valueAsBool;
		var valueAsInt = parseInt(valueAsStr);
		if (!isNaN(valueAsInt)) return valueAsInt;
		var valueAsFloat = parseFloat(valueAsStr);
		if (!isNaN(valueAsFloat)) return valueAsFloat;
		if (valueAsStr === 'null') return null;
		return valueAsStr;
	}

	static process(defElt, defBlob, ...prefixParams) {
		var name = DefHelper.Name.get(defElt);
		var value = null;
		// Branch: Do we have a value or a function?
		if (DefHelper.Value.has(defElt)) {
			value = DefHelper._normalizeString(DefHelper.Value.get(defElt) || "");
		} else if (DefHelper.Fn.has(defElt)) {
			var params = (DefHelper.Params.get(defElt) || []).map(function(key) {
				return defBlob[key];
			});
			var actualParams = a(prefixParams).clone().extend(params);
			actualParams.unshift(defElt); // Always first!
			value = DefHelper.Fn.aInvoke(defElt, actualParams);
		}
		defBlob[name] = value;
		var toReturn = {};
		toReturn[name] = value;
		return toReturn;
	}

	static invoke(toInvoke, attr, defBlob, ...prefixParams) {
		var params = (DefHelper.Params.get(toInvoke) || []).map(function(key) {
			return defBlob[key];
		});
		var actualParams = a(prefixParams).clone().extend(params);
		actualParams.unshift(toInvoke); // Always first!
		return attr.aInvoke(toInvoke, actualParams);
	}

	static Flag = new ScopedAttr("flag", ListAttr);
	static FilterFn = new ScopedAttr("filter-fn", FunctionAttr);
	static filterFor(defs) {
		return function(elt) {
			if (DefHelper.Flag.has(elt)) {
				if (DefHelper.Flag.get(elt).findFirst(function(flag) {
					return defs[flag] !== true;
				})) return false;
			}
			if (DefHelper.FilterFn.has(elt)) {
				return DefHelper.invoke(elt, DefHelper.FilterFn, defs);
			}
			return true;
		};
	}
}


/**
 * Given a DOM element, processes each element like a line of code in a script using
 * a set of passed-in string-matcher commands.  If a matcher returns something, that becomes
 * the next command to run.
 */
class DomScript {
	static execute(rootElt, commands) {
		// Bail out if empty!
		if (rootElt.childElementCount == 0) return;

		var toExecute = [rootElt.firstElementChild];
		while (toExecute.length > 0) {
			var current = toExecute.shift();
			if (current.nextElementSibling) {
				toExecute.push(current.nextElementSibling);
			}
			for (var [key, value] of Object.entries(commands)) {
				if (current.matches(key)) {
					var newCmd = value(current);
					if (newCmd) {
						toExecute.unshift(newCmd);
					}
				}
			}
		}
	}
}


/** Used to track noise input parts. */
class NoiseCounters {
	static Name = new ScopedAttr('name', StringAttr);
	static Value = new ScopedAttr('value', IntAttr);
	static findCounters(...names) {
		var root = bf(document, 'noise-counters');
		return names.map(function(name) {
			var elt = NoiseCounters.Name.findDown(root, name);
			if (!elt) {
				elt = Templates.inflateIn('noise_counter', root, {
					NAME: name,
					VALUE: 0
				});
			}
			return NoiseCounters.Value.findGet(elt);
		});
	}

	static setCounter(name, value) {
		var root = bf(document, 'noise-counters');
		var elt = NoiseCounters.Name.findDown(root, name);
		if (!elt) {
			elt = Templates.inflateIn('noise_counter', root, {
				NAME: name,
				VALUE: value
			});
		} else {
			NoiseCounters.Value.set(elt, value);
		}
	}

	static getIncLast(...names) {
		var toReturn = NoiseCounters.findCounters.apply(this, names);
		NoiseCounters.setCounter(names[names.length - 1], toReturn[toReturn.length - 1] + 1);
		return toReturn;
	}

	static getImplicit(value, ...names) {
		return NoiseCounters.findCounters.apply(this, names).extend([value]);
	}

	static get(name) {
		return NoiseCounters.findCounters(name)[0];
	}

	static inc(name) {
		var value = NoiseCounters.get(name);
		NoiseCounters.setCounter(name, value + 1);
	}
}

class SRNG {
	constructor(seed, implicitFirst, ...names) {
		// First one is always the seed.
		this.seedName = seed;
		this.implicitFirst = implicitFirst;
		this.names = names;
		this.needsRefresh = true;
	}

	invalidate() {
		this.needsRefresh = true;
	}

	__refresh() {
		if (!this.needsRefresh) return;
		this.seed = NoiseCounters.get(this.seedName);
		this.values = this.names.map(function(name) {
			return NoiseCounters.get(name);
		});
		if (this.implicitFirst) this.values.unshift(0);
		this.needsRefresh = false;
	}

	__tick() {
		this.values[0]++;
		if (!this.implicitFirst) {
			NoiseCounters.set(this.names[0], this.values[0]);
		}
	}

	next() {
		this.__refresh();

		var toReturn = Noise.float(this.values, this.seed);
		this.__tick();
		return toReturn;
	}

	nextInRange(min, max) {
		this.__refresh();

		var toReturn = Noise.intInRange(this.values, min, max, this.seed);
		this.__tick();
		return toReturn;

	}

	nextIdx(forArr) {
		this.__refresh();

		var toReturn = Noise.intInRange(this.values, 0, forArr.length, this.seed);
		this.__tick();
		return toReturn;
	}

	randomValue(forArr, optWeights) {
		if (optWeights) {
			var idx = WeightedValue.getValue(optWeights, this.next());
			if (idx === null) return null;
			return forArr[idx];
		} else {
			return forArr[this.nextIdx(forArr)];
		}
	}

	randomValueR(forArr, optWeights) {
		if (optWeights) {
			var idx = WeightedValue.getValue(optWeights, this.next());
			if (idx === null) return null;
			return forArr.splice(idx, 1)[0];
		} else {
			return forArr.splice(this.nextIdx(forArr), 1)[0];
		}
	}

	shuffle(forArr) {
		var current = forArr.length;
		var temp;
		var rando;
	  
		while (0 != current) {
	
			// Pick a remaining element...
			rando = this.nextInRange(0, current);
			current -= 1;
	
			// And swap it with the current element.
			temp = forArr[current];
			forArr[current] = forArr[rando];
			forArr[rando] = temp;	
		}
	}
}

/** A RNG factory that also registers for auto-invalidation. */
class ASRNG {
    static __rngs = {};

    static newRng(seed, implicitFirst, ...names) {
        var rng = new SRNG(seed, implicitFirst, ...names);

        names.forEach(function(name) {
            if (!ASRNG.__rngs[name]) {
                ASRNG.__rngs[name] = [];
            }
            ASRNG.__rngs[name].push(rng);
        });

        return rng;
    }

    static Counter = new ScopedAttr("counter", StringAttr);
    static __invalidateHandler(effect, handler) {
        var counter = ASRNG.Counter.get(handler);
        if (!counter) return;
        if (!ASRNG.__rngs[counter]) return;
        ASRNG.__rngs[counter].forEach(function(srng) {
            srng.invalidate();
        });
    }
}
WoofRootController.register(ASRNG);

class AbstractDomController {
	static Tag = new ScopedAttr('tag', StringAttr);

	static tag(config, elt, tag) {
		var thing = AbstractDomController.find(config, elt);
		AbstractDomController.Tag.set(thing, tag);
	}

	static findByTag(config, elt, tag, upMatcher) {
		return Utils.bfind(elt, upMatcher || config.upStop || 'body', config.matcher + AbstractDomController.Tag.buildSelector(tag));
	}

	static bfind(config, elt, matcher) {
		return Utils.bfind(elt, matcher || config.upStop || 'body', config.matcher);
	}

	static bfindAll(config, elt, matcher) {
		return Utils.bfindAll(elt, matcher || config.upStop || 'body', config.matcher);
	}

	static bfindAllInner(config, elt, matcher) {
		return bfa(elt, matcher, config.matcher);
	}

	static bfindInner(config, elt, matcher) {
		return bf(elt, matcher, config.matcher);
	}

	static find(config, elt){
		return Utils.find(elt, config.matcher);
	}

	static findDown(config, elt) {
		return qs(elt, config.matcher);
	}
	
	static findAll(config, elt) {
		return qsa(elt, config.matcher);
	}
	
	static findUp(config, elt) {
		return matchParent(elt, config.matcher);
	}

    static inflate(config, ...args) {
        return AbstractDomController.__inflate(config, args);
    }

    static __inflate(config, args) {
        if (!config.template) {
            Logger.err("Unable to inflate template");
            return;
        }
		var params = !!config.params ? config.params.apply(null, args) : {};
        var elts = Templates.inflate(config.template, params);
        if (!!config.decorate) {
            var args2 = Array.from(args);
            args2.unshift(elts);
            config.decorate.apply(null, args2);
        }

        return elts;
    }

    static inflateIn(config, parentElt, ...args) {
        var fragment = AbstractDomController.__inflate(config, args)
        parentElt.appendChild(fragment);
        return fragment;
    }

    static normalize(config, thing) {
        if (thing instanceof Element) {
            return AbstractDomController.findUp(config, thing);
        }
        if (!config.normalize) {
            Logger.err("Unable to normalize");
            return undefined;
        }
        var params = Array.from(arguments);
        params.shift();
        return config.normalize.apply(null, params);
    }
}

class PendingOpAttr {
	static ForEffect = new ScopedAttr("for-effect", StringAttr);
	static EffectTicket = new ScopedAttr("effect-ticket", StringAttr);
	static takeTicket(element, opt_context) {
		var id = (opt_context || "").replaceAll(" ", "_") + Utils.UUID();
		PendingOpAttr.add(element, id);
		return id;
	}
	
	static returnTicket(element, id) {
		PendingOpAttr.remove(element, id);
	}

	static storeTicketOn(element, effect, opt_context) {
		var ticket = PendingOpAttr.takeTicket(effect, opt_context);
		PendingOpAttr.ForEffect.set(element, WoofType.buildSelectorFor(effect));
		PendingOpAttr.EffectTicket.set(element, ticket);
	}


	static returnTicketOn(element) {
		var effectSelector = PendingOpAttr.ForEffect.get(element);
		var ticket = PendingOpAttr.EffectTicket.get(element);
		if (!effectSelector || !ticket) {
			if (bestEffort) return;
			throw boom("Unexpected missing ticket.");
		} 
		var effect = Utils.bfind(element, 'body', effectSelector);
		PendingOpAttr.returnTicket(effect, ticket);
		PendingOpAttr.ForEffect.set(element);
		PendingOpAttr.EffectTicket.set(element);
	}

	static getPendingEffect(element) {
		var effect = PendingOpAttr.ForEffect.get(element);
		if (!effect) return null;
		return Utils.bfind(element, 'body', effect);
	}
}
Utils.classMixin(PendingOpAttr, ListAttr, "pending-operation");

class Blueprint {
	// Basically, what we do is:
	// - Look for an element with tagname == "type".
	// - Look if it has a [bp] attr.
	// - If it does, bfind for <type-bp name=[value of bp]>
	// - Otherwise return element.
	static Bp = new ScopedAttr("bp", StringAttr);
	static find(element, ...types) {
		return Blueprint.findAll(element, ...types)[0] || null;
	}

	static resolve(ref) {
		if (Blueprint.Bp.has(ref)) {
			var bpName = Blueprint.Bp.get(ref);
			return Utils.bfind(ref, 'body', ref.tagName.toLowerCase() + '-blueprint[name="' + bpName + '"]');
		}
		return ref;
	}

	static findAll(element, ...types) {
		return types.map(function(type) {
			return qsa(element, type).map(function(candidate) {
				return Blueprint.resolve(candidate);
			});			
		}).flat();
	}
	
	/** this is a destructive operation on the DOM, so make sure you're working from a copy. */
	static normalizeAll(relativeTo, element, ...types) {
		types.forEach(function(type) {
			qsa(element, type).forEach(function(candidate) {
				if (Blueprint.Bp.has(candidate)) {
					// Okay, this is where it gets screwy.  We want to basically replace this inline.
					var bpName = Blueprint.Bp.get(candidate);
					var bp = Utils.bfind(relativeTo, 'body', type + '-blueprint[name="' + bpName + '"]');
					if (!bp) return; // Skip this one if there's no blueprint.
	
					Blueprint.Bp.set(candidate); // Remove the BP ref so it can't be double-normalized.
					bp = bp.cloneNode(true); // Make a copy and never look at the original again.
					Utils.moveChildren(bp, candidate);  // Copy children over.  Existing children will be in front, which in theory will be an override.
	
					// Copy over attributes.
					for (var i = 0; i < bp.attributes.length; i++) {
						var attribute = bp.attributes[i];
						if (attribute.specified) {
							candidate.setAttribute(attribute.name, attribute.value);
						}
					}
				}
			});	
		});
	}
}
