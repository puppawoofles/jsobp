class UnitGenerator {
    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Event, NC.Unit);
    static getRng = function() { return UnitGenerator._rng; }

    static Alias = new ScopedAttr("alias", StringAttr);
    static Value = new ScopedAttr("value", StringAttr);
    static Fn = new ScopedAttr("fn", FunctionAttr);
    static Params = new ScopedAttr("params", ListAttr);
    static FromGroup = new ScopedAttr("from-group", StringAttr);
    static Choices = new ScopedAttr("choices", ListAttr);
    static ModTags = new ScopedAttr("mod-tags", ListAttr);
    static ExcludeTags = new ScopedAttr("exclude-tags", ListAttr);

    static generate(name, defs) {
        var unit = Templates.inflate('unit', {
            UNIT_ID: Utils.UUID(),
            // Unset all of these things.
            APPEARANCE: '',
            NAME: '',
            MONTH: '',
            DAY: '',
            BASE_DAMAGE: 0,
            BASE_DEFENSE: 0,
            MASS: 0,
            HP_AMOUNT: 0,
        });

        UnitGenerator.applyScript(unit, name, defs);
        return unit;
    }


    static applyScript(unit, name, defs) {

        // This is basically a tree-traversal to generate the whole thing.
        var script = qs(document, 'unit-gen[name="' + name + '"]');
        defs = defs || {}; // Normalize.
  
        // Defined here for easy access to defs, unit
        var operations = {
            'unit': function(elt) {
                // Apply a unit blueprint.
                var bp = Blueprint.resolve(elt);
                Unit.applyBlueprint(unit, bp);
            },
            'appearance': function(elt) {
                Unit.applyAppearance(unit, elt);
            },
            'def': function(elt) {
                // Set defs so we can reference them with invoke.
                var alias = UnitGenerator.Alias.get(elt);
                if (UnitGenerator.Fn.has(elt)) {
                    var params = (UnitGenerator.Params.get(elt) || []).map(function(key) {
                        return defs[key];
                    });
                    params.unshift(elt);
                    params.unshift(unit);
                    defs[alias] = UnitGenerator.Fn.aInvoke(elt, params);
                } else if (UnitGenerator.Value.has(elt)) {
                    defs[alias] = UnitGenerator.Value.get(elt);
                }
            },
            'copy': function(elt) {
                a(elt.attributes).forEach(function(attr) {
                    unit.setAttribute(attr.name, attr.value);
                });
            },
            'invoke': function(elt) {
                // Call a function with the unit + the requested defs.
                var params = (UnitGenerator.Params.get(elt) || []).map(function(key) {
                    return defs[key];
                });
                params.unshift(elt);
                params.unshift(unit);
                UnitGenerator.Fn.aInvoke(elt, params);
            },
            'apply-modifier': function(elt) {
                var modOptions = [];
                if (UnitGenerator.FromGroup.has(elt)) {
                    var groupName = UnitGenerator.FromGroup.get(elt);
                    modOptions = bfa(elt, 'unit-mods[group="' + groupName + '"] > unit-mod', 'body');
                } else {
                    modOptions = qsa(elt, 'unit-mod');
                }
                // Filter them down.
                var excludeTags = UnitGenerator.ExcludeTags.get(elt) || [];
                var existing = UnitGenerator.ModTags.get(unit);
                excludeTags.extendNoMove(existing);
                var availableMods = modOptions.filter(function(mod) {
                    // If there's any intersection our existing tags and this set of tags,
                    // we want to skip it.
                    return !(UnitGenerator.ModTags.get(mod) || []).findFirst(function(tag) {                        
                        return excludeTags.includes(tag);
                    });
                });
                if (availableMods.length == 0) return;
                // Choose one.                
                var modifier = UnitGenerator._rng.randomValue(availableMods);

                // Extend tags so we don't get duplicate tags.
                var modTags = UnitGenerator.ModTags.get(modifier) || [];
                existing.extend(modTags);
                UnitGenerator.ModTags.set(unit, existing);
        
                Unit.applyModifier(unit, modifier);
            },
            'choose': function(elt) {
                var choice;
                if (UnitGenerator.Fn.has(elt)) {
                    var params = (UnitGenerator.Params.get(elt) || []).map(function(key) {
                        return defs[key];
                    });
                    params.unshift(elt);
                    params.unshift(unit);
                    choice = UnitGenerator.Fn.aInvoke(elt, params);
                } else if (UnitGenerator.Choices.has(elt)) {
                    var choices = UnitGenerator.Choices.get(elt);
                    choice = UnitGenerator._rng.randomValue(choices);
                }
                var result = qs(elt, 'result[value="' + choice + '"]');
                if (!result) {
                    result = qs(elt, 'result[default="true"]');
                }
                if (result && result.firstElementChild) {
                    return result.firstElementChild;
                }
            },
            'stats': function(elt) {
                var baseStats = qs(unit, 'base-stats');
                a(elt.attributes).forEach(function(attr) {
                    baseStats.setAttribute(attr.name, attr.value);
                });
            }
        };

        DomScript.execute(script, operations);

        return unit;
    }
}
WoofRootController.register(UnitGenerator);

class DamageTypes {
    static MELEE = '⚔️';
    static THROWN = '⚾';
    static RANGED = '🏹';
    static MAGIC = '☄️';

    static COLLISION = '💥';

}

class PlayerUnits {
    static _generateNames(elt) {
        var runInfo = RunInfo.find(elt);
        var workspace = qs(runInfo, 'workspace');
        // We've got names already.
        if (qs(workspace, 'name-option')) return;
        var optionsHolder = bf(elt, 'name-options', 'body').cloneNode(true);
        Utils.moveChildren(optionsHolder, workspace);    
    }

    static Alias = new ScopedAttr("alias", StringAttr);
    static Value = new ScopedAttr("value", StringAttr);
    static Values = new ScopedAttr("values", ListAttr);
    static Data = new ScopedAttr("data", BlobAttr);
    static _generateDemographics(elt) {
        var runInfo = RunInfo.find(elt);
        var workspace = qs(runInfo, 'workspace');
        if (qs(workspace, 'player-demographic')) return;
        var axes = bfa(elt, 'player-demographics > def', 'body');
        var template = bf(elt, 'player-demographics > template[name="demographic"]', 'body');

        var results = [{}]
        var workingSet = [];
        axes.forEach(function(axis) {
            var alias = PlayerUnits.Alias.get(axis);
            PlayerUnits.Values.get(axis).forEach(function(value) {
                results.forEach(function(existing) {
                    var thing = {};
                    thing[alias] = value;
                    workingSet.push(Object.assign(thing, existing));
                });
            });

            results = workingSet;
            workingSet = [];
        });

        results.forEach(function(result) {
            var obj = Templates.inflateIn(template, workspace, {})
            PlayerUnits.Data.set(obj, result);
        });
    }

    static TakeName(unit, elt, rng) {
        var runInfo = RunInfo.find(elt);
        var workspace = qs(runInfo, 'workspace');
        PlayerUnits._generateNames(elt);
        var options = qsa(workspace, 'name-option');
        var option = rng.randomValue(options);
        option.remove();

        return PlayerUnits.Value.get(option);
    }

    static TakeDemographic(unit, elt, rng) {
        var runInfo = RunInfo.find(elt);
        var workspace = qs(runInfo, 'workspace');
        PlayerUnits._generateDemographics(elt);
        var options = qsa(workspace, 'player-demographic');
        var option = rng.randomValue(options);
        // No longer an option.
        option.remove();

        return PlayerUnits.Data.get(option);
    }

    static ApplyDemographic(unit, elt, demographic) {
        Unit.Month.findSetAll(unit, demographic.month);
        Unit.Day.findSetAll(unit, demographic.day);
        Unit.Appearance.findSetAll(unit, demographic.appearance);
    }

    static MonthFromDemographic(unit, elt, demographic) {
        return demographic.month;
    }

    static DemographicString(unit, elt, demographic) {
        return demographic.appearance + demographic.month + demographic.day;
    }

    
    static _day_wombo = {
        "🌕": ["🌔", "🌕", "🌖"],
        "🌖": ["🌕", "🌖", "🌗"],
        "🌗": ["🌖", "🌗", "🌘"],
        "🌘": ["🌗", "🌘", "🌑"],
        "🌑": ["🌘", "🌑", "🌒"],
        "🌒": ["🌑", "🌒", "🌓"],
        "🌓": ["🌒", "🌓", "🌔"],
        "🌔": ["🌓", "🌔", "🌕"]
    };
    static ApplyLegacyCombo(unit, elt) {
        var month = Unit.Month.findGet(unit);
        var day = Unit.Day.findGet(unit);

        var comboOthers = PlayerUnits._day_wombo[day].clone();
        comboOthers.push(month);

        var comboSelf = [month, day];

        Unit.ComboSelf.set(unit, comboSelf);
        Unit.ComboWith.set(unit, comboOthers);
        Mana.Attr.set(unit, month);
    }

}
WoofRootController.register(PlayerUnits);



class Units {
    static SetName(unit, elt, name) {
        Unit.setName(unit, name);
    }

    static __nameCounter = 0;

    static _front_row = ["F1", "F2", "F3"];
    static _middle_row = ["M1", "M2", "M3"];
    static _back_row = ["B1", "B2", "B3"];

    static _hero_emojis = ["🤩","😗","😀","😁","🤣","🙃","😉","😜","🤑","🤐","😑","😬","😴","🤮","😵","🤠","🤓","🧐","😱","🐱"];
    static _birthday_months = ["🔥","🌪️","💧","⛰️"];
    static _no_birthday_month = "";
    static _birthday_days = ["🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌕"];
    static _no_birthday_day = "";

    static UnitLabel = new ScopedAttr("unit-label", StringAttr);


    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Event, NC.Unit);

    static __unit(innerFn) {
        return function(root) {            
            var unit = innerFn(root);
            // Increment our unit counter.
            NoiseCounters.inc(NC.Unit);
            // Invaldate our RNG to reset it between units.
            Units._rng.invalidate();
            return unit;
        }
    }

    /** TODO: Rewrite this eventually. */
    static randomVisitor = Units.__unit(function(rootElt) {
        var demo = PlayerUnits.TakeDemographic(null, rootElt, Units._rng);
        demo.name = PlayerUnits.TakeName(null, rootElt, Units._rng);
        return demo;
    });
}
WoofRootController.register(Units);
