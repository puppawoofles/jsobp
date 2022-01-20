
class CurrentHPAttr {}
Utils.classMixin(CurrentHPAttr, IntAttr, "value");

class MaxHPAttr {}
Utils.classMixin(MaxHPAttr, IntAttr, "max");

class Unit {
    static TargetLocation = new ScopedAttr('target-location', StringAttr);
    static Stopped = new ScopedAttr('stopped', BoolAttr);
    static ComboWith = new ScopedAttr('combo-with', ListAttr);
    static ComboSelf = new ScopedAttr('combo-self', ListAttr);
    static PreventCombo = new ScopedAttr('prevent-combo', ListAttr);
    static Month = new ScopedAttr('month', StringAttr);
    static Day = new ScopedAttr('day', StringAttr);
    static Appearance = new ScopedAttr('appearance', StringAttr);
    static Name = new ScopedAttr('name', StringAttr);

    static MaxItems = new ScopedAttr("max-items", IntAttr);

    static Ephemeral = new ScopedAttr("ephemeral", BoolAttr);
    static Construct = new ScopedAttr("construct", BoolAttr);

    static BaseDamage = new ScopedAttr('base-damage', IntAttr);
    static BaseDefense = new ScopedAttr('base-defense', IntAttr);
    static Mass = new ScopedAttr('mass', IntAttr);

    static HoverOnUnit = new ScopedAttr("hover-on-unit", StringAttr);
	static CellBlock = new ScopedAttr("in-block", StringAttr);

    static findById(parent, id) {
        return qs(parent, "[wt~='Unit'][w-id='" + id + "']");
    }

    static getName(unit) {
        return Unit.Name.findGet(unit);
    }

    static statusContainer(unit) {
        return qs(unit, ".unit_status");
    }

    static findAllByTeam(parent, team) {
        return qsa(parent, "[wt~='Unit'][team='" + team + "']");
    }

    static _findScript(base) {
        return qs(base, ".unit_script");
    }

    static baseDamage(unit) {
        return Unit.BaseDamage.findGet(unit);
    }

    static setBaseDamage(unit, value) {
        var elt = Unit.BaseDamage.find(unit);
        Unit.BaseDamage.set(elt, value);
    }

    static adjustBaseDamage(unit, delta) {
        Unit.setBaseDamage(unit, Unit.baseDamage(unit) + delta);
    }

    static baseDefense(unit) {
        return Unit.BaseDefense.findGet(unit);
    }

    static setBaseDefense(unit, value) {
        var elt = Unit.BaseDefense.find(unit);
        Unit.BaseDefense.set(elt, value);
    }

    static adjustBaseDefense(unit, delta) {
        Unit.setBaseDefense(unit, Unit.baseDefense(unit) + delta);
    }

    static mass(unit) {
        return Unit.Mass.findGet(unit);
    }

    static cloneAppearance(unit) {
        return qs(unit, ".appearance").cloneNode(true);
    }

    static Defend = new ScopedAttr("defend", IntAttr);
    static Vulnerable = new ScopedAttr("vulnerable", BoolAttr);

    static setDefend(unit, stacks) {
        var defend = qs(unit, ".defend");
        if (!stacks) {
            Unit.Defend.set(defend);
            Unit.Vulnerable.set(defend, false);
            return;
        }
        Unit.Vulnerable.set(defend, stacks < 0);
        Unit.Defend.set(defend, Math.abs(stacks));
        if (stacks > 0) {
            UiTreatments.wub(unit, "🛡️");
        }
    }

    static capacitySize(unit) {
        if (Unit.Ephemeral.get(unit) || Unit.Construct.get(unit)) return 0;
        return 1; // TODO: Big units might be neat.
    }

    static findAllInBlock(cellBlock) {
        var coords = BigCoord.extract(cellBlock);
        var selector = BigCoord.selector(coords);
        return qsa(BattlefieldHandler.find(cellBlock), selector + "[wt~='Unit']");
    }
    
    static findTeamInBlock(cellBlock, team) {
        return Unit.findAllInBlock(cellBlock).filter(function(unit) {
            return TeamAttr.get(unit) == team;
        });
    }

    static reduceHP(unit, byAmount) {
        var hpBar = qs(unit, 'progress[wt~="HPBar"]');
        var current = CurrentHPAttr.get(hpBar);
        current = Math.max(0, current - byAmount);
        CurrentHPAttr.set(hpBar, current);
    }

    static currentHP(unit) {
        var hpBar = qs(unit, 'progress[wt~="HPBar"]');
        return CurrentHPAttr.get(hpBar);
    }

    static maxHP(unit) {
        var hpBar = qs(unit, 'progress[wt~="HPBar"]');
        return MaxHPAttr.get(hpBar);
    }

    static setMaxHP(unit, value) {
        var hpBar = qs(unit, 'progress[wt~="HPBar"]');
        return MaxHPAttr.set(hpBar, value);
    }

    static setCurrentHP(unit, value) {
        var hpBar = qs(unit, 'progress[wt~="HPBar"]');
        var hp = Math.min(value, Unit.maxHP(unit));
        return CurrentHPAttr.set(hpBar, hp);
    }

    static heal(unit, amount) {
        if (amount <= 0) return;
        Unit.setCurrentHP(unit, Math.min(Unit.currentHP(unit) + amount, Unit.maxHP(unit)));
    }

    static setTargetLocation(unit, cellOrLabel) {
        if (typeof cellOrLabel !== 'string') {
            cellOrLabel = SmallGridLabel.get(cellOrLabel);
        }

        Unit.TargetLocation.set(unit, cellOrLabel);
    }

    static getTargetLocation(unit) {
        return Unit.TargetLocation.get(unit);
    }

    static setStopped(unit, bool) {
        Unit.Stopped.set(unit, bool);
    }

    static getStopped(unit) {
        return Unit.Stopped.get(unit);
    }

    static getPreferredLocations(unit) {
        var abilities = WoofType.queryAll(unit, "Ability");
        var preferredCells = {};

        for (var i = 0; i < abilities.length; i++) {
            var ability = abilities[i];
            var activeIn = ActiveInAttr.get(ActiveInAttr.find(ability));
            if (Ability.hasSkill(ability)) {
                for (var j = 0; j < activeIn.length; j++) {
                    preferredCells[activeIn[j]] = true;
                }
            }
        }

        return Object.keys(preferredCells);
    }

    static retreat(unit) {
        // Remove statuses.
        var status = UnitStatus.findAll(unit);
        status.forEach(function(s) {
            var type = UnitStatus.getType(s);
            // Remove the real way.
            BaseStatus.Remove(type, unit, s);
        });
        WoofType.remove(unit, "GhostUnit");

        // Remove taunts.
        Unit.CurrentTaunt.clear(unit);
        Unit.TauntList.clear(unit);
        Unit.CellBlock.set(unit);

        // Remove extra junk.
        Unit.setDefend(unit, 0);

        // Remove extra blueprints.
        AbilityBlueprint.findAll(unit).filter(function(blueprint) {
            return !AbilityBlueprint.Base.get(blueprint);
        }).forEach(function(bp) {
            bp.remove();
        });

        // Refresh abilities.
        var abilities = Ability.findAll(unit);
        abilities.forEach(function(ability) {
            // Reset cooldown muckery to whatever the warmup time is.
            var warmupElt = Ability.WarmupTime.find(ability);
            Ability.CurrentCooldown.set(warmupElt, Ability.WarmupTime.get(warmupElt));

            // Refresh.
            Ability.__refresh(ability, ability);
        });

        // Sort abilities by volley count.
        abilities.sort(function(a, b) {
            return Ability.VolleyCount.findGet(a) - Ability.VolleyCount.findGet(b);
        }).forEach(function(a) {
            a.parentNode.appendChild(a);
        });

        unit.remove();
        return unit;
    }


    static comboWith(thisUnit, thatUnit) {
        // No self-combos.
        if (thisUnit === thatUnit) return false;
        // Prevent combos if we have this status.
        if (Unit.PreventCombo.size(thisUnit) > 0) return false;
        if (Unit.PreventCombo.size(thatUnit) > 0) return false;
        var comboTags = Unit.ComboWith.get(thatUnit);
        for (var i = 0; i < comboTags.length; i++) {            
            if (thisUnit.matches(Unit.ComboSelf.buildSelector(comboTags[i]))) {
                return true;
            }
        }
        return false;
    }

    static onField(unit) {
        return !!BattlefieldHandler.findUp(unit);
    }

    static Active = new ScopedAttr("active", BoolAttr);
    static Inactive = new ScopedAttr("inactive", BoolAttr);
    static Used = new ScopedAttr("used", BoolAttr); 
    static BeforeUseAbility = GameEffect.handle(function(handler, effect, params) {
        for (var i = 0; i < params.components.length; i++) {
            var ability = params.components[i].ability;
            Unit.Active.set(ability, true);
        }
    });

    static AfterUseAbility = GameEffect.handle(function(handler, effect, params) {
        for (var i = 0; i < params.components.length; i++) {
            var ability = params.components[i].ability;
            Unit.Active.set(ability, false);
            Unit.Used.set(ability, true);
        }
    });

    static ActiveInFn = new ScopedAttr("active-in-fn", FunctionAttr);
    static ActiveIn = new ScopedAttr("active-in", ListAttr);
    static HoverHelp = new ScopedAttr("hover-help", StringAttr);
    static UpdateAbilityInactive(unit) {
        var abilities = WoofType.queryAll(unit, "Ability");
        for (var i = 0; i < abilities.length; i++) {
            var ability = abilities[i];
            var bp = Ability.findSkillFor(ability);
            var active = Unit.ActiveInFn.invoke(bp, bp, ability);
            Unit.Inactive.set(ability, !active);

            // Calculate HoverHelp if necessary.
            Ability.refreshHoverHelp(ability);
        }
    }

    static OnCellBlockFacingChange(event, handler) {
        Unit.findAllInBlock(event.target).forEach(Unit.UpdateAbilityInactive);        
    }
    
    // Mark abilities inactive[true|false], respectively.
    static OnUnit(event, handler) {
        var unit = event.detail.unit;
        if (!unit) {
            if (WoofType.has(handler, "Unit")) {
                unit = handler;
            }
        }
        if (!unit) {
            throw boom("Unable to find unit.");
        }
        Unit.UpdateAbilityInactive(unit);
    }


    // Note that this includes the other team so we can separately
    // track taunt on neutral targets (like a barricade).
    static TauntList = new ScopedAttr("taunt-list", ListAttr);
    static CurrentTaunt = new ScopedAttr("current-taunt", ListAttr);
    static hasTaunt(unit, forTeam) {
        return Unit.CurrentTaunt.has(unit, forTeam);
    }

    static setTaunt(unit, forTeam) {
        // Remove it so it retriggers our handler.
        if (Unit.TauntList.has(unit, forTeam)) {
            Unit.TauntList.remove(unit, forTeam);
        }
        Unit.TauntList.add(unit, forTeam);
    }

    // Private handler that's used to ensure that only one unit
    // for a given team is taunted within a block.
    static setCurrentTaunt(unit, forTeam, value) {
        if (value) {
            Unit.CurrentTaunt.add(unit, forTeam);
        } else {
            Unit.CurrentTaunt.remove(unit, forTeam, true);
        }
    }

    static OnTauntPriorityChange(event, handler) {
        // We want to find the lead taunted units for each of our teams.
        var value = Unit.TauntPriority.get(event.target).map(function(v) {
            return v.split(":");
        });
        var bigCoordSelector = BigCoord.selector(BigCoord.extract(event.target));
        var teams = Teams.allTeams();
        var tauntedUnitsByTeam = teams.map(function(t) {
            for (var i = 0; i < value.length; i++) {
                if (value[i][0] == t) {
                    return value[i];
                }
            }
            return null;
        }).filter(function(f) { return !!f; }).toObject(function(blorb) {
            return blorb[0];
        }, function(blorb) {
            return Unit.findById(handler, blorb[1]);
        });

        for (var [team, unit] of Object.entries(tauntedUnitsByTeam)) {
            var selector = bigCoordSelector + Unit.CurrentTaunt.buildSelector(team);
            var current = Utils.bfind(unit, '[wt~=Battlefield]', selector);
            if (current != unit) {
                if (current != null) {
                    Unit.setCurrentTaunt(current, team, false);
                }
                Unit.setCurrentTaunt(unit, team, true);
            }
        }

        // Lastly, we want to refresh our activations.
        Unit.findAllInBlock(event.target).filter(function(unit) {
            return TeamAttr.matches(unit, event.target);
        }).forEach(Unit.UpdateAbilityInactive);
        
    }

    static TauntPriority = new ScopedAttr('taunt-priority', ListAttr);
    static OnTauntListChange(event, handler) {
        var unit = event.target;
        var unitId = IdAttr.generate(unit);
        var block = CellBlock.findByContent(unit);
        var diff = Utils.diffSpaceLists(event.detail.oldValue, event.detail.newValue);
        var toRemove = diff.removed;
        toRemove.extend(diff.added.clone());
        var toAdd = diff.added;

        var existing = Unit.TauntPriority.get(block);

        toRemove.forEach(function(team) {
            var record = team + ":" + unitId;
            if (existing.includes(record)) {
                var index = existing.indexOf(record);
                existing.splice(index, 1)[0];
            }
        });

        toAdd.forEach(function(team) {
            var record = team + ":" + unitId;
            existing.unshift(record);
        });
        Unit.TauntPriority.set(block, existing);
    }

    static onUnitRemoved(event, handler) {
        // Reset taunt keys.
        var unit = event.detail.unit;
        var id = IdAttr.generate(unit);
        var tauntKeys = Unit.TauntList.get(unit).map(function(team) {
            return team + ":" + id;
        });
        var blockHints = [];
        tauntKeys.forEach(function(key) {
            var block = Utils.bfindAll(handler, 'body', Unit.TauntPriority.buildSelector(key));            
            block.forEach(function(b) {
                blockHints.push(b);
                Unit.TauntPriority.remove(b, key);
            });
        });

        // Invalidate any cell blocks we're aware of to reset CC activations.
        if (Unit.CellBlock.has(unit)) {
            blockHints.push(CellBlock.findByLabel(handler, Unit.CellBlock.get(unit)));
        }
        blockHints.forEach(function(block) {
            Unit.findAllInBlock(block).forEach(Unit.UpdateAbilityInactive);
        });
    }

    static moveThroughCost(unit, forTeam) {
        if (TeamAttr.get(unit) == forTeam) return 0;
        return 1;
    }

    /**
     * Fired when an enemy moves which block it's in.
     */
    static onMoveBlock(event, handler) {
        var oldLabel = event.detail.oldValue;
        var newLabel = event.detail.newValue;

        if (oldLabel) {
            var block = CellBlock.findByLabel(handler, oldLabel);
            Unit.findAllInBlock(block).forEach(Unit.UpdateAbilityInactive);
        }
        if (newLabel) {
            var block = CellBlock.findByLabel(handler, newLabel);
            Unit.findAllInBlock(block).forEach(Unit.UpdateAbilityInactive);
        }
    }

    static RefreshAppearance(event, handler) {
        if (event.target != handler) return;

        Unit.Month.copy(qs(handler, ".month"), handler);
        Unit.Day.copy(qs(handler, ".day"), handler);
        Unit.Appearance.copy(qs(handler, ".avatar"), handler);
    }

    static isDead(unit) {
        return Unit.currentHP(unit) == 0;
    }

    static addToInventory(unit, item) {
        var inventory = qs(unit, 'inventory');
        Card.ForUnit.set(item, IdAttr.generate(unit));
        inventory.appendChild(item);
    }

    /** Helper for removing ghostiness. */
    static affect(unit, fn) {
        WoofType.remove(unit, "GhostUnit");
        if (!fn) return;
        var args = a(arguments).splice(2);
        fn.apply(this, args);
    }

    static Damage = new ScopedAttr("damage", IntAttr);
    static Defense = new ScopedAttr("defense", IntAttr);
    static Cunning = new ScopedAttr("cunning", IntAttr);
    static Move = new ScopedAttr("move", IntAttr);
    static Mass = new ScopedAttr("mass", IntAttr);
    static applyBlueprint(unit, bp) {
        var elt = bp;
        // Apply the blueprint here.
        bp = bp.cloneNode(true);
        qs(unit, WoofType.buildSelector('UnitBP')).appendChild(bp);

        Unit.Appearance.findGetCopySetAll(bp, unit);
        Unit.Month.findGetCopySetAll(bp, unit);
        Unit.Day.findGetCopySetAll(bp, unit);

        var inventory = qs(bp, 'has-inventory');
        if (inventory) {
            Unit.MaxItems.copy(inventory, qs(unit, 'inventory'));
        }
        var combos = qs(bp, 'has-combos');
        if (combos) {
            Unit.MaxItems.copy(combos, qs(unit, 'combos'))
        }
    }

    static Ordinal = new ScopedAttr("ordinal", IntAttr);

    static applyModifier(unit, modifier) {
        // Apply the modifier here.
        qsa(modifier, 'slot').forEach(function(slotElt) {
            var ability = Ability.inflate({
                volley: Unit.Ordinal.findGet(slotElt)
            });
            // Generate an ID.
            IdAttr.generate(ability);
            Ability.Type.findGetCopySetAll(slotElt, ability);

            // TODO: When you rewrite ability/skill stuff to use the same
            // blueprint system everyone else does, remember this spot.
            var skill = Blueprint.find(slotElt, 'skill');
            if (skill) {
                Ability.applySkill(modifier, ability, skill.getAttribute('name'));
            }

            Unit._findScript(unit).appendChild(ability);
        });

        // Add our modifier to our list of mod blueprints.
        qs(unit, WoofType.buildSelector('ModBP')).appendChild(modifier.cloneNode(true));
    }

    static setName(unit, name) {
        Unit.Name.set(qs(unit, '.name[name]'), name);
    }
}
WoofRootController.register(Unit);
Utils.classMixin(Unit, AbstractDomController, {
    matcher: "[wt~=Unit]",
    template: "unit",
    params: function(config) {
        return {
            APPEARANCE: config.icon,
            NAME: config.name,
            MONTH: config.month,
            DAY: config.day,
            BASE_DAMAGE: config.baseDamage,
            BASE_DEFENSE: config.baseDefense || config.baseDamage,
            MASS: config.mass || Math.floor((config.baseDamage + (config.baseDefense || config.baseDamage)) / 2),
            HP_AMOUNT: config.hp || 30,
            UNIT_ID: config.id || Utils.UUID()
        };
    },
    decorate: function(elt, config) {
        if (config.wombo_combo) {
            Unit.ComboWith.put(elt, config.wombo_combo);
        }
        if (config.combo_self) {
            Unit.ComboSelf.put(elt, config.combo_self);
        }
    }
});

class VolleyCountAttr {
    static lowestAtLeast(handler, value) {
        var volley = null;
        VolleyCountAttr.findAll(handler).forEach(function(elt) {
            var volleyCount = VolleyCountAttr.get(elt);
            if (volleyCount >= value && (volley === null || volley > volleyCount)) {
                volley = volleyCount;
            }
        });
        return volley;
    }
}
Utils.classMixin(VolleyCountAttr, IntAttr, "volley_count");

class ForUnitAttr {}
Utils.classMixin(ForUnitAttr, StringAttr, "for-unit");

class LabelAttr {}
Utils.classMixin(LabelAttr, StringAttr, "label");

class ActiveInAttr {}
Utils.classMixin(ActiveInAttr, ListAttr, "active-in");

class SkillAttr {}
Utils.classMixin(SkillAttr, StringAttr, "skill");

class InvokeFunctionAttr {}
Utils.classMixin(InvokeFunctionAttr, FunctionAttr, "invoke-fn");

class TargetFunctionAttr {}
Utils.classMixin(TargetFunctionAttr, FunctionAttr, 'target-fn');

class SlotTypes {
    static Primary = "☝";
    static Secondary = "✌";
    static Learned = "⭐";
}

class Ability {
    static Label = new ScopedAttr("label", StringAttr);
    static ShortLabel = new ScopedAttr("short-label", StringAttr);
    static Type = new ScopedAttr("type", StringAttr);
    static ActiveIn = new ScopedAttr("active-in", ListAttr);
    static VolleyCount = new ScopedAttr("volley_count", IntAttr);
    static OgVolleyCount = new ScopedAttr("og_volley_count", IntAttr);
    static Skill = new ScopedAttr("skill", StringAttr);
    static GivesCombo = new ScopedAttr("gives-combo", BoolAttr);
    static ReceivesCombo = new ScopedAttr("receives-combo", BoolAttr);

    // New Version Stuff
    static SlotType = new ScopedAttr("slot-type", StringAttr);

    // Cooldown stuff.
    static WarmupTime = new ScopedAttr("warmup-time", IntAttr);
    static CooldownDuration = new ScopedAttr("cooldown-duration", IntAttr);
    static CurrentCooldown = new ScopedAttr("current-cooldown", IntAttr);
    
    static volley(elt) {
        return VolleyCountAttr.get(qs(elt, "[volley_count]"));
    }

    static blueprintsContainer(elt) {
        return qs(elt, 'blueprints');
    }

    static labelElt(elt) {
        return qs(elt, ".label");
    }

    static label(elt) {
        return Ability.Label.get(Ability.labelElt(elt));
    }
    
    static findSkill(relativeTo, skillLookup) {
        return Utils.bfind(relativeTo, "body", "skill-blueprint[name='" + skillLookup + "']");        
    }

    static Fallback = new ScopedAttr("fallback", StringAttr);
    static findFallback(relativeTo, skillLookup) {
        var base = Ability.findSkill(relativeTo, skillLookup);
        if (Ability.Fallback.has(base)) {
            return Ability.findSkill(relativeTo, fallback);
        }
        return base;
    }
    
    static findSkillFor(ability) {
        var attr = Ability.Skill.get(ability);
        if (attr == null) return null;
        return Ability.findSkill(ability, attr);
    }

    static applySkill(rootElt, abilityElt, skillLookup) {
        var skill = Ability.findSkill(rootElt, skillLookup);
        if (skill) {
            var baseMod = AbilityBlueprint.findBase(abilityElt);
            if (!baseMod) {
                var container = Ability.blueprintsContainer(abilityElt);
                baseMod = AbilityBlueprint.inflateIn(container, {
                    isBase: true,
                    priority: 0,
                    skillName: "",
                    activation: []
                });
            }
            AbilityBlueprint.applySkill(baseMod, skill);
            Ability.__refresh(rootElt, abilityElt);
        }        
    }

    static HoverHelpRefresh(event, handler) {
        Ability.findAll(handler).forEach(Ability.refreshHoverHelp);
    }

    static refreshHoverHelp(abilityElt) {
        var activationInfo = Ability.ActiveIn.findGet(abilityElt);

        // We want to highlight grid cells where this ability can be used.
        // This will either be for a specific grid cell (if it's in one) or for
        // a category of grid cells (if it's not in one).

        var firstSelector = "";
        var inBlock = Unit.CellBlock.findUp(abilityElt);
        if (inBlock) {            
            firstSelector = BigGridLabel.buildSelector(Unit.CellBlock.get(inBlock));
        } else {
            var team = TeamAttr.findUp(abilityElt);
            if (!team) return; // Not in document yet, tomorrow problem.
            team = TeamAttr.get(team);
            firstSelector = TeamAttr.buildSelector(team);
        }

        var hoverHelpValue = activationInfo.map(function(pos) {
            return "[wt~=CellBlock]" + firstSelector + " " + Grid.EffectivePosition.buildSelector(pos);
        }).join(',');

        // Next up, we want to highlight any possible targets.
        Unit.HoverHelp.set(abilityElt, hoverHelpValue);
    }

    static __refresh(rootElt, abilityElt) {
        var highestMod = AbilityBlueprint.highestPriority(abilityElt);
        AbilityBlueprint.Base.copy(abilityElt, highestMod);
        if (!highestMod) {
            return;
        }
        var skill = AbilityBlueprint.getSkill(highestMod);
        if (Ability.ActiveIn.has(highestMod)) {
            var activationInfo = Ability.ActiveIn.find(abilityElt);
            Ability.ActiveIn.copy(activationInfo, highestMod);

            // Reset our hover help.
            Ability.refreshHoverHelp(abilityElt);
        }
        var skillBp = !!skill ? Ability.findSkill(rootElt, skill) : null;            
        SkillAttr.set(abilityElt, skill || undefined);
        var label = Ability.labelElt(abilityElt);
        if (skillBp) {
            Ability.Label.copy(label, skillBp);
            Ability.ShortLabel.copy(label, skillBp);     
            Ability.Type.set(abilityElt, Ability.Type.get(skillBp));
            Ability.GivesCombo.copy(abilityElt, skillBp);
            Ability.ReceivesCombo.copy(abilityElt, skillBp);
        } else {
            Ability.Label.set(label, '');
            Ability.ShortLabel.set(label, '');
            Ability.GivesCombo.set(abilityElt);
            Ability.ReceivesCombo.set(abilityElt);
        }
    }

    static addBlueprint(abilityElt, blueprintElt) {
        var container = Ability.blueprintsContainer(abilityElt);
        container.appendChild(blueprintElt);
        Ability.__refresh(abilityElt, abilityElt);
    }

    static isActive(ability, unit) {
        return !Unit.Inactive.get(ability);
    }

    static hasSkill(ability) {
        return !!SkillAttr.get(ability);
    }

    static shouldTriggerSkill(ability, unit) {
        return Ability.isActive(ability, unit) && Ability.hasSkill(ability);
    }

    static OnChange(event, handler) {
        var ability = Ability.findUp(handler);
        Ability.__refresh(ability, ability);
        WoofRootController.dispatchNativeOn(ability, 'Updated', {
			ability: ability
		});
    }

    static OnCooldownChange(event, handler) {
        if (handler == event.target) {
            return; // Don't handle this one.
        }
        Ability.updateCooldown(handler);
    }

    static updateCooldown(ability) {
        var below = Ability.WarmupTime.find(ability);
        Ability.CurrentCooldown.copy(ability, below);
    }

    static helpersThatComboWith(thisAbility, thatAbility) {
        return qsa(thatAbility, 'combo-helper[universal="true"], combo-helper[for-type="' + Ability.Type.get(thisAbility) + '"]');
    }

    static getActiveIn(ability) {
        return Ability.ActiveIn.get(qs(ability, ".activation_info"));
    }

    static TargetTravel = new ScopedAttr("target-travel", StringAttr);
    static getTargetTravel(bp) {
        return Ability.TargetTravel.get(bp) || null;
    }

    static Overhead = new ScopedAttr("target-overhead", BoolAttr);
    static getOverhead(bp) {
        return !!Ability.Overhead.get(bp);
    }
}
WoofRootController.register(Ability);
WoofRootController.addListeners('Updated');
Utils.classMixin(Ability, AbstractDomController, {
    matcher: "[wt~='Ability']",
    template: "ability",
    params: function(config) {
        return {
            VOLLEY: config.volley,
            SLOT_TYPE: config.slotType || SlotTypes.Learned
        };
    },
    decorate: function(elt, config) {
        Ability.updateCooldown(elt);
    }
});


class AbilityBlueprint {
    static _Name = new ScopedAttr("name", StringAttr);
    static _ActiveIn = new ScopedAttr("active-in", ListAttr);
    static SkillName = new ScopedAttr("skill_name", StringAttr);
    static Priority = new ScopedAttr("priority", IntAttr);
    static ActiveIn = new ScopedAttr("active-in", ListAttr);
    static Base = new ScopedAttr("base", BoolAttr);

    static findBase(elt) {
        return qs(elt, 'blueprint[base="true"]');
    }

    static applySkill(elt, skillBp) {
        AbilityBlueprint.SkillName.set(elt, AbilityBlueprint._Name.get(skillBp));
        AbilityBlueprint.ActiveIn.copy(elt, skillBp);
        Utils.clearChildren(elt);
        Utils.copyChildren(skillBp, elt);
    }

    static getSkill(elt) {
        return AbilityBlueprint.SkillName.get(elt);
    }

    static getActivation(elt) {
        return AbilityBlueprint.ActiveIn.get(elt);
    }

    static highestPriority(elt) {
        var modifiers = AbilityBlueprint.findAll(elt);
        var currentHighestValue = -1;
        var currentHighestMod = null;
        modifiers.forEach(function(mod) {
            var modPriority = AbilityBlueprint.Priority.get(mod);
            if (modPriority > currentHighestValue) {
                currentHighestValue = modPriority;
                currentHighestMod = mod;
            }
        });
        return currentHighestMod;
    }

}
Utils.classMixin(AbilityBlueprint, AbstractDomController, {
    matcher: "blueprint",
    template: "ability_blueprint",
    params: function(config) {
        var activation = config.activeIn;
        if (Array.isArray(activation)) {
            activation = activation.join(' ');
        }
        return {
            BASE: !!config.isBase,
            PRIORITY: config.priority,
            SKILL_NAME: config.skillName,
            ACTIVATION: activation
        }
    },
    decorate: function(elt, config) {
        IdAttr.generate(elt);
    }
})



class UnitStatus {
    static StackCount = new ScopedAttr("stack_count", IntAttr);
    static StatusType = new ScopedAttr("status_type", StringAttr);

    static findOnUnit(unit, type) {
        return qs(unit, '[wt~="Status"][status_type="' + type + '"]');
    }

    static findAll(elt, opt_type) {
        if (opt_type === undefined) {
            return qsa(elt, '[wt~="Status"]');
        }
        return qsa(elt, '[wt~="Status"][status_type="' + opt_type + '"]');
    }

    static getType(status) {
        return UnitStatus.StatusType.get(status);
    }

    static getCount(status) {
        return UnitStatus.StackCount.get(UnitStatus.StackCount.find(status));
    }

    static updateCount(status, count) {
        UnitStatus.StackCount.set(UnitStatus.StackCount.find(status), count);
    }
}
Utils.classMixin(UnitStatus, AbstractDomController, {
    matcher: "[wt~='Status']",
    template: 'unit_status',
    params: function(config) {
        return {
            STATUS_TYPE: config.statusType,
            STATUS_ICON: config.statusIcon,
            STATUS_CLASS: config.statusClass || ''         
        };
    },
    decorate: function(elt, config) {
        IdAttr.generate(elt);
        var element = UnitStatus.StackCount.find(elt);
        UnitStatus.StackCount.set(element, config.statusCount);
    }
});

class BaseStatus {
    static ForStatusIds = new ScopedAttr("for-status-ids", ListAttr);
    static ForStatus = new ScopedAttr("for-status", StringAttr);
    static MergeFn = new ScopedAttr("merge-fn", FunctionAttr);
    static Icon = new ScopedAttr("icon", StringAttr);
    static ExtraClasses = new ScopedAttr("extra-classes", ListAttr);
    static ExtraTypes = new ScopedAttr("extra-types", ListAttr);
    static Exclusive = new ScopedAttr("exclusive", StringAttr);
    static ApplyFn = new ScopedAttr('apply-fn', FunctionAttr);
    static RemoveFn = new ScopedAttr('remove-fn', FunctionAttr);
    static StackCountFn = new ScopedAttr("stack-fn", FunctionAttr);
    static ForbiddenStatus = new ScopedAttr('forbidden-status', ListAttr);
    static RemoveAtZero = new ScopedAttr('remove-at-zero', BoolAttr);

    // This does the engine-y related shit (like installing handlers).
    // This is also what we would call in the game (e.g. "MyStatus.Apply");
    static Apply(config, unit, amount) {
        var statusName = config;
        var forbidden = BaseStatus.ForbiddenStatus.get(unit) || [];
        if (forbidden.includes(statusName)) {
            return;
        }
        var bp = Utils.bfind(unit, 'body', 'status-blueprint[type="' + statusName + '"]');
        var container = EffectQueue.getHandlerContainer(unit);
        var existingHandlerSet = BaseStatus.ForStatus.find(container, statusName);

        // Install our handlers if needed.
        if (!existingHandlerSet) {
            existingHandlerSet = Templates.inflate('handler-set');
            BaseStatus.ForStatus.set(existingHandlerSet, statusName);
            var bpCopy = bp.cloneNode(true);
            Utils.moveChildren(bpCopy, existingHandlerSet);
            container.appendChild(existingHandlerSet);
        }

        // Create our status.
        var status = UnitStatus.inflate({
            statusType: statusName,
            statusIcon: BaseStatus.Icon.get(bp),
            statusClass: (BaseStatus.ExtraClasses.get(bp) || []).join(' '),
            statusCount: amount
        });
        var types = BaseStatus.ExtraTypes.get(bp) || [];
        types.forEach(function(type) {
            WoofType.add(status, type);
        });

        // Handle applying this to our unit.
        var hasMerge = BaseStatus.MergeFn.has(bp);
        var applied = false;
        if (hasMerge) {
            var existing = UnitStatus.findOnUnit(unit, statusName);
            if (existing) {
                // Do the merge.
                applied = BaseStatus.MergeFn.invoke(bp, unit, existing, amount);
            }
        }
        if (!applied) {            
            // Check if exclusivity applies.
            if (BaseStatus.Exclusive.has(bp)) {
                var exclusivityType = BaseStatus.Exclusive.get(bp);
                // Copy over our exclusivity
                BaseStatus.Exclusive.copy(status, bp);
                var existing = BaseStatus.Exclusive.findAll(unit, exclusivityType);
                // Remove our prior exclusive one.
                if (existing && existing.length > 0) {
                    existing.forEach(function(existingStatus) {
                        var type = UnitStatus.StatusType.get(existingStatus);
                        if (type != statusName) {
                            BaseStatus.Remove(type, unit, existingStatus);
                        }
                    });
                }
            };
 
            // Lay on a base coat.
            var statusContainer = Unit.statusContainer(unit);
            statusContainer.appendChild(status);
            BaseStatus.ForStatusIds.add(existingHandlerSet, IdAttr.get(status));
            if (BaseStatus.ApplyFn.has(bp)) {
                BaseStatus.ApplyFn.invoke(bp, unit, status);
            }
            if (BaseStatus.StackCountFn.has(bp)) {
                BaseStatus.StackCountFn.invoke(bp, status, unit, 0);
            }
        }
    }

    static Has(config, unit) {
        unit = UnitStatus.findOnUnit(unit, config);
        return !!unit;
    }

    static StackCount(config, unitOrStatus) {
        if (!WoofType.has(unitOrStatus, 'Status')) {
            unitOrStatus = UnitStatus.findOnUnit(unitOrStatus, config);
        }
        if (!unitOrStatus) return null;

        return UnitStatus.getCount(unitOrStatus);
    }

    static AddStacks(config, unit, count, status) {
        if (!status) {
            status = UnitStatus.StatusType.findDown(unit, config);
        }
        if (!status) {
            BaseStatus.Apply(config, unit, count);
            return;
        }

        var newCount = UnitStatus.getCount(status) + count;
        UnitStatus.updateCount(status, newCount);


    }

    static SubtractStacks(config, unit, count, status) {
        return BaseStatus.AddStacks(config, unit, count * -1, status);
    }

    static OnStackCountChange(event, handler) {
        var status = handler;
        var unit = Unit.findUp(status);
        BaseStatus.handleStackCountChange(unit, status, event.detail.oldValue)
    }
    
    static handleStackCountChange(unit, status, oldValue) {
        var statusType = UnitStatus.getType(status);
        var bp = Utils.bfind(unit, 'body', 'status-blueprint[type="' + statusType + '"]');
        if (BaseStatus.StackCountFn.has(bp)) {
            BaseStatus.StackCountFn.invoke(bp, status, unit, oldValue);
        }

        if (BaseStatus.RemoveAtZero.findGet(status) && BaseStatus.StackCount(statusType, status) == 0) {
            BaseStatus.Remove(statusType, unit, status);
        }
    }

    // This does the engine-y related shit (like installing handlers).
    // This is also what we would call in the game (e.g. "MyStatus.Apply");
    static Remove(config, unit, status) {
        if (!status) {
            status = UnitStatus.StatusType.find(unit, config);
        }
        if (!status) {
            // Might have already been removed.
            return;
        }
        // Zero this out first.
        var stackCount = BaseStatus.StackCount(config, status);
        if (stackCount > 0) {
            BaseStatus.SubtractStacks(config, unit, BaseStatus.StackCount(config, status), status);
            BaseStatus.handleStackCountChange(unit, status, stackCount);
            if (!Unit.findUp(status)) return;  // It settled.
        }

        var id = IdAttr.get(status);
        var container = EffectQueue.getHandlerContainer(status);
        var handlerSets = BaseStatus.ForStatusIds.findAll(container, id);

        // Uninstall handlers if needed.
        for (var i = 0; i < handlerSets.length; i++) {
            var set = handlerSets[i];
            BaseStatus.ForStatusIds.remove(set, id);
            if (BaseStatus.ForStatusIds.size(set) == 0) {
                set.remove();
            }
        }

        // Invoke the On-Remove handler.
        var bp = Utils.bfind(unit, 'body', 'status-blueprint[type="' + config + '"]');
        if (BaseStatus.RemoveFn.has(bp)) {
            BaseStatus.RemoveFn.invoke(bp, unit, status);
        }

        // Remove status from the unit.
        status.remove();
    }

    static Get(config, unit) {
        return UnitStatus.StatusType.findDown(unit, config);
    }

    static findInstances(config, elt) {
        return UnitStatus.findAll(elt, config);
    }
}
WoofRootController.register(BaseStatus);


/** Utilities to help with mana spending. */
class Mana {
    static Fire = "🔥";
    static Wind = "🌪️";
    static Water = "💧";
    static Earth = "⛰️";
    static Light = "☀️";
    static Dark = "💀";
    static All = [Mana.Fire, Mana.Wind, Mana.Water, Mana.Earth, Mana.Light, Mana.Dark];

    static noMana() {
        return {
            "🔥": 0,
            "🌪️": 0,
            "💧": 0,
            "⛰️": 0,
            "☀️": 0,
            "💀": 0
        };
    }

    static normalize(mana) {
        return Mana.plus(Mana.noMana(), mana);
    }

    static total(mana) {
        var total = 0;
        Mana.All.forEach(function(c) {
            total += mana[c] || 0;
        });
        return total;
    }

    static plus(a, b) {
        var results = {};
        Mana.All.forEach(function(c) {
            results[c] = (a[c] || 0) + (b[c] || 0);
        });
        return results;
    }

    static minus(a, b) {
        var results = {};
        Mana.All.forEach(function(c) {
            results[c] = (a[c] || 0) - (b[c] || 0);
        });
        return results;
    }

    static canAfford(have, cost) {
        for (var i = 0; i < Mana.All.length; i++) {
            var type = Mana.All[i];
            if ((have[type] || 0) < (cost[type] || 0)) {
                return false;
            }
        }
        return true;
    }

    static fromCost(str) {
        var results = {};
        Mana.All.forEach(function(c) {
            results[c] = str.split(c).length - 1;
        });
        return results;
    }

    /** Used as a default combo helper. */
    static AddMana(targetAbility, comboHelper, params) {
        params.mana = Mana.normalize(params.mana);
        var unit = Unit.findUp(comboHelper);
        var month = Unit.Month.get(unit);
        if (month && params.mana[month] !== undefined) {
            params.mana[month] += 1;
        }
    }

    static Attr = new ScopedAttr("mana", StringAttr);
    static DefaultMana(unit, ability) {
        var mana = Mana.noMana();
        var unitMana = Mana.Attr.get(unit) || "";
        var abilityMana = Mana.Attr.get(ability) || "";
        mana = Mana.plus(mana, Mana.fromCost(unitMana));
        mana = Mana.plus(mana, Mana.fromCost(abilityMana));
        return mana;
    }


    static CostsAllMana(mana) {
        if (Mana.total(mana) > 0) {
            return mana;
        }
        return null;
    }
}
WoofRootController.register(Mana);
