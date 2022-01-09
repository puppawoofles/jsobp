

class Compendium {
	static find(parentElt, opt_path) {
		var parent = Utils.find(parentElt, '.compendium');
		if (!parent) return null;
		if (!opt_path) return parent;
		
		var parts = opt_path.toLowerCase().split('/');
		var current = '';
		var first = true;
		for (var i = 0; i < parts.length; i++) {
			if (first) { first = false; }
			else { current += " > "; }
			current += "concept[hash='" + parts[i] + "']";
		}
		return qs(parent, current);		
	}
	
	static getValues(parentElt, path, opt_key) {
		var spot = Compendium.find(parentElt, path);
		if (!spot) return null;
		return qsa(spot, 'values > ' + (opt_key || '*'));
	}
	
	static getValue(parentElt, path, key) {
		var spot = Compendium.find(parentElt, path);
		if (!spot) return null;
		return qs(spot, 'values > ' + key);		
	}
}

class CompendiumAttr {}
Utils.classMixin(CompendiumAttr, StringAttr, 'compendium');

/** Utility class for managing the info panel. */
class InfoPanel {	
	static Compendium = new ScopedAttr('compendium', StringAttr);
	static CompendiumHashFn = new ScopedAttr('compendium-hash-fn', FunctionAttr);
	
	static OnInfoClick(evt, handler) {
		var infoPanel = InfoPanel.find(handler);
		if (!infoPanel) return;		
		var elt = evt.target;
		if (!elt) return;
		evt.preventDefault();
		elt = InfoPanel.Compendium.findUp(elt);
		if (!elt) return;
		var link = InfoPanel.Compendium.get(elt);
		if (!link) return;

		// Add bonus hash.
		if (InfoPanel.CompendiumHashFn.has(elt)) {
			link += '#' + InfoPanel.CompendiumHashFn.invoke(elt, elt);
		}

		Utils.setFragment(link);	
	}
	
	static OnHashChange(evt, handler) {
		if (window.location.hash) {
			var value = window.location.hash.substring(1);
			InfoPanel.navigateTo(handler, value);
		}
		evt.preventDefault();
	}

	static currentNav(parentElt) {
		if (!parentElt || !parentElt.ownerDocument || !parentElt.ownerDocument.defaultView) return null;
		return parentElt.ownerDocument.defaultView.location.hash.toLowerCase().substring(1);
	}
	
	static RendererFn = new ScopedAttr('renderer', FunctionAttr);
	static navigateTo(parentElt, page) {
		// First, find the hash split.
		var bonusHash = null;
		if (page.includes("#")) {
			var hashSplit = page.split("#");
			page = hashSplit.shift(); // First part is for page nav.
			bonusHash = hashSplit.join("#");  // Rejoin in case this matters.
		}

		var parts = page.toLowerCase().split('/');
		// Check for bonus-hash.

		var current = '';
		var first = true;
		for (var i = 0; i < parts.length; i += 2) {
			if (first) { first = false; }
			else { current += " > "; }
			current += parts[i];
			if (i + 1 < parts.length) {
				current += "[hash='" + parts[i+1] + "']";
			}
		}
		current += " > info-panel";
		
		/** TODO: Need to find a compendium **/ 
		var node = Compendium.find(parentElt);
		if (!node) {
			return Logger.warn("No compendium found.");
		}
		node = qs(node, current);
		if (!node) {
			return Logger.warn("Didn't find anything for", page);
		}
		var self = InfoPanel.find(parentElt);
		if (!self) {
			return Logger.warn("No info panel found.");
		}
		var inner = qs(self, '.info_panel_contents');				

		// Renderer goes here!
		Utils.clearChildren(inner);
		if (InfoPanel.RendererFn.has(node)) {
			InfoPanel.RendererFn.invoke(node, inner, node, page, bonusHash);
		} else {
			var copy = node.cloneNode(true);
			Utils.moveChildren(copy, inner);		
		}		
	}
}
WoofRootController.register(InfoPanel);
WoofRootController.addListeners("contextmenu");
Utils.classMixin(InfoPanel, AbstractDomController, { matcher: ".info_panel_widget" });


/** Helper that highlights things for ease of use. */
class DomHighlighter {	
	static __inTransition = new Set();
	
	static OnClick(event, handler) {
		var target = event.target;
		var ref = target.getAttribute("highlight-ref");
		if (!ref) return;
		
		var elt = qs(handler, ref);
		if (!elt) return;

		DomHighlighter.highlight(elt);	
	}

	static highlight(elts, opt_config) {
		if (!elts) return;
		if (!Array.isArray(elts)) {
			elts = [elts];
		}
		elts.forEach(function(elt) {
			if (DomHighlighter.__inTransition.has(elt)) return;
			DomHighlighter.__inTransition.add(elt);		
			elt.classList.add("highlight");
			if (opt_config && opt_config.color) elt.classList.add(opt_config.color);
			window.setTimeout(function() {
				// Set new style inline.
				elt.classList.remove("highlight");
				if (opt_config && opt_config.color) elt.classList.remove(opt_config.color);
				DomHighlighter.__inTransition.delete(elt);
			}, 0);

			if (elt.getAttribute("highlight-scroll-to")) {
				elt.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
					inline: 'center'
				});
			}
		});				
	}
}
WoofRootController.register(DomHighlighter);


class TargetControllerHandlerAttr {}
Utils.classMixin(TargetControllerHandlerAttr, StringAttr, 'target-controller-handler');

class TargetContextAttr {}
Utils.classMixin(TargetContextAttr, ListAttr, 'target-context');


/** Does extra routing around for like picking targets and shit. */
class TargetController {	
	static _clearHighlights(root, context) {
		var selector = ".target_active";
		if (context) {
			selector += "[target-context~='" + context + "']";
		}
		var allTheBoys = qsa(root, selector);
		for (var i = 0; i < allTheBoys.length; i++) {
			TargetContextAttr.remove(allTheBoys[i], context, true);
			if (TargetContextAttr.size(allTheBoys[i]) == 0) {
				WoofType.remove(allTheBoys[i], "Target");
				allTheBoys[i].classList.remove("target_active");
				allTheBoys[i].classList.remove("preferred_target");
			}
		}		
	}
	
	static _highlight(targets, targetAttr, preferred) {
		for (var i = 0; i < targets.length; i++) {
			targets[i].classList.add("target_active");
			WoofType.add(targets[i], "Target");
			TargetContextAttr.add(targets[i], targetAttr);
			if (preferred.contains(targets[i])) {
				targets[i].classList.add("preferred_target");
			}
		}		
	}
	
	static getTargetContext(elt) {
		return TargetContextAttr.get(elt);
	}
		
	static _setHandler(root, context, controller) {
		var current = TargetControllerHandlerAttr.get(root) || null;
		var parts = !!current ? current.split(",") : [];
		var set = false;
		for (var i = 0; i < parts.length; i++) {
			if (parts[i].includes(context)) {
				parts[i] = context + ">" + controller;
				set = true;
			}
		}
		if (!set) {
			parts.push(context + ">" + controller);
		}
	
		TargetControllerHandlerAttr.set(root, parts.join(","));
	}

	static _removeHandler(root, context) {
		if (!context) {
			TargetControllerHandlerAttr.set(root, null);
			return;
		}
		var current = TargetControllerHandlerAttr.get(root) || "";
		var parts = current.split(",");
		for (var i = 0; i < parts.length;) {
			if (parts[i].includes(context)) {
				parts.splice(i, 1);
			} else {
				i++;
			}
		}
	
		TargetControllerHandlerAttr.set(root, context, parts.join(","));
	}
	
	static _isTarget(element) {
		return WoofType.has(element, "Target");
	}

	static clearTarget(root, context) {
		var realRoot = TargetController.find(root);
		TargetController._clearHighlights(realRoot, context);
		TargetController._removeHandler(root, context);
	}
		
	static addTargets(root, targets, context, controller, preferred) {
		var realRoot = TargetController.find(root);
		TargetController._highlight(targets, context, preferred || []);
		TargetController._setHandler(realRoot, context, controller);		
	}
		
	static OnTargetClick(evt, handler) {
		var current = TargetControllerHandlerAttr.get(handler) || "";
		var parts = current.split(",");

		var candidates = [];

		var target = matchParent(evt.target, "[wt~='Target'][target-context]");
		var context = TargetContextAttr.get(target);

		for (var i = 0; i < parts.length; i++) {
			for (var j = 0; j < context.length; j++) {
				if (parts[i].includes(context[j])) {
					// Push our controller.
					candidates.push(parts[i].split(">")[1]);
				}
			}
		}

		if (candidates.length == 0) {
			Logger.warn("Got a target click on", evt.target, "without a controller for it.");
			return;
		}
		if (candidates.length > 1) {
			Logger.warn("Multiple handlers exist for target", evt.target, "which could be a problem.");			
		}

		for (var i = 0; i < candidates.length; i++) {
			WoofRootController.invokeHandler(evt, handler, candidates[i]);
		}
	}
}
WoofRootController.register(TargetController);
WoofRootController.addListeners("click");
Utils.classMixin(TargetController, AbstractDomController, { matcher: "[wt~=TargetController]" });


/** Separate class to prevent inventing new console commands. */
class ConsoleCommandUtils {
	static parseParams(inputParams) {
		if (!inputParams) inputParams = [];
		if (typeof(inputParams) == 'string') inputParams = inputParams.split(' ');
		var params = {};
		var currentKey = null;
		var currentParam = [];
		
		for (var i = 0; i < inputParams.length; i++) {
			var value = inputParams[i];
			if (value.indexOf("--") == 0) {
				// This is new command.
				if (!!currentKey) {
					// We have a previous command built-up we need to dump.
					if (currentParam.length == 1) {
						params[currentKey] = currentParam[0];
					} else {
						params[currentKey] = currentParam;
					}
				}				
				currentKey = value.substr(2);
				currentParam = [];
				params[currentKey] = true; // Assume boolean at first.
			} else {
				// This is not a new command.  Tack it onto our previous.
				if (value.length > 0) {
					currentParam.push(value);				
				}
			}
		}
		// We've got one last set of boyos to attach.
		if (!!currentKey) {
			if (currentParam.length == 1) {
				params[currentKey] = currentParam[0];
			} else if (currentParam.length > 1) {
				params[currentKey] = currentParam;
			}			
		} else {
            // We don't have a current key.
            if (Object.keys(params).length == 0 && currentParam.length > 0) {
                return currentParam.length == 1 ? currentParam[0] : currentParam;
            }
        }
		
		return params;				
	}
}

class ConsoleCommands {
    static _commands = {};
    static register(command, fn) {
        ConsoleCommands._commands[command] = fn;
    }

    static find(command) {
        var found = ConsoleCommands._commands[command];
        return found || undefined;
    }
}

class TestConsole {	
	static create(parentElt) {	
		Templates.inflateIn("message_log", parentElt);
		TestConsole.syncCheckboxesToAttr(TestConsole.find(parentElt));
	}
	
	static focus(parentElt) {
		var root = TestConsole.find(parentElt);
		if (!root) return Logger.err("Can't focus the test console if we can't find it in", parentElt);
		var input = qs(root, "input.console_input");
		if (!input) return Logger.err("Can't find input!");
		input.focus();
	}
	
	static OnConsoleCommand(evt, handler) {
		var command = evt.detail.command;

        var found = ConsoleCommands.find(command.type);
        if (!found) {
            Logger.warn("Unknown Command", command);
        } else {
            found(handler, command.detail);
        }
	}
	
	/** Whenever we change the wlogger-allow property. */
	static OnLoggerLevelChange(evt, handler) {
		TestConsole.syncCheckboxesToAttr(handler);
	}
	
	/** Whenever we change a checkbox. */
	static OnLoggerLevelCheckboxChange(evt, handler) {
		TestConsole.syncAttrToCheckboxes(handler);
	}
	
	static syncCheckboxesToAttr(elt) {
		var levels = ParamList.get(elt, 'wlogger-allow');
		var checkboxes = TestConsole.checkboxes(elt);
		
		for (var value of checkboxes) {			
			if (value.checked != levels.contains(value.getAttribute("level"))) {
				value.checked = !value.checked;
			}
		}		
	}
	
	static syncAttrToCheckboxes(elt) {		
		var levels = ParamList.get(elt, 'wlogger-allow');
		var checkboxes = TestConsole.checkboxes(elt).filter(function(elt) { return elt.checked })
			.map(function(elt) { return elt.getAttribute('level').trim(); });
	
		ParamList.put(elt, 'wlogger-allow', checkboxes);
	}

	static checkboxes(elt) {
		return qsa(elt, 'input[level]');
	}

	static OnKeyDown(evt, handler) {
		var history = handler.getElementsByClassName("message_log_past_entries")[0];		
		var input = evt.target;
		if (evt.keyCode == 13) { // Enter
			var command = input.value.trim();
			if (command.length > 0) {
				var params = null;
				var cmd = command;
				var spaceIdx = command.indexOf(" ");
				if (spaceIdx >= 0) {
					params = command.substr(spaceIdx + 1);
					cmd = command.substr(0, spaceIdx);
				}
				
				input.dispatchEvent(new CustomEvent('ConsoleCommand', {
					bubbles: false,
					cancelable: false,
					detail: {
						command: {
							type: cmd.toLowerCase(),
							detail: params
						}
					}
				}));
				
				input.value = null;
				var fragment = Templates.inflate("message_log_history", { "VALUE": command});
				history.appendChild(fragment);
				input.setAttribute("scrolling", "false");
				var elts = qs(history, "[active]");
				if (elts) elts.removeAttribute("active");
			}
		} else if (evt.keyCode == 38) { // Up arrow
			if (input.value == "" || input.getAttribute("scrolling") == "true") {
				if (history.childElementCount > 0) {
					input.setAttribute("scrolling", "true");					
				var selected = TestConsole.__findActive(history);
					var next = TestConsole.__findNext(history, selected, true);
					if (selected && !next) {
						// Top of the list.  Do nothing and skip!
						return;
					}
					TestConsole.__setActive(next, selected);
					if (selected) {
						input.value = selected.textContent;										
					}
				}
			}
		} else if (evt.keyCode == 40) { // Down arrow.
			if (input.getAttribute("scrolling") == "true") {
				var selected = TestConsole.__findActive(history);
				var next = TestConsole.__findNext(history, selected, false);
				input.value = !!next ? next.textContent : null;
				TestConsole.__setActive(next, selected);
				if (!next) {
					input.setAttribute("scrolling", "false");
				}
			}			
		}
	}
	
	static __findActive(parent) {
		return qs(parent, "[active=true]");		
	}
		
	static __setActive(next, previous) {
		if (previous) previous.removeAttribute("active");
		if (next) next.setAttribute("active", "true");
	}
	
	static __findNext(parent, selected, previous) {
		if (!selected && previous) {
			// Nothing's selected yet and we want a previous entry.
			var candidate = parent.lastChild;
			while (candidate) {
				if (candidate.nodeType == Node.ELEMENT_NODE) return candidate;
				candidate = candidate.previousSibling;				
			}
			return null; // Didn't find anything.
		}
		if (!selected && next) return null; // Nothing to do here.
		
		// We have an already active element.		
		while (selected) {
			selected = previous ? selected.previousSibling : selected.nextSibling;
			if (selected && selected.nodeType == Node.ELEMENT_NODE) {
				return selected;
			}
		}
		return null;
	}
		
	static PostMessage(rootElt, ...message) {
		// Need to process each message appropriately.

		var newMessages = message.map(function(msg) {
			if (typeof msg == "string") return msg;
			return JSON.stringify(msg);
		});
		
		var log = rootElt.getElementsByClassName("log_history")[0];
		
		var pinned = log.scrollHeight > log.clientHeight ?
				((log.scrollTop - log.scrollHeight + log.offsetHeight) < 1) : true;
				
		Templates.inflateIn("log_entry", log, {"CONTENT": newMessages.join(' ')});
		
		if (pinned) {
			window.setTimeout(function() {
				log.scrollTo({
					top: 9000000000,
					behavior: "smooth"
				});
			});
		}
	}
	
	static removeLogLevels(rootElt, ...level) {
		let root = TestConsole.find(rootElt)
		level.forEach(level => ParamList.remove(root, 'wlogger-allow', level));
	}
	
	static addLogLevels(rootElt, ...level) {
		let root = TestConsole.find(rootElt)
		level.forEach(level => ParamList.add(root, 'wlogger-allow', level));		
	}
}
WoofRootController.register(TestConsole);
WoofRootController.addListeners("keydown", "ConsoleCommand", "change");
Utils.classMixin(TestConsole, AbstractDomController, { matcher: ".message_log" });

