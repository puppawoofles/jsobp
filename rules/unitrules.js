class UnitRules {

    static TargetUnitPlacement(card) {
        var battlefield = BattlefieldHandler.find(card);        
        var unit = Unit.find(card);
        var maxPlayerUnits = EncounterRules.MaxPlayerUnits.findUpGet(battlefield, 5); // Hard-coded default. :(

        return UnitRules.TargetPlacementForUnit(battlefield, unit, IdAttr.generate(card), function() {
            var playerCount = Unit.findAllByTeam(battlefield, Teams.Player).map(Unit.capacitySize).merge(sumMerge);
            return playerCount < maxPlayerUnits;
        });
    }

    static TargetPlacementForUnit(battlefield, unit, thing, predicateFn) {
        var unitPrefs = Unit.getPreferredLocations(unit);
        var root = BattlefieldHandler.findGridContainer(battlefield);

        return TargetPicker.standardPickTarget(battlefield, thing,
                function() {
                    // This is to handle max-player-counts for new players, but to ignore it for
                    // ghost-positioning.
                    if (predicateFn && !predicateFn()) return [];
                    // Check total player capacity first.

                    var blocks = CellBlock.findAllByTeam(root, Teams.Player).filter(function(block) {
                        // Filter out blocks that can't hold all these limes.
                        if (!EncounterRules.MaxPlayerUnits.has(block)) return true;
                        return Unit.findTeamInBlock(block, Teams.Player).map(Unit.capacitySize).merge(sumMerge) < EncounterRules.MaxPlayerUnits.get(block);
                    });

                    // For each of these blocks, return cells that are actually empty.
                    return blocks.map(Cell.findAllInBlock).flat().filter(function(cell) {
                        var coord = UberCoord.extract(cell);
                        return !BattlefieldHandler.unitAt(battlefield, coord);
                    });
                },
                function(elt) {
                    return WoofType.has(elt, 'Cell') && unitPrefs.contains(Grid.getEffectiveTile(elt));
                });
    }

    static InvokeUnitPlacement = function(card, target) {
        var block = CellBlock.findUp(target);
        var bigCoord = BigCoord.extract(block);
        var smallCoord = SmallCoord.extract(target);
        var unit = Unit.find(card);
        Unit.setTargetLocation(unit, target);
        Unit.setStopped(unit, true);
        var battlefield = BattlefieldHandler.find(card);
        BattlefieldHandler.addUnitTo(battlefield, unit, bigCoord, smallCoord);
        WoofType.add(unit, "GhostUnit");
        card.remove();
        return false;
    }

    static Fallback = new ScopedAttr('fallback', StringAttr);

    /**
     * {
     *     units: [ Unit ref, ...],
     *     ability: Ability ref,
     *     fallback: bool,
     *     comboUnits: [{ unit: unitRef, ability: abilityRef}],
     *     mana: The mana that was spent on this skill.
     *     components: [{
     *       unit: Unit ref, one of the component units using this ability.
     *       ability: Ability ref, one of the components of this ability.
     *     }... ]
     * }
     */
    static UseAbility = GameEffect.handle(function(handler, effect, params) {
        var units = params.components.map(function(a) {
            return a.unit;
        });
        var team = TeamAttr.get(units[0]);
        var ability = params.ability;
        var skill = SkillAttr.get(ability);
        
        var bp = !params.fallback ? Ability.findSkill(handler, skill) : Ability.findFallback(handler, skill);
        var targetTravel = Ability.getTargetTravel(bp);
        var overhead = Ability.getOverhead(bp);

        // Next up, go through our standard processing of an ability.
        var params = ParamFnAttr.invoke(bp, units, ability, bp, params.mana);
        var mana = params.mana;

        var allEffects = qsa(ability, 'combo-effect').sort(function(a, b) {
            // Reverse sort.
            return (PriorityAttr.get(b) || 0) - (PriorityAttr.get(a) || 0);
        });
        
        var purchasedEffects = allEffects.map(function(effect) {
            var cost;
            if (CostFnAttr.has(effect)) {
                cost = CostFnAttr.invoke(effect, mana);
                if (cost) {                    
                    mana = Mana.minus(mana, cost);
                    return {
                        paid: cost,
                        effect: effect
                    };
                }
                return null;
            }
            if (CostAttr.has(effect)) {
                cost = Mana.fromCost(CostAttr.get(effect));
                if (cost && Mana.canAfford(mana, cost)) {                    
                    mana = Mana.minus(mana, cost);
                    return {
                        paid: cost,
                        effect: effect
                    };
                }                
            }
            return null;
        }).filter(function(effect) {
            return !!effect;
        });

        purchasedEffects.forEach(function(blorb) {
            if (ParamFnAttr.has(blorb.effect)) {
                ParamFnAttr.invoke(blorb.effect, blorb.paid, params);
            }
        });

        var invokedEffects = purchasedEffects.filter(function(blorb) {
            return EffectFnAttr.has(blorb.effect);
        });

        // Figure out the average cell of all the units, which determines from where
        // the ability is used for targeting.
        var runningTotal = [0,0];
        units.forEach(function(unit) {
            runningTotal = SmallCoord.plus(runningTotal, SmallCoord.extract(unit));
        });
        runningTotal = [Math.floor((runningTotal[0] / units.length) + 0.5), Math.floor((runningTotal[1] / units.length) + 0.5)];
        var block = BigCoord.extract(units[0]);
        var cell = BattlefieldHandler.cellAt(units[0], UberCoord.from(block, runningTotal));

        var target = TargetFunctionAttr.invoke(bp, cell, team, {
           CC: Ability.getActiveIn(ability).includes(Grid.CloseCombat),
           travelMode: targetTravel,
           overhead: overhead
        });

        return Promise.resolve(InvokeFunctionAttr.invoke(bp, units, ability, params, invokedEffects, target, effect));
    });

    static UseAbilityUnit = function(handler, effect, params) {
        return params.components.map(function(c) {
            return c.unit;
        });
    }
    
    static UseAbilityComboUnits = function(handler, effect, params) {
        return params.comboUnits;
    }

    static UseAbilityName = function(handler, effect, params) {
        return Ability.Label.findGet(params.ability);
    }

    static UseAbilityHasCombo = function(handler, effect, params) {
        return params.comboUnits.length > 0;
    }

    /**
     * Reduces damage by block, then deals damage.
     * {
     *    target: Unit ref (who is taking the damage)
     *    source: Unit ref (who is dealing the damage)
     *    main_type: string (the icon of the ability)
     *    amount: integer (amount of damage)
     * }
     */
    static Attack = GameEffect.handle(function(handler, effect, params) {
        var target = params.target;
        var defend = DefendStatus.StackCount(target) || 0;
        var change = Math.min(Math.abs(defend), params.amount) * Math.sign(defend) * -1;
        var newDamage = params.amount + change;
        if (change != 0) {
            DefendStatus.AddStacks(target, change);
        }
        if (newDamage <= 0) {
            return GameEffect.createResults(effect, {
                unit: params.target,
                damageTaken: 0,
                overkill: 0
            });
        }
        return GameEffect.push(effect, GameEffect.create("TakeDamage", {
            target: params.target,
            source: params.source,
            main_type: params.main_type,
            amount: newDamage
        }, handler));
    });

    /**
     * {
     *    target: Unit ref (who is taking the damage)
     *    source: Unit ref (what is dealing the damage)
     *    amount: integer (amount of damage taken)
     *    main_type: String type.
     *    immediateDeath: bool (if we should do a death check now.)
     * }
     */
    static TakeDamage = GameEffect.handle(function(handler, effect, params) {

        var target = params.target;
        var amount = params.amount;

        var current = Unit.currentHP(target);
        Unit.reduceHP(target, amount);
        var newCurrent = Unit.currentHP(target);
        var damageTaken = current - newCurrent;

        Unit.affect(target);

        var promise = Promise.resolve();
        if (newCurrent == 0 && params.immediateDeath) {
            promise = GameEffect.push(effect, GameEffect.create("UnitDeath", {
                unit: target
            }, handler));
        }
        

        return promise.then(function() {
            return GameEffect.createResults(effect, {
                unit: target,
                damageTaken: damageTaken,
                finalHP: newCurrent,
                overkill: amount - damageTaken
            });    
        });
    });

    static TakeDamageUnit(handler, event, params, result) {
        return params.target;
    }

    static TakeDamageAmount(handler, event, params, result) {
        return result.damageTaken || null;
    }

    /**
     * {
     *   target: unit ref,
     *   direction: direction (FacingAttr)
     *   amount: the number of squares to push.
     * }
     */
    static PushUnit = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var target = params.target;
        var direction = params.direction;
        var amount = params.amount;
        
        Unit.affect(target);

        var pushStack = [target];

        var pushFn = function() {
            if (amount == 0) {
                // No more pushing to do?  Bail out.
                return;
            }

            // Spending goes as follows:
            // - If a unit can move into the square, it does for 1 push.
            // - If a unit (A) is blocked (by B), it costs 1 push to cause a collision.
            // - If a unit (A) is blocked but they just collided, B is now pushed (potentially into C);
            // - Repeat until out of push or things are unblocked.
            // - A unit pushed against the edge collides into nothing.
            var current = pushStack[0];
            if (!current) {
                // No more people to push?
                return;
            }
            var mass = Unit.mass(current);
            if (amount < mass) {
                // Not enough to continue pushing.
                return;
            }
            amount -= mass;

            var start = SmallCoord.extract(current);
            var destination = SmallCoord.plusDirection(start, direction);
            if (SmallCoord.equals(start, destination)) {
                // Can't push someone nowhere.
                return;
            }
            var uber = UberCoord.from(BigCoord.extract(current), destination);
            var unitAt = BattlefieldHandler.unitAt(battlefield, uber);
            var cellAt = BattlefieldHandler.cellAt(battlefield, uber);

            if (!!unitAt || !cellAt) {
                // Collision!  Either with nobody or with the back of the wall.
                if (!!unitAt) {
                    pushStack.unshift(unitAt);
                    return GameEffect.push(effect, GameEffect.create("UnitCollision", {
                        firstUnit: current,
                        secondUnit: unitAt,
                    }, handler)).then(pushFn);
                } else {
                    // We collided with the "wall", which means there's nobody to transfer
                    // the push into.  In this case, we want to pop back up.
                    while (pushStack.length > 1) {
                        pushStack.shift();
                    }
                    return GameEffect.push(effect, GameEffect.create("UnitCollision", {
                        firstUnit: current,
                    }, handler)).then(pushFn);
                }
            } else {
                // Push!
                // Remove our lower-down target, but always keep our OG as long as we can.
                while (pushStack.length > 1) {
                    pushStack.shift();
                }

                // Move our unit.
                return GameEffect.push(effect, GameEffect.create("ShiftUnit", {
                    unit: current,
                    destination: cellAt
                }, handler)).then(pushFn);
            }
        };

        return Promise.resolve(pushFn()).then(function() {
            return GameEffect.createResults(effect);
        });
    });

    static ShiftFromPush(handler, event, params) {
        return !!GameEffect.findParentByType(event, "PushUnit");
    }


    /**
     * {
     *  firstUnit: Required unit ref
     *  secondUnit: Optional unit ref
     * }
     */
    static UnitCollision = GameEffect.handle(function(handler, effect, params) {
        var unit = params.firstUnit;
        var secondUnit = params.secondUnit || null;

        return GameEffect.push(effect, GameEffect.create("Attack", {
            target: unit,
            main_type: DamageTypes.COLLISION,
            amount: !!secondUnit ? Unit.mass(secondUnit) : Math.floor(Unit.mass(unit) / 2)
        }, handler)).then(function(result) {
            if (!secondUnit) {
                return;
            }

            return GameEffect.push(effect, GameEffect.create("Attack", {
                target: secondUnit,
                main_type: DamageTypes.COLLISION,
                amount: Unit.mass(unit)
            }, handler));
        }).then(function() {
            return GameEffect.createResults(effect);
        });
    });


    /**
     * {
     *      unit: Unit ref
     * }
     */
    static UnitDeath = GameEffect.handle(function(handler, effect, params) {
        var unit = params.unit;

        // Remove the unit.
        unit.parentNode.removeChild(unit);

        return GameEffect.createResults(effect);
    });

    static UnitDeathUnit(handler, event, params) {
        return params.unit;
    }


    static UnitRetreat = GameEffect.handle(function(handler, effect, params) {
        var unit = params.unit;

        // Need to reset the unit first.
        Unit.retreat(unit);
        BattlefieldHandler.resetUnit(unit);

        if (TeamAttr.get(unit) === Teams.Player) {
            var card = Card.inflate(Utils.UUID());
            card.appendChild(unit);
            CardHud.addCardToPurgatory(handler, card);
            CardRules.discardSingleCard(handler, {
                card: card
            }, effect);    
        }

        return GameEffect.createResults(effect);
    })

    /**
     * unit: unit ref
     * destination: cell ref
     * distance: how far they can move (int)
     */
    static UnitMoveToward = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var unit = params.unit;
        var destination = params.destination;
        var sourceCell = BattlefieldHandler.cellAt(battlefield, UberCoord.extract(unit));
        var availableDistance = params.distance;

        var start = UberCoord.toNorm(UberCoord.extract(sourceCell));
        var dest = UberCoord.toNorm(UberCoord.extract(destination));

        var path = Grid.pathTo(start, dest, function(norm) {
            var uber = UberCoord.fromNorm(norm);
            // Make sure it's a cell.
            var cellInSpot = BattlefieldHandler.cellAt(battlefield, uber);
            if (!cellInSpot) return false;
            var block = CellBlock.findByRef(battlefield, cellInSpot);
            if (DisabledAttr.get(block)) return false;
            // Make sure it's not blocked.
            var unitInSpot = BattlefieldHandler.unitAt(battlefield, uber);
            return !unitInSpot || TeamAttr.matches(unit, unitInSpot);
        }, function (norm) {
            var uber = UberCoord.fromNorm(norm);
            var unitInSpot = BattlefieldHandler.unitAt(battlefield, uber);
            // Moving through units is much harder.
            return !!unitInSpot ? 10 : 1;
        });

        if (!path) {
            Logger.info("No candidate paths!  Uh oh!");
            return GameEffect.createResults(effect, {
                distanceMoved: 0
            });
        }
        // Note that the first node in path is the node we're standing on.
        // We want to find the furthest unblocked path we can take.
        var distanceMoved = Math.min(availableDistance + 1, path.length);
        var blocked = true;
        var cell = null;
        while (!!blocked && distanceMoved > 0) {
            distanceMoved -= 1;
            var destinationCoord = path[distanceMoved];
            var uber = UberCoord.fromNorm(destinationCoord);
            cell = BattlefieldHandler.cellAt(battlefield, uber);
            blocked = !!BattlefieldHandler.unitAt(battlefield, uber);    
        }

        if (distanceMoved == 0 || cell === null) {
            // Blocked in. :()
            Logger.info("Unit is blocked and can't move.");
            return GameEffect.createResults(effect, {
                distanceMoved: 0
            });
        }

        return GameEffect.push(effect, GameEffect.create("ShiftUnit", {
            unit: params.unit,
            destination: cell
        }, handler)).then(function() {
            return GameEffect.createResults(effect, {
                distanceMoved: distanceMoved
            });
        });       
    })

    /**
     * {
     *   unit: unit ref
     *   destination: cell ref
     * }
     */
    static ShiftUnit = GameEffect.handle(function(handler, effect, params) {
        var unit = params.unit;
        var cell = params.destination;
        Unit.affect(unit);

        BigCoord.write(unit, BigCoord.extract(cell));
        SmallCoord.write(unit, SmallCoord.extract(cell));
        return GameEffect.createResults(effect);
    })


}
WoofRootController.register(UnitRules);