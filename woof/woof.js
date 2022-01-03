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
	while (newArr.length > 0) {
		this.push(newArr.shift());
	}
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

NodeList.prototype["map"] = Array.prototype["map"];

HTMLCollection.prototype["indexOf"] = Array.prototype["indexOf"];

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
	return thingToBool == 'true';
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


/** Java stream equivalent. */
class Stream {
	constructor() {
		this.processors = [];
	}

	/** Converters */
	filter(predicate) {
		this.processors.push(function(array, index) {
			if (predicate(array[index])) return 1;
			array.splice(index, 1);
			return 0;
		});
		return this;
	}
	
	map(mapFn) {
		this.processors.push(function(array, index) {
			array[index] = mapFn(array[index]);
			return 1;
		});
		return this;		
	}
		
	expand(expandFn) {
		this.processors.push(function(array, index) {
			var results = expandFn(value);
			array.splice(index, 1, results);
			return results.length;
		});
		return this;
	}

	/** Finalizers. */
	toArray(input) {
		input = Array.from(input);
		
		for (var i = 0; i < this.processors.length; i++) {
			var processor = this.processors[i];
			for (var j = 0; j < input.length;) {
				j += this.processors[i](input, j);							
			}			
		}
		
		return input;
	}
	
	toObject(input, toKey) {
		return arrayToObject(this.toArray(input), toKey);		
	}

    forEach(input, fn) {
        this.processors.push(function(array, index) {
            fn(array[index]);
            return 1;
        });

        input = Array.from(input);

        for (var i = 0; i < this.processors.length; i++) {
            var processor = this.processors[i];
            for (var j = 0; j < input.length;) {
                j += this.processors[i](input, j);
            }
        }
    }
}

class PriorityQueue {
	constructor(scoreFn) {
		this.elements_ = [];
		this.scoreFn_ = scoreFn;
	}
	
	length() {
		return this.elements_.length;
	}
	
	insert(element) {
		var left = 0;
		var right = this.elements_.length - 1;
		var eltScore = this.scoreFn_(element);
		
		while (true) {
			if (left > right) {
				this.elements_.splice(0, 0, element);
				return;
			}
			if (left == right) {
				if (eltScore > this.scoreFn_(this.elements_[left])) {
					this.elements_.splice(left + 1, 0, element);					
				} else {
					this.elements_.splice(left, 0, element);					
				}
				return;
			}
			var middle = Math.floor((left + right) / 2);
			var midScore = this.scoreFn_(this.elements_[middle]);
			if (midScore > eltScore) {
				if (right == middle) {
					right = middle + 1;
				} else right = middle;				
			} else if (midScore < eltScore) {
				if (left == middle) {
					left = middle + 1;
				} else left = middle;
			} else {
				// Equal priority, good enough.
				this.elements_.splice(middle, 0, element);
				return;
			}			
		}
	}
	
	peekLowest(element) {
		return this.elements_[0];
	}
	
	peekHighest(element) {
		return this.elements_[this.elements_.length - 1];
	}
	
	popLowest(element) {
		return this.elements_.shift();
	}
	
	popHighest(element) {
		return this.elements_.pop();
	}	
}

/** Super barebones template inflation class. */
class Templates {
	
	static inflate(name, opt_subMap) {
		// Empty map otherwise.
		var substitutions = opt_subMap || {};
		
		var elt = document.querySelector(".templates > template[name='" + name + "']");
		if (!elt) throw boom("Unknown template: " + name);
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
		return parseBoolean(strValue);
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
			WoofRootController.invokeHandlersOnPath(WoofRootController.buildNativeEvent("Destroy", value, false), [key], "wh-c");
			WoofRootController.dispatchNativeOn(value.from, "Destroy", value, false);
			WoofRootController.invokeHandlersOnPath(WoofRootController.buildNativeEvent("Destroy", value, false), [key], "wh-b");
			
			// Dispatch on the parent.
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
			objectTypes.extend(types);		
			objectTypes.extend(objectTypes.map(type => "!" + type));
		}
		
		return objectTypes;
	}
	
		
	/** Returns the set of targets to expand. */
	static getEventTargetsFor(element) {
		return WoofType.get(element);
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
			var results = root.querySelectorAll ? root.querySelectorAll(selector) :
					(root.document ? root.document.querySelectorAll(selector) : []);
			if (results) returnMe.push(...results);
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
		while (element.ownerDocument != null) {
			if (WoofType.has(element, type)) return element;
			element = element.parentNode;
		}
		return null;
	}

	static find(element, type) {
		return Utils.find(element, "[wt~='" + type + "']");
	}
	
	static queryAll(element, value) {
		return element.querySelectorAll(WoofType.buildSelector(value));
	}

	static buildSelector(type) {
		return "[wt~='" + type + "']";
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
		var found = element.querySelector(matcher);
		if (found) return found;
		found = matchParent(element, matcher);
		if (found) return found;		
		return element.ownerDocument.querySelector(matcher);		
	}
	
	static findUp(element, matcher) {
		return matchParent(element, matcher);
	}
	
	static bfind(element, upMatcher, downMatcher) {
		if (!element) element = document.body;
		var up = Utils.findUp(element, upMatcher);
		if (!up) {
			var ups = element.querySelectorAll(upMatcher);
			if (ups.length == 1) {
				up = ups[0];
			}
		}
		if (!up) return null;
		return up.querySelector(downMatcher);
	}
	
	static bfindAll(element, upMatcher, downMatcher) {
		var up = Utils.findUp(element, upMatcher);
		if (!up) {
			var ups = element.querySelectorAll(upMatcher);
			if (ups.length == 1) {
				up = ups[0];
			}
		}
		if (!up) return null;
		return Array.from(up.querySelectorAll(downMatcher));
	}
		
	static UUID() {
		return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
			(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
		);
	}
	
	static tag(elt) {
		return elt.tagName.toLowerCase();
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

class AbstractDomController {
	static bfind(config, elt, matcher) {
		return Utils.bfind(elt, matcher || config.upStop || 'body', config.matcher);
	}

	static bfindAll(config, elt, matcher) {
		return Utils.bfindAll(elt, matcher || config.upStop || 'body', config.matcher);
	}

	static find(config, elt){
		return Utils.find(elt, config.matcher);
	}

	static findDown(config, elt) {
		return elt.querySelector(config.matcher);
	}
	
	static findAll(config, elt) {
		return Array.from(elt.querySelectorAll(config.matcher));
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

class BlueprintFunction {
	static find(elt, type) {
		var string;
		if (elt.hasAttribute(type)) string = elt.getAttribute(type);
		else {
			var found = elt.querySelector(type + "[fn]");
			if (!found) throw boom("Uh oh");
			string = found.getAttribute("fn");
		}
				
		return WoofRootController.controller(string);
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
		return parseBoolean(element.getAttribute(config));
	}
	
	static set(config, element, value, opt_clear) {
		if (value === undefined || value === null || (!value && !!opt_clear)) {
			element.removeAttribute(config);
		} else {
			element.setAttribute(config, value);
		}		
	}

	static true(config, element) {
		BoolAttr.set(config, element, true);
	}

	static false(config, element) {
		BoolAttr.set(config, element, false);
	}
	
	static find(config, element, value) {
		if (value) {
			return element.querySelector('[' + config + ']');
		}
		return element.querySelector(':not([' + config + '])');
	}
	
	static findAll(config, element, value) {
		return element.querySelectorAll('[' + config +'=' + value + ']');		
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
		if (value !== undefined) {
			return element.querySelector('[' + config +'="' + value + '"]');		
		} else {
			return element.querySelector('[' + config + ']');
		}
	}

	static findDown(config, element, value) {
		if (value !== undefined) {
			return element.querySelector('[' + config +'="' + value + '"]');		
		} else {
			return element.querySelector('[' + config + ']');
		}
	}
	
	static findAll(config, element, value) {
		if (value !== undefined) {
			return Array.from(element.querySelectorAll('[' + config +'="' + value + '"]'));		
		} else {
			return Array.from(element.querySelectorAll('[' + config + ']'));
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

	static findGet(config, element) {
		var elt = StringAttr.find(config, element);
		return !!elt ? StringAttr.get(config, elt) : null;
	}

	static findDown(config, element, value) {
		var matcher = (value === undefined) ? '[' + config + ']' : '[' + config + '="' + value + '"]';
		if (element.matches(matcher)) {
			return element;
		}
		return element.querySelector(matcher);
	}
	
	static find(config, element, value) {
		if (value === undefined) {
			return Utils.find(element, '[' + config + ']');
		}
		return Utils.find(element, '[' + config + '="' + value + '"]');
	}
	
	static findAll(config, element, value) {
		if (value === undefined) {
			return Array.from(element.querySelectorAll('[' + config + ']'));
		}
		return Array.from(element.querySelectorAll('[' + config + '="' + value + '"]'));
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

	static findInvoke(...args) {
		var config = args[0];
		var elt = args[1];
		var args = args.slice(2);

		var realElt = FunctionAttr.find(config, elt);
		return FunctionAttr._invoke(config, realElt, args);	
	}

}
Utils.classMixin(FunctionAttr, StringAttr);

class IdAttr {
	static generateAll(elts) {
		elts.forEach(elt => IdAttr.generate(elt));
	}
	
	static generate(elt) {
		var current = IdAttr.get(elt);
		if (current) return current;
		var id = Utils.UUID();
		IdAttr.set(elt, id);
		return id;
	}
		
	static buildSelector(value) {
		return '[w-id="' + value + '"]';
	}
}
Utils.classMixin(IdAttr, StringAttr, "w-id");


class ListAttr {
	static key(config) {
		return config;
	}

	static find(param, element, value) {
		if (value === undefined) {
			return element.querySelector('[' + param + ']');
		}
		return element.querySelector('[' + param + '~="' + value + '"]');
	}

	static findGet(param, element, value) {
		var found = ListAttr.find(param, element, value);
		if (!found) return null;
		return ListAttr.get(param, found);
	}

	static findAll(param, element, value) {
		if (value === undefined) {
			return element.querySelectorAll('[' + param + ']');
		}
		return element.querySelectorAll('[' + param + '~="' + value + '"]');
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

/** Create attributes as instances on classes so they're scoped locally instead of globally. */
class ScopedAttr {
	constructor(tag, baseClass) {
		Utils.classMixin(this, baseClass, tag);
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

	static returnTicketOn(element, opt_parentElt) {
		var effectSelector = PendingOpAttr.ForEffect.get(element);
		var ticket = PendingOpAttr.EffectTicket.get(element);
		if (!effectSelector || !ticket) throw boom("Unexpected missing ticket.");
		var effect = Utils.bfind(opt_parentElt || element, 'body', effectSelector);
		PendingOpAttr.returnTicket(effect, ticket);
		PendingOpAttr.ForEffect.set(element);
		PendingOpAttr.EffectTicket.set(element);
	}
}
Utils.classMixin(PendingOpAttr, ListAttr, "pending-operation");


class Predicates {	
	// Combinatorics
	static and(...theArgs) {
		return function() {
			for (var i = 0; i < theArgs.length; i++) {
				if (!theArgs[i].apply(this, arguments)) return false;
			}
			return true;
		};
	}
	
	static or(...theArgs) {
		return function() {
			for (var i = 0; i < theArgs.length; i++) {
				if (theArgs[i].apply(this, arguments)) return true;
			}
			return false;
		};
	}
	
	static not(fn) {
		return function() {
			return !fn.apply(this, arguments);
		}
	}	
}

// Info types, which live under info roots.  These two work together to allow you to
// find info elements wherever they're hiding.
class BaseInfo {
	static findAll(config, element, opt_matcher) {
		var root = config.infoRoot.find(element);
		return Array.from(root.querySelectorAll(config.matcher)).
				filter(elt => !opt_matcher || elt.matches(opt_matcher));		
	}
	
	static find(config, element, name) {		
		var value = name || config.refFn(element);
		var root = config.infoRoot.find(element);
		var selector = config.matcher + (!!name ? value : config.refSelectorFn(value));
		return root.querySelector(selector);
	}
	
	static findMap(config, element, opt_matcher) {
		return BaseInfo.findAll(config, element, opt_matcher).toObject(config.idFn)
	}
	
	static put(config, element, inflateConfig) {
		var root = config.infoRoot.find(element);
		var toAppendTo = !!config.parentSelector ?
				root.querySelector(config.parentSelector) :
				root;
		var child = Templates.inflate(config.templateName, inflateConfig);
		toAppendTo.appendChild(child);
		return child;		
	}
}

class BaseInfoRoot {
	static find(config, element) {
		var relativeTo = element;
		if (config.relativeTo) {
			relativeTo = config.relativeTo.find(element);
		}
		
		return relativeTo.querySelector(config.relativeMatcher);
	}
}


class TypeAttr {}
Utils.classMixin(TypeAttr, StringAttr, "type");

class HandlerAttr {}
Utils.classMixin(HandlerAttr, StringAttr, "handler");

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

	static find(elt) {
		return Utils.bfind(elt, 'body', "[woof-queue]");
	}

	static findUp(elt) {
		var found = WoofType.findUp(elt, "EffectQueue");
		if (found) return found;
		
		found = Utils.findUp(elt, "[woof-queue]");
		if (!found) return null;
		
		return found.querySelector(found.getAttribute('woof-queue'));		
	}
	
	static findDown(elt) {
		return elt.querySelector('[wt="EffectQueue"]');
	}

	static getHandlerContainer(elt) {
		var queue = EffectQueue.findUp(elt);
		if (!queue) {
			queue = EffectQueue.findDown(elt);
		}
		return queue.querySelector('handlers');
	}
	
	static findHandlersFor(element) {
		var queue = EffectQueue.findUp(element);
		var eventType = GameEffect.getType(element);
		var phase = PhaseAttr.get(element) || 'before';
		var type;
		if (phase == 'started') {
			type = eventType;
		} else {
			type = eventType + ":" + phase;
		}
		Logger.trace("Attempting " + type );
		
		return Array.from(queue.querySelectorAll("[event-types~='" + type + "']"));
	}
	
	static findDefaultHandler(element) {
		return WoofRootController.controller(element.querySelector('effects > handlers').getAttribute("default"));
	}

	static currentQueue(element) {
		var queue = EffectQueue.find(element);
		return EffectQueue.findCurrentQueue(queue);
	}
	
	static findCurrentEvent(element) {		
		var current = element.querySelector('queue > game-effect');
		if (!current) return null;
		var next = current.querySelector('queue > game-effect');
		if (!next) return current;
		
		while (next) {
			current = next;
			next = current.querySelector('queue > game-effect');
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
	
	static invokeHandler(handler, current, args) {
		var result = WoofRootController.controller(HandlerAttr.get(handler)).apply(this, args);
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
			element = element.querySelector('queue');
		}
		if (!EffectQueue.pendingPromises[promiseId]) {
			EffectQueue.pendingPromises[promiseId] = new PromiseSetter();
		}
		element.appendChild(event);
		return EffectQueue.pendingPromises[promiseId].promise();
	}
			
	static evoke(queue) {
		var current = EffectQueue.findCurrentEvent(queue);
		if (!current) return;
		var id = IdAttr.get(current);
		if (!id) IdAttr.generate(current);				
		var children = GameEffect.getChildEvents(current);
		if (children.length > 0) throw boom("EffectQueue got non-bottom child", current);		
		var pending = IsPendingAttr.get(current);
		
		if (pending) {
			// Blocked on something else.  Gotta wait for that.
			return;
		}
		
		var pendingOp = PendingOpAttr.get(current);
		if (pendingOp.length > 0) {
			// Blocked on something else.
			return;
		}
		
		var phase = PhaseAttr.get(current);
		var result;
		var promiseId = PromiseIdAttr.get(current);
		var promiseSetter = !!promiseId ? EffectQueue.pendingPromises[promiseId] : null;
		
		switch (phase) {
			case null:
			    PhaseAttr.set(current, 'before');
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
				if (CancelledAttr.get(current)) {
					// Event was cancelled.
					if (!!promiseSetter) {
						promiseSetter.reject("cancelled");
						delete EffectQueue.pendingPromises[promiseId];
					}
					current.parentNode.removeChild(current);
				}

				// If it's pending, wait for it to wrap up.
				if (IsPendingAttr.get(current)) break;
				if (PendingOpAttr.get(current).length > 0) break;

				// Hooray, we can move on.
				PhaseAttr.set(current, 'started');
			case 'started':
				// Second phase: Actually invoking it.
				if (!InvokedAttr.get(current)) {
					if (EffectQueue.InvokePhase.get(current) != 'started') {
						var handlers = EffectQueue.findHandlersFor(current);
					
						// We force exactly 1 handler here.  It makes dealing
						// with results easier.
						if (handlers.length != 1) throw boom("Unexpected number of invocation handlers", handlers);	
						var resultPromise = EffectQueue.invokeHandler(handlers[0], current, [current, handlers[0]])
						InvokedAttr.set(current, true);
						EffectQueue.InvokePhase.set(current, 'started');
						resultPromise.then(function(actualResult) {
							// Set our result.
							if (!!actualResult) {
								GameEffect.setResult(current, actualResult);
								PhaseAttr.set(current, 'after');
							}
						});
					}
				}

				// If it's pending, wait for it to wrap up.
				if (IsPendingAttr.get(current)) break;
				if (PendingOpAttr.get(current).length > 0) break;
				result = GameEffect.getResult(current);
				// No result?  We gotta wait.
				if (result === undefined || result === null) break;

				// Hooray, we can move on.
				PhaseAttr.set(current, 'after');				
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
				
				if (IsPendingAttr.get(current)) break;
				if (PendingOpAttr.get(current).length > 0) break;
				
				PhaseAttr.set(current, 'complete');				
			case 'complete':
				// We already did a pending check above.  Only thing left
				// is to get rid of this element once we resolve the promise.				
				result = result || GameEffect.getResult(current);				
				if (!!promiseSetter) {
					promiseSetter.resolve(result);
					delete EffectQueue.pendingPromises[promiseId];					
				}

				current.parentNode.removeChild(current);				
				break;
		}		
	}
}

class PhaseAttr{}
Utils.classMixin(PhaseAttr, StringAttr, "phase");

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
	static create(type, opt_config) {
		var element = Templates.inflate("game_effect", {
			ID: Utils.UUID(),
			TYPE: type
		});
		if (opt_config) GameEffect.setParams(element, opt_config);
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
	
	static createResults(effect, selfResult, childResults) {
		if (selfResult === undefined) selfResult = {};
		if (childResults === undefined) childResults = [];
		selfResult.type = GameEffect.getType(effect);
		return {
			result: selfResult,
			results: childResults
		};
	}
	
	static baseResult(effect, value) {
		value.type = GameEffect.getType(effect);
		return {
			result: value,
			results: []
		};
	}
	
	static mergeResults(array, results) {
		if (results.results !== undefined && results.results !== null) {
			array.extend(results.results);
		}
		array.push(results.result);
		return results.result;		
	};
	
	static flattenResults(results) {
		var array = results.results;
		array.push(results.result);
		return array;
	}
	
	static chainResult(effect, result, previousResult) {
		return GameEffect.createResults(effect, result, GameEffect.flattenResults(previousResult));
	}
	
	static setParams(elt, params) {
		if (params) {
			var normalized = GameEffect.normalize(elt, params);
			var serialized = JSON.stringify(normalized);
			elt.setAttribute("params", serialized);
		} else {
			elt.removeAttribute("params");
		}
		return elt;
	}
	
	static normalize(elt, params) {
		// Update our keys to be wooftypes.
		Object.keys(params).forEach(function(key) {
			var value = params[key];
			if (value instanceof HTMLElement) {
				params[key] = WoofType.buildSelectorFor(value);
			}
			params["____selector_" + key] = true;
		});

		if (!params.type) {
			params.type = GameEffect.getType(elt);
		}
		return params;
	}

	static denormalize(elt, params) {
		// Look up all of our wooftypes.
		Object.keys(params).forEach(function(key) {
			// Skip these ones.
			if (key.startsWith("____")) return;
			var value = params[key];
			if (value instanceof String) {
				if (params["____selector_" + key]) {
					params[key] = Utils.bfind(elt, 'body', value);
				}
			}
		});

		// Remove our denormalization hints.
		Object.keys(params).forEach(function(key) {
			// Remove our hints.
			if (key.startsWith("____")) delete params[key];
		});

		return params;
	}
	
	static setResult(elt, result) {
		if (result) {
			var normalized = GameEffect.normalize(elt, result);
			var serialized = JSON.stringify(normalized);
			elt.setAttribute("result", serialized);
		} else {
			elt.removeAttribute("result");
		}
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
		return base.querySelectorAll(":scope > queue > game-effect");
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
		
	static getType(event) {
		return TypeAttr.get(event);
	}
	
	static OnChildChange(event, handler) {
		var parent;
		if (WoofType.has(event.target, "Effect")) {
			parent = WoofType.findUp(event.target.parentNode, "Effect");
		} else {
			parent = WoofType.findUp(event.target, "Effect");
		}
		if (!parent) return;
		IsPendingAttr.set(parent, !!event.target.childElementCount);		
	}

	static findById(relativeElt, id) {
		return Utils.bfind(relativeElt, 'body', WoofType.buildSelectorFrom('Effect', id));
	}
}
WoofRootController.register(GameEffect);

class TimeoutAttr {}
Utils.classMixin(TimeoutAttr, IntAttr, 'timeout');

class CancelledAttr {}
Utils.classMixin(CancelledAttr, BoolAttr, 'cancelled');

class IsPendingAttr {}
Utils.classMixin(IsPendingAttr, BoolAttr, "is-pending");

class InvokedAttr {}
Utils.classMixin(InvokedAttr, BoolAttr, "invoked");

class GameEffectInvoker {	
	static start(queueElt) {
		try {
			var start = window.performance.now();
			/** Ensure 60 FPS */
			while (window.performance.now() - start < (1000.0 / 60)) {					
				EffectQueue.evoke(queueElt);
			}
		} catch (e) {
			Logger.err(e);
		}
		TimeoutAttr.set(queueElt, null);
		var current = EffectQueue.findCurrentEvent(queueElt);
		if (!!current && PendingOpAttr.size(current) == 0) {
			// Set a timeout if we want to pick this up, but only if there are no pending
			// operations.
			var timeout = window.setTimeout(GameEffectInvoker.start.bind(this, queueElt), 0);	
			TimeoutAttr.set(queueElt, timeout);
		}
	}	
	
	static stopTimer(queueElt) {
		var timer = TimeoutAttr.get(queueElt);
		if (typeof(timer) == 'number') {
			window.clearTimeout(timer);
		}		
	}
	
	static OnNewElement(event, handler) {
		var queue = EffectQueue.findDown(handler);
		
		var event = EffectQueue.findCurrentEvent(handler);
		if (event) {
			var timeout = TimeoutAttr.get(handler);
			if (isNaN(timeout)) {
				GameEffectInvoker.start(queue);
			}
		} else {
			GameEffectInvoker.stopTimer(queue);
		}
	}
}
WoofRootController.register(GameEffectInvoker);

