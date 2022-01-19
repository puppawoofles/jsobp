class UnitGenerator {
    static _rng = new SRNG(NC.Seed, true, NC.Day, NC.Event, NC.Unit);
    static getRng = function() { return UnitGenerator._rng; }

    static Alias = new ScopedAttr("alias", StringAttr);
    static Value = new ScopedAttr("value", StringAttr);
    static Fn = new ScopedAttr("fn", FunctionAttr);
    static Params = new ScopedAttr("params", ListAttr);
    static FromGroup = new ScopedAttr("from-group", StringAttr);
    static Choices = new ScopedAttr("choices", ListAttr);
    static ModTags = new ScopedAttr("mod-tags", ListAttr);

    static generate(name, defs) {
        // This is basically a tree-traversal to generate the whole thing.
        var script = qs(document, 'unit-gen[name="' + name + '"]');
        defs = defs || {}; // Normalize.
        var unit = Templates.inflate('unit', {
            UNIT_ID: Utils.UUID()
        });

        var currentNode = [script.firstElementChild];

        // Defined here for easy access to defs, unit, currentNodes
        var operations = {
            'unit': function(elt) {
                // Apply a unit blueprint.
                var bp = Blueprint.resolve(elt);
                Unit.applyBlueprint(unit, bp);
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
                var existing = UnitGenerator.ModTags.get(unit) || [];
                var availableMods = modOptions.filter(function(mod) {
                    // If there's any intersection our existing tags and this set of tags,
                    // we want to skip it.
                    return !(UnitGenerator.ModTags.get(mod) || []).findFirst(function(tag) {                        
                        return existing.includes(tag);
                    });
                });
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
                    currentNode.push(result.firstElementChild)
                }
            }
        };

        while (currentNode.length > 0) {
            var idx = currentNode.length - 1;
            var current = currentNode.splice(idx, 1)[0];
            if (current.nextElementSibling) {
                currentNode.push(current.nextElementSibling);
            }
            for (var [key, value] of Object.entries(operations)) {
                if (current.matches(key)) {
                    value(current);
                }
            }
        }

        // Things that are not correctly set, but it's bedtime:
        // Unit.mana
        // Unit.hpTracker.max, value (can I make progress::after content: attr(current) '/' attr(max) work?)
        // Unit.info.base_damage and Unit.info.base_defense

        // TODO: Do some cleanup around mana and combo-with stuff.
        // But otherwise this seems to work?

        return unit;
    }
}
WoofRootController.register(UnitGenerator);

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

    static _all_units = [];
    static _all_names = [];

    static _unit_basic_attacks = ["strike", "throw", "shoot"];

    static _unit_skills = {
        "🔥": ["bleed", "sunder"],
        "🌪️": ["push", "wind-gust"],
        "💧": ["distract"],
        "⛰️": ["defend", "protect"]
    };

    static _rng = new SRNG(NC.Seed, true, NC.Day, NC.Event, NC.Unit);

    static _generate_birthdays() {
        var returnMe = [];
        for (var i = 0; i < Units._birthday_days.length; i++) {
            for (var j = 0; j < Units._birthday_months.length; j++) {
                returnMe.push({
                    month: Units._birthday_months[j],
                    day: Units._birthday_days[i]
                });
            }
        }
        return returnMe;
    }
    static _visitors_birthdays = Units._generate_birthdays();

    static _generate_units() {
        if (Units._all_units.length > 0) {
            return;
        }

        for (var i = 0; i < Units._hero_emojis.length; i++) {
            for (var j = 0; j < Units._birthday_months.length; j++) {
                for (var k = 0; k < Units._birthday_days.length; k++) {
                    Units._all_units.push([Units._hero_emojis[i], Units._birthday_months[j], Units._birthday_days[k]]);            
                }       
            }    
        }
        
        Units._all_names = qsa(document, 'name-option').map(function(elt) {
            return elt.getAttribute('value');
        });
    }

    static _determine_wombo(month, day) {
        var returnMe = [month];
        var dayWombo = Units._day_wombo[day];
        if (dayWombo) {
            returnMe = returnMe.concat(dayWombo);
        }
        return returnMe;
    }

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

    static randomVisitor = Units.__unit(function(rootElt) {
        var birthday = Units._rng.randomValueR(Units._visitors_birthdays);
        birthday.name = Units._rng.randomValueR(Units._all_names);
        return birthday;
    });

    static Name = new ScopedAttr("name", StringAttr);
    static sample_hero = Units.__unit(function (rootElt) {
        Units._generate_units();

        var idx = Units._rng.nextIdx(Units._all_units);
        var deets = Units._all_units.splice(idx, 1)[0];
        var matcher = deets[0] + deets[1] + deets[2];
        var matched = Utils.bfind(rootElt, 'body', 'silly-unit[matcher="' + matcher + '"]');
        var name;
        if (!!matched) {
            name = Units.Name.get(matched);
        } else {
            name = Units._rng.randomValueR(Units._all_names);
        }

        var unit = Unit.inflate({
            name: name,
            icon: deets[0],
            month: deets[1],
            day: deets[2],
            baseDamage: 8,
            baseDefense: 6,
            combo_self: [deets[1], deets[2]],
            wombo_combo: Units._determine_wombo(deets[1], deets[2]),
            hp: 40
        });

        // Weighted to 4 and 5, but 3 and 6 can happen.
        var volley_options = [3, 4, 4, 4, 5, 5, 5, 6];
        var script = Unit._findScript(unit);

        // Generate 2 abilities.
        var abilities = Units.generateAbilitySlots(2, volley_options);
        var skills = [
            Units._rng.randomValue(Units._unit_basic_attacks),
            Units._rng.randomValue(Units._unit_skills[deets[1]]),
        ];

        Ability.applySkill(rootElt, abilities[0], Units._rng.randomValueR(skills));
        Ability.applySkill(rootElt, abilities[1], skills[0]);

        abilities.forEach(function(a) {
            script.appendChild(a);
        });

        TeamAttr.set(unit, Teams.Player);

        return unit;
    });

    static barricade(rootElt) {
        var unit = Unit.inflate({
            name: "Barricade",
            icon: "🧱",
            month: Units._no_birthday_day,
            day: Units._no_birthday_month,
            baseDamage: 0,
            baseDefense: 20,
            mass: 20,
            hp: 30
        });

        TeamAttr.set(unit, Teams.Neutral);
        Unit.Ephemeral.set(unit, true);
        Unit.Construct.set(unit, true);
        
        BaseStatus.ForbiddenStatus.set(unit, ["agility", "bleed"]);

        return unit;
    }

    static rat = Units.__unit(function(rootElt) {
        var unit = Unit.inflate({
            name: "Rat",
            icon: "🐀",
            month: Units._no_birthday_day,
            day: Units._no_birthday_month,
            baseDamage: 2,
            baseDefense: 2,
            hp: 30
        });

        var script = Unit._findScript(unit);

        var firstAbility = Units.generateAbilitySlots(1, [3, 4, 5, 6], [Activations.front_row])[0];
        var secondAbility = Units.generateAbilitySlots(1, [3, 4, 5, 6].filter(function(a) {
            return a != Ability.volley(firstAbility);
        }), [Activations.rows(false, true, true)])[0];

        Ability.applySkill(rootElt, firstAbility, "strike");
        Ability.applySkill(rootElt, secondAbility, "scurry");

        script.appendChild(firstAbility);
        script.appendChild(secondAbility);

        Units.UnitLabel.set(unit, "rat");

        return unit;
    });
    

    static golem = Units.__unit(function(rootElt) {
        var unit = Unit.inflate({
            name: "Golem",
            icon: "🗿",
            month: "⛰️",
            day: Units._no_birthday_month,
            baseDamage: 12,
            baseDefense: 12,
            hp: 60,
            combo_self: ["⛰️"],
            wombo_combo: ["⛰️"]
        });

        var script = Unit._findScript(unit);

        var firstAbility = Units.generateAbilitySlots(1, [1], [Activations.rows(true, true, true)])[0];
        var secondAbility = Units.generateAbilitySlots(1, [5, 6, 7], [Activations.rows(true, false, false)])[0];
        var thirdAbility = Units.generateAbilitySlots(1, [8], [Activations.rows(false, true, true)])[0];

        Ability.applySkill(rootElt, firstAbility, "defend");
        Ability.applySkill(rootElt, secondAbility, "strike");
        Ability.applySkill(rootElt, thirdAbility, "mindlessmarch");

        script.appendChild(firstAbility);
        script.appendChild(secondAbility);
        script.appendChild(thirdAbility);

        // Golems have no blood.  You're welcome, Jake.
        BaseStatus.ForbiddenStatus.set(unit, ["agility", "bleed"]);
        return unit;
    });


    static jimmyTheRatKing = Units.__unit(function(rootElt) {
        var jimmy = Unit.inflate({
            name: "Jimmy the Rat King",
            icon: "🤴",
            month: "💀",
            day: Units._no_birthday_month,
            baseDamage: 8,
            baseDefense: 8,
            hp: 80,
            combo_self: ["💀"],
            wombo_combo: ["💀"]
        });
        var script = Unit._findScript(jimmy);

        var firstAbility = Units.generateAbilitySlots(1, [1])[0];
        var secondAbility = Units.generateAbilitySlots(1, [2, 3, 4])[0];
        var thirdAbility = Units.generateAbilitySlots(1, [5, 6, 7])[0];
        var fourthAbility = Units.generateAbilitySlots(1, [8])[0];

        Ability.applySkill(rootElt, firstAbility, "rat-redirect");
        Ability.applySkill(rootElt, secondAbility, "summon-rats");
        var cooldown = Ability.CooldownDuration.findGet(secondAbility);
        Ability.CooldownDuration.set(cooldown, 12); // Make this a little longer.
        Ability.applySkill(rootElt, thirdAbility, "shoot");
        Ability.applySkill(rootElt, fourthAbility, "scurry");

        script.appendChild(firstAbility);
        script.appendChild(secondAbility);
        script.appendChild(thirdAbility);
        script.appendChild(fourthAbility);

        Units.UnitLabel.set(jimmy, "jimmy");

        return jimmy;
    });

    static generateAbilitySlots(count, volley_options) {
        var abilities = [];
        var abilities_by_volley = {};
        while (abilities.length < count) {
            var volley = Units._rng.randomValue(volley_options);
            if (!abilities_by_volley[volley]) {
                var ability = Ability.inflate({
                    volley: volley
                });
                // Generate an ID.
                IdAttr.generate(ability);
                abilities_by_volley[volley] = ability;
                abilities.push(ability);
            }
        }

        abilities.sort(function (a, b) {
            return Ability.volley(a) - Ability.volley(b);
        })

        return abilities;
    }
}
WoofRootController.register(Units);
