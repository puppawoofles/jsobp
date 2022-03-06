/**
 * What the fuck is this file even:
 * 
 * Basically a fancy way to put scripts that generate things in the DOM.
 * Why are you writing a thing that runs a script based on HTML elements?
 * You're a senior engineer, you know better than this.  Well, because the
 * whole point of this project is to use gross code.
 * 
 * There are 3 major categories of things in this API:
 * 1) Script Commands.  There are a few prebuilt classes here:
 *   - BasicScriptCommands (various useful utilities)
 *   - MetaScriptCommands (invoking other scripts, "if" statements)
 *   - [Add your own, e.g. UnitScriptCommans, MapScriptCommands, EventScriptCommands, etc]
 *   interface is: method(script-command-element, object-being-built, defs-blob (see #3 below))
 *   If you return an element, script execution will continue from that element until it's out of
 *   siblings, then it will return after this command.
 * 2) Base Generator (BPScriptBasedGenerator).  Extend this (e.g. UnitGen, MapGen, EventGen) and
 *    provide a few basic things: {
 *      normalizeObject: function(BlueprintElt?) => DOM element to generate (this is like the object constructor)
 *      commands: Array<ScriptCommandClasses (e.g. look at 1 above)
 *    }
 * 3) When interacting with Defs when you implement your own commands:
 *   - Def names with a period in them (e.g. "potato.kitten") is a scope.  This thing will
 *     crawl up the DOM to find an appropriate def scope with that name (e.g. "potato") and
 *     then look in its param blob for the key (e.g. "kitten").
 *   - Unscoped def names (e.g. "kitten") will use the script's per-instance scope, which will
 *     be wiped after the script run.
 */



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
				toExecute.unshift(current.nextElementSibling);
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


class GenUtils {
    static buildBlueprintFor(type) {
        return function(context, name) {
            return bf(context, `${type}-blueprint[name="${name}"]`);
        }
    }

    static genBlueprintFor(type) {
        return function(context, name) {
            return bf(context, `${type}-gen[name="${name}"]`);
        }
    }

    static scriptBlueprintFor(type) {
        return function(context, name) {
            return bf(context, `${type}-script[name="${name}]`);
        }
    }

    static decorateFindFor(blob, type) {
        blob["findGenBlueprint"] = GenUtils.genBlueprintFor(type);
        blob["findBuildBlueprint"] = GenUtils.buildBlueprintFor(type);
        blob["findScriptBlueprint"] = GenUtils.scriptBlueprintFor(type);
        return blob;
    }
}


/**
 * Internal class that has utilities for converting defs.
 */
class DefUtils {
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
}


/**
 * Provides utilities for finding/setting/getting variables in DOM scripts.
 */
class ScriptDefs {
	static ScriptScopeName = new ScopedAttr("ds-scope-name", StringAttr);
	static ScriptScopeData = new ScopedAttr("ds-scope-data", BlobAttr);

    static normalize(contextElt, base) {
        if (base instanceof ScriptDefs) return base;
        var toReturn = new ScriptDefs(contextElt);
        toReturn.put(undefined, base || {});
        return toReturn;
    }

	constructor(relativeTo) {
        if (!relativeTo) throw boom("Unable to initialize scriptdefs without a context.");
		this.baseElt = relativeTo;
        this.unscoped = {};
	}

    __contextElt() {
        return this.baseElt;
    }

	findContext(key) {
		if (!key) {
			return null;
		}
		var selector = ScriptDefs.ScriptScopeName.buildSelector(key);
		return matchParent(this.baseElt, selector);
	}

    __getBlob(contextKey) {
        if (!contextKey) return this.unscoped;
        var cElt = this.findContext(contextKey);
		return ScriptDefs.ScriptScopeData.get(cElt) || {};
        
    }

    __setBlob(contextKey, blob) {
        if (!contextKey) {
            this.unscoped = (blob || {});
            return;
        }
		var cElt = this.findContext(context);
		ScriptDefs.ScriptScopeData.set(cElt, defs);
    }

    __getKey(baseKey) {
        var key = [null, baseKey];
		if (baseKey.indexOf('.') > 0) {
            key = baseKey.split('.');
		}
        return key;
    }

	get(baseKey) {
        var key = this.__getKey(baseKey);
        return this.__getBlob(key[0])[key[1]] || null;
	}

	put(context, defs) {
        this.__setBlob(context, defs);
	}

	clear(context) {
        this.__setBlob(context);
	}

	set(baseKey, value) {
        var key = this.__getKey(baseKey);
        var blob = this.__getBlob(key[0])
		if (value === undefined) {
			delete blob[key[1]];
		} else {
			blob[key[1]] = value;
		}
        this.__setBlob(key[0], blob);
		return value;
	}

	map(keyList) {
        var scope = this;
		return (keyList || []).map(function(key) {
			return scope.get(key);
		});
	}
}

class ScriptShortcuts {
    static runScriptFor(scriptRoot, commands, baseObj, defs) {
        var operations = {};
        commands.forEach(function(obj) {
            for (var key of Object.getOwnPropertyNames(obj)) {
                if (typeof(obj[key]) != 'function') continue;
                operations[key] = (function(k, o, elt) {
                    return o[k](elt, baseObj, defs);
                }).bind(undefined, key, obj);
            }        
        });

        DomScript.execute(scriptRoot, operations);
    }
}



/**
 * Provides a basic implementation for common script thingies.
 */
class BasicScriptCommands {
    static Key = new ScopedAttr("key", StringAttr);
    static Value = new ScopedAttr("value", StringAttr);
    static Values = new ScopedAttr("values", ListAttr);
    static Fn = new ScopedAttr("fn", FunctionAttr);
    static Params = new ScopedAttr("params", ListAttr);

    // For each attribute, copy it over directly to the object.
    static copy(elt, obj, defs) {
        a(elt.attributes).forEach(function(attr) {
            obj.setAttribute(attr.name, attr.value);
        });
    }

    static add(elt, obj, defs) {
        a(elt.attributes).forEach(function(attr) {
            var existing = ListAttr.get(attr.name, obj) || [];
            existing.push(attr.value);
            ListAttr.set(attr.name, obj, existing);
        });
    }

    // For each attribute, set it on the base object with
    // the value equal to the def key provided.
    static copyDef(elt, obj, defs) {
        a(elt.attributes).forEach(function(attr) {            
            obj.setAttribute(attr.name, defs.get(attr.value));
        });
    }

    // Like copy, but for all elements/subelements that already
    // have this attr set.
    static copyDest(elt, obj, defs) {
        a(elt.attributes).forEach(function(attr) {
            var a = new ScopedAttr(attr.name, StringAttr);
            a.findSetAll(obj, attr.value);
        });
    }

    // Like if copyDest and copyDef had a baby.
    static copyDestDef(elt, obj, defs) {
        a(elt.attributes).forEach(function(attr) {
            var a = new ScopedAttr(attr.name, StringAttr);
            a.findSetAll(obj, defs.get(attr.value));
        });
    }

    static def(elt, obj, defs) {
        var defKey = BasicScriptCommands.Key.get(elt);
        var value = null;
        if (BasicScriptCommands.Value.has(elt)) {
            value = DefUtils._normalizeString(BasicScriptCommands.Value.get(elt));
        } else if (BasicScriptCommands.Fn.has(elt)) {
            var params = defs.map(BasicScriptCommands.Params.get(elt));
            params.unshift(elt);
            params.unshift(obj);
            value = BasicScriptCommands.Fn.aInvoke(elt, params);
        }
        defs.set(defKey, value);
    }

    static invoke(elt, obj, defs) {
        // Call a function with the unit + the requested defs.
        var params = defs.map(BasicScriptCommands.Params.get(elt));
        params.unshift(elt);
        params.unshift(obj);
        BasicScriptCommands.Fn.aInvoke(elt, params);
    }
}


/** 
 * Implement script commands that control script flow / calling out to other scripts.
 */
class MetaScriptCommands {
    static Name = new ScopedAttr("name", StringAttr);
    static Selector = new ScopedAttr("selector", StringAttr);
    static Fn = new ScopedAttr("fn", FunctionAttr);
    static Choices = new ScopedAttr("choices", ListAttr);
    static Params = new ScopedAttr("params", ListAttr);
    static Def = new ScopedAttr("def", StringAttr);
    static Keys = new ScopedAttr("keys", ListAttr);
    static for(generator, rng) {        
        return {
            'ifAllDef': function(elt, obj, defs) {
                var params = defs.map(MetaScriptCommands.Keys.get(elt));
                if (params.filter(e => !!e).length < params.length) {
                    // Skip.
                    return;
                }
                return elt.firstElementChild;
            },
            'ifNoneDef': function(elt, obj, defs) {
                var params = defs.map(MetaScriptCommands.Keys.get(elt));
                if (params.filter(e => (e === null || e === undefined)).length < params.length) {
                    // Skip.
                    return;
                }
                return elt.firstElementChild;
            },
            'sub': function(elt, obj, defs) {
                var scriptName = MetaScriptCommands.Name.get(elt);
                var scriptSelector = MetaScriptCommands.Selector.get(elt);
                var key = `__${scriptName}__inpath`;
                var existing = defs.get(key);
                if (existing) throw boom("Detected sub script cycle.");
                defs.set(key, true);
                return qs(document.body, scriptSelector).firstElementChild;
            },
            'choose': function(elt, obj, defs) {
                var choice;
                if (MetaScriptCommands.Fn.has(elt)) {
                    var params = defs.map(MetaScriptCommands.Params.get(elt));
                    params.unshift(elt);
                    params.unshift(obj);
                    choice = MetaScriptCommands.Fn.aInvoke(elt, params);
                } else if (MetaScriptCommands.Choices.has(elt)) {
                    var choices = MetaScriptCommands.Choices.get(elt);
                    choice = rng.randomValue(choices);
                } else if (MetaScriptCommands.Def.has(elt)) {
                    choice = defs.get(MetaScriptCommands.Def.get(elt));
                }
                var result = qs(elt, 'result[value="' + choice + '"]');
                if (!result) {
                    result = qs(elt, 'result[default="true"]');
                }
                if (result && result.firstElementChild) {
                    return result.firstElementChild;
                }
            }
        };
    }
}


/**
 * Extend this class with your specific subtype to build a generator that
 * will first build a thing from a blueprint (like a constructor), then run
 * a DOM-script (to configure).
 */
class BPScriptBasedGenerator {
    static runScriptFor(config, scriptRoot, baseObj, defs) {
        return ScriptShortcuts.runScriptFor(scriptRoot, config.commands, baseObj, defs);
    }


    static gen(config, contextElt, bpEltOrName, opt_defs, opt_baseObj, opt_skipFinalize) {
        // This is basically a 2-part thing.  We want to find a blueprint,
        // and we want to find a script.  Sometimes, one or more may be null.
        // Sometimes, instead of a blueprint, we have a baseObject.  In that
        // case, skip the blueprint.

        var defs = ScriptDefs.normalize(contextElt, opt_defs);
        contextElt = defs.__contextElt();
        var finalize = config.finalize || (e => e);

        if (!isElement(bpEltOrName)) {
            bpEltOrName = config.findGenBlueprint(contextElt, bpEltOrName);
        }

        // This should run the blueprint if that's a thing.
        var baseObj = BPScriptBasedGenerator.normalizeObj(config, bpEltOrName, contextElt, defs, opt_baseObj);
        var script = BPScriptBasedGenerator.findScript(contextElt, bpEltOrName);

        if (script) {
            ScriptShortcuts.runScriptFor(script, config.commands, baseObj, defs);
        }
        if (!opt_skipFinalize) finalize(contextElt, baseObj);
        return baseObj;
    }


    static Script = new ScopedAttr("script", StringAttr);
    static findScript(contextElt, elt) {
        var script = null;
        if (BPScriptBasedGenerator.Script.has(elt)) {
            script = config.findScriptBlueprint(contextElt, BPScriptBasedGenerator.Gen.get(elt));
        }
        if (!script) {
            script = qs(elt, ':scope > gen');
        }
        if (!script) {
            script = elt;
        }
        return script;
    }


    static Bp = new ScopedAttr("bp", StringAttr);
    static Base = new ScopedAttr("base", StringAttr);
    static normalizeObj(config, elt, contextElt, defs, baseObj) {
        // If we already have one (e.g. it was passed in), roll with it.
        // If this hass a base script, let's generate that first.

        if (!baseObj) {
            // Next up, find a blueprint if we can.
            // Check 1: See if this has a bp field.
            var blueprint = null;
            if (BPScriptBasedGenerator.Bp.has(elt)) {
                // Cool, we can look this up.
                blueprint = config.findBuildBlueprint(contextElt, BPScriptBasedGenerator.Bp.get(elt));
            }
            if (!blueprint) {
                blueprint = qs(elt, ':scope > bp');
            }
            if (blueprint) {
                baseObj = config.normalizeObject(blueprint)
            }
        }

        if (BPScriptBasedGenerator.Base.has(elt)) {
            return BPScriptBasedGenerator.gen(config, contextElt,
                BPScriptBasedGenerator.Base.get(elt), defs, baseObj || null, true);
        } else if (!baseObj) {
            baseObj = config.normalizeObject(null);
        }

        return baseObj;
    }
}
