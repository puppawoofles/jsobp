
class Strike {
    static combo(mana, params) {
        var comboPoints = Mana.total(mana);
        var bonusDamage = Math.floor(Math.max(comboPoints * params.baseDamage / 4, 1));
        // +25% damage per combo point
        params.baseDamage = params.baseDamage + bonusDamage;
    }

    static strikeInvoke(units, ability, params, invokedEffects, targets, effect) {
        var unit = units[0];
        var results = [];

        if (targets.length == 0) {
            Logger.info("No valid target :(");
            return GameEffect.createResults(effect, {
                noTarget: true
            });    
        }
        var target = targets[0];
        var damage = params.baseDamage;

        return GameEffect.push(effect, GameEffect.create("Attack", {
            amount: damage,
            source: unit,
            main_type: DamageTypes.MELEE,
            target: target
        }));
    }

    static throwInvoke(units, ability, params, invokedEffects, targets, effect) {
        var unit = units[0];
        var results = [];

        if (targets.length == 0) {
            Logger.info("No valid target :(");
            return GameEffect.createResults(effect, {
                noTarget: true
            });
        }

        var myBlock = CellBlock.findByContent(unit);

        // Can throw over all units in this block.
        var filteredTargets = targets.filter(function(target) {
            return CellBlock.findByContent(target) != myBlock;
        });

        var target = filteredTargets[0];
        var damage = params.baseDamage;
        if (!target) {
            // Our target is in this block.  Time to struggle.
            damage = 1;
            target = targets[0];
            if (!target) {
                Logger.info("No valid target :(");
                return GameEffect.createResults(effect, {
                    noTarget: true
                });
            }    
        }

        return GameEffect.push(effect, GameEffect.create("Attack", {
            amount: damage,
            source: unit,
            main_type: DamageTypes.THROWN,
            target: target
        }));
    }

    static shootInvoke(units, ability, params, invokedEffects, targets, effect) {
        var unit = units[0];
        var results = [];

        if (targets.length == 0) {
            Logger.info("No valid target :(");
            return GameEffect.createResults(effect, {
                noTarget: true
            });    
        }

        var myBlock = CellBlock.findByContent(unit);
        var selfCoord = SmallCoord.extract(unit);

        // Can shoot over stuff as long as not jammed!
        var jammed = targets.filter(function(target) {
            // Can't be jammed by something in another block.
            if (myBlock != CellBlock.findByContent(target)) return false;
            var coord = SmallCoord.extract(target);
            return SmallCoord.diagDistance(selfCoord, coord) <= 1;
        });
        var target = jammed[0];
        var damage = params.baseDamage;
        if (!target) {
            // Bows can shoot over everything.  Neat!
            target = targets.peek();
        }
        if (CellBlock.findByContent(target) == myBlock) {
            // Time to struggle!
            damage = 1;
        }

        return GameEffect.push(effect, GameEffect.create("Attack", {
            amount: damage,
            source: unit,
            main_type: DamageTypes.RANGED,
            target: target
        }));
    }
}
WoofRootController.register(Strike);



class RetreatAbility {
    static combo(mana, params) {
        params.retreat += Mana.total(mana);
    }

    static invoke(units, ability, params, invokedEffects, target, effect) {
        var unit = units[0];
        var stacks = Math.min(params.retreat || 1, RetreatStatus.StackCount(unit));
        RetreatStatus.SubtractStacks(unit, stacks);
        return GameEffect.createResults(effect);
    }    
}
WoofRootController.register(RetreatAbility);

class StepAbility {
    
    static combo(mana, params) {
        params.distance += Mana.total(mana);
    }

    static invoke(units, ability, params, invokedEffects, targets, effect) {
        var unit = units[0]; // Only 1 can happen.
        var targetCell = Unit.getTargetLocation(unit);
        if (!targetCell) {
            // No move.
            return GameEffect.createResults(effect);
        }

        var baseDistance = params.distance || 1;

        var distance = baseDistance;
        if (AgilityStatus.Has(unit) && AgilityStatus.StackCount(unit) > 0) {
            distance += AgilityStatus.StackCount(unit);
        }

        return GameEffect.push(effect, GameEffect.create("UnitMoveToward", {
            unit: unit,
            destination: targetCell,
            distance: distance
        })).then(function(result) {
            var agilityStacksUsed = result.distanceMoved - baseDistance;
            if (agilityStacksUsed > 0) {
                AgilityStatus.SubtractStacks(unit, agilityStacksUsed);
            } else if (result.distanceMoved == 0) {
                AgilityStatus.AddStacks(unit, 1);
            }
            return GameEffect.createResults(effect);
        }); 
    }
}
WoofRootController.register(StepAbility);



class ScurryAbility {    
    static invoke(units, ability, params, invokedEffects, targets, effect) {
        var unit = units[0]; // Only 1 can happen.
        var targetCell = Unit.getTargetLocation(unit);
        if (!targetCell) {
            // No move.
            return GameEffect.createResults(effect);
        }

        var baseDistance = params.distance || 1;

        var unitSpeed = Unit.getMovementSpeed(unit);
        if (unitSpeed == 0) {
            // No move.
            return GameEffect.createResults(effect);
        }

        var distance = baseDistance;
        return GameEffect.push(effect, GameEffect.create("UnitMoveToward", {
            unit: unit,
            destination: targetCell,
            distance: distance * unitSpeed
        })).then(function(result) {
            if (result.distanceMoved > baseDistance) {
                var amount = result.distanceMoved - baseDistance;
                // Delay their other abilities based on the extra distance covered.
                Ability.findAll(unit).forEach(function(ability) {
                    var toEdit = Ability.CurrentCooldown.find(ability);
                    Ability.CurrentCooldown.set(toEdit, Ability.CurrentCooldown.get(toEdit) + Math.max(1, amount));
                });
            }
            return GameEffect.createResults(effect);
        });
    }
}
WoofRootController.register(ScurryAbility);



class MindlessMarch {    
    static invoke(units, ability, params, invokedEffects, targets, effect) {
        var unit = units[0]; // Only 1 can happen.
        var battlefield = BattlefieldHandler.find(unit);
        var facing = Grid.getFacing(unit);
        var delta = FacingAttr.unitDelta(facing);
        var coord = SmallCoord.extract(unit);
        var dest = SmallCoord.plus(coord, delta);
        var bigCoord = BigCoord.extract(unit);
        var uberCoord = UberCoord.from(bigCoord, dest);
        var destCell = BattlefieldHandler.cellAt(battlefield, uberCoord);
        if (!destCell) {
            // Can't move forward, can we?
            return GameEffect.createResults(effect);
        }
        var unitInCell = BattlefieldHandler.unitAt(battlefield, uberCoord);
        if (unitInCell) {
            // Collide instead. :D
            return GameEffect.push(effect, GameEffect.create("UnitCollision", {
                firstUnit: unit,
                secondUnit: unitInCell
            }));
        }
        return GameEffect.push(effect, GameEffect.create("UnitMoveToward", {
            unit: unit,
            destination: destCell,
            distance: 10
        })); 
    }
}
WoofRootController.register(MindlessMarch);


class Push {
    static combo(mana, params) {
        params.pushForce += (Mana.total(mana));
    }

    static invoke(units, ability, params, invokedEffects, targets, effect) {
        var facing = Grid.getFacing(units[0]);
        if (targets.length == 0) {
            Logger.info("No valid target :(");
            return GameEffect.createResults(effect, {
                noTarget: true
            });    
        };
        var target = targets[0];

        return GameEffect.push(effect, GameEffect.create("PushUnit", {
            target: target,
            direction: facing,
            amount: params.pushForce
        })).then(function() {
            return GameEffect.createResults(effect);
        });
    }
}
WoofRootController.register(Push);


class Defend {
    static combo(mana, params) {
        params.baseDefense += Mana.total(mana) * 3;
    }

    static invoke(units, ability, params, invokedEffects, targets, effect) {
        var results = [];

        DefendStatus.Apply(units[0], params.baseDefense);
        return GameEffect.createResults(effect);
    }
}
WoofRootController.register(Defend);


class Protect {
    static combo(mana, params) {
        params.baseDefense += Mana.total(mana) * 3;
    }

    static invoke(units, ability, params, invokedEffects, targets, effect) {
        var results = [];

        var unit = units[0];
        var facing = Grid.getFacing(unit);
        var deltas = [SmallCoord.from(0, 0), SmallCoord.from(-1, 0), SmallCoord.from(1, 0), SmallCoord.from(0, -1), SmallCoord.from(0, 1)];
        var base = SmallCoord.extract(unit);
        var baseBig = BigCoord.extract(unit);

        var unitToDefend = deltas.map(function(d) {
            var coord = SmallCoord.plus(base, d);
            var targetUnit = BattlefieldHandler.unitAt(unit, UberCoord.from(baseBig, coord));
            if (!targetUnit) return null;
            if (!TeamAttr.matches(unit, targetUnit)) return null;
            return targetUnit;
        }).filter(function(u) { return !!u; }).sort(function(a, b) {
            // Protect lowest HP, then furthest forward, then closest to self.
            var aD = SmallCoord.extract(a);
            var bD = SmallCoord.extract(b);
            var idealPos = SmallCoord.plus(base, FacingAttr.unitDelta(facing));
            return Unit.currentHP(a) - Unit.currentHP(b) ||
                SmallCoord.distance(idealPos, aD) - SmallCoord.distance(idealPos, bD) ||
                SmallCoord.distance(base, aD) - SmallCoord.distance(base, bD) ||
                aD[0] - bD[0] || aD[1] - bD[1];
        });
        var toDefend = unitToDefend[0];
        if (toDefend != unit) {
            // Bonus if you're defending someone else!
            params.baseDefense = Math.floor(params.baseDefense * 3 / 2);
        }

        DefendStatus.Apply(toDefend, params.baseDefense);
        return GameEffect.createResults(effect);
    }
}
WoofRootController.register(Protect);


class DistractAbility {

    static combo(mana, params) {
        params.debuffSize += Mana.total(mana);
    }

    static invoke(units, ability, params, invokedEffects, targets, effect) {
        if (targets.length == 0) {
            return GameEffect.createResults(effect);
        }
        // Find a target that has abilities.
        var target = targets.filter(function(t) {
            return Ability.findAll(t).length > 0;
        })[0];

        if (!target) {
            // No target?  No action.
            return GameEffect.createResults(effect, {
                noTarget: true
            });
        }

        var amount = params.debuffSize;

        DistractedStatus.AddStacks(target, amount);
        var unsorted = Ability.findAll(target);
        var toAffect = unsorted.sort(function(a, b) {
            var aCooldown = Ability.CurrentCooldown.findGet(a);
            var bCooldown = Ability.CurrentCooldown.findGet(b);
            if (aCooldown != bCooldown) {
                return aCooldown - bCooldown;
            }
            var aIndex = unsorted.indexOf(a);
            var bIndex = unsorted.indexOf(b);

            return aIndex - bIndex;
        })[0];
        var toEdit = Ability.CurrentCooldown.find(toAffect);
        Ability.CurrentCooldown.set(toEdit, Ability.CurrentCooldown.get(toEdit) + Math.max(1, amount));

        return GameEffect.createResults(effect);
    }
}
WoofRootController.register(DistractAbility);


class BleedAbility {
    static combo(mana, params) {
        params.baseDamage += Mana.total(mana);
    }

    static invoke(units, ability, params, invokedEffects, targets, effect) {
        if (targets.length == 0) {
            return GameEffect.createResults(effect, {
                noTarget: true
            });
        }
        var target = targets[0];

        var bleedAmount = Math.floor((3 * params.baseDamage) / 4);

        BleedStatus.AddStacks(target, bleedAmount);
        return GameEffect.createResults(effect);
    }
}
WoofRootController.register(BleedAbility);


class SunderAbility {
    static combo(mana, params) {
        params.baseDamage += (Mana.total(mana) * 3);
    }

    static invoke(units, ability, params, invokedEffects, targets, effect) {
        if (targets.length == 0) {
            return GameEffect.createResults(effect, {
                noTarget: true
            });
        }
        var target = targets[0];

        DefendStatus.SubtractStacks(target, params.baseDamage);
        return GameEffect.createResults(effect);
    }
}
WoofRootController.register(SunderAbility);