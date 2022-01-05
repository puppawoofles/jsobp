class UnitRules {

    static TargetUnitPlacement = function(card) {
        var battlefield = BattlefieldHandler.find(card);        
        var unit = Unit.find(card);
        var unitPrefs = Unit.getPreferredLocations(unit);
        var root = BattlefieldHandler.findGridContainer(battlefield);

        return TargetPicker.standardPickTarget(card, IdAttr.get(card),
                function() {
                    var cells = Array.from(BattlefieldHandler.findCells(root, "[team='player']"));
                    cells = cells.filter(function(cell) {
                        var coord = Cell.uberCoord(cell);
                        var big = UberCoord.big(coord);
                        var unit = BattlefieldHandler.unitAt(battlefield, coord);
                        var units = BattlefieldHandler.unitsOn(battlefield, big).filter(function(unit) {
                            // Max 5 players per block.
                            return TeamAttr.get(unit) == Teams.Player;
                        });                                
                        return !unit && units.length < 5;
                    });
                    return cells;
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
        card.remove();
        return false;
    }

    /**
     * {
     *     units: [ Unit ref, ...],
     *     ability: Ability ref,
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
        
        var bp = Ability.findSkill(handler, skill);
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
            amount: newDamage
        }));
    });

    /**
     * {
     *    target: Unit ref (who is taking the damage)
     *    source: Unit ref (what is dealing the damage)
     *    amount: integer (amount of damage taken)
     * }
     */
    static TakeDamage = GameEffect.handle(function(handler, effect, params) {

        var target = params.target;
        var amount = params.amount;
        var results = [];

        var current = Unit.currentHP(target);
        Unit.reduceHP(target, amount);
        var newCurrent = Unit.currentHP(target);
        var damageTaken = current - newCurrent;

        var promise = Promise.resolve();

        return promise.then(function(result) {
            return GameEffect.createResults(effect, {
                unit: target,
                damageTaken: damageTaken,
                finalHP: newCurrent,
                overkill: amount - damageTaken
            }, results);
        });
    });

    static TakeDamageUnit(handler, event, params, result) {
        return params.target;
    }

    static TakeDamageAmount(handler, event, params, result) {
        return result.result.damageTaken || null;
    }

    /**
     * {
     *   target: unit ref,
     *   direction: direction (FacingAttr)
     *   amount: the number of squares to push.
     *   bonusDamage: int
     * }
     */
    static PushUnit = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var target = params.target;
        var direction = params.direction;
        var amount = params.amount;

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
                    })).then(pushFn);
                } else {
                    // We collided with the "wall", which means there's nobody to transfer
                    // the push into.  In this case, we want to pop back up.
                    while (pushStack.length > 1) {
                        pushStack.shift();
                    }
                    return GameEffect.push(effect, GameEffect.create("UnitCollision", {
                        firstUnit: current,
                    })).then(pushFn);
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
                })).then(pushFn);
            }
        };

        return Promise.resolve(pushFn()).then(function() {
            return GameEffect.createResults(effect, {});
        });
    });

    static ShiftFromPush(handler, event, params) {
        return !!GameEffect.findParentByType(event, "PushUnit");
    }


    /**
     * {
     *  firstUnit: Required unit ref
     *  secondUnit: Optional unit ref
     *  bonusDamage: How much extra damage.
     * }
     */
    static UnitCollision = GameEffect.handle(function(handler, effect, params) {
        var unit = params.firstUnit;
        var secondUnit = params.secondUnit || null;
        var results = []

        return GameEffect.push(effect, GameEffect.create("Attack", {
            target: unit,
            amount: !!secondUnit ? Unit.mass(secondUnit) : Math.floor(Unit.mass(unit) / 2)
        })).then(function(result) {
            GameEffect.mergeResults(results, result);
            if (!secondUnit) {
                return;
            }

            return GameEffect.push(effect, GameEffect.create("Attack", {
                target: secondUnit,
                amount: Unit.mass(unit)
            })).then(function(secondResult) {
                GameEffect.mergeResults(results, secondResult);
            });
        }).then(function() {
            return GameEffect.createResults(effect, {}, results);
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

        return GameEffect.createResults(effect, {});
    });

    static UnitDeathUnit(handler, event, params) {
        return params.unit;
    }


    static UnitRetreat = GameEffect.handle(function(handler, effect, params) {
        var unit = params.unit;

        // Need to reset the unit first.
        Unit.retreat(unit);
        BattlefieldHandler.resetUnit(unit);
        var card = Card.inflate(Utils.UUID());
        card.appendChild(unit);
        CardHud.addCardToPurgatory(handler, card);
        CardRules.discardSingleCard(handler, {
            card: card
        }, effect);

        return GameEffect.createResults(effect, {});
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
        var block = CellBlock.findUp(destination);
        var bigCoord = BigCoord.extract(block);

        var targetCoords = SmallCoord.extract(destination);
        var currentCoords = SmallCoord.extract(unit);
        var currentDistance = SmallCoord.distance(targetCoords, currentCoords);
        var moveDistance = params.distance;

        var candidates = Array.from(Cell.findAllInBlock(block))
        .map(function(cell) {
            // Gather info.
            var coords = SmallCoord.extract(cell);
            return {
                cell: cell,
                coords: coords,
                distanceFromTarget: SmallCoord.distance(coords, targetCoords),
                distanceFromStart: SmallCoord.distance(coords, currentCoords)
            };
        })
        .filter(function(blorb) {
            // Only count spots that are closer and within our move range.
            return blorb.distanceFromTarget < currentDistance
                    && blorb.distanceFromStart <= moveDistance;
        })
        .filter(function(blorb) {
            // Remove locations that have a unit in them.
            var uberCoord = UberCoord.from(bigCoord, blorb.coords);
            return !BattlefieldHandler.unitAt(battlefield, uberCoord);
        })
        .sort(function(a, b) {
            var test = a.distanceFromTarget - b.distanceFromTarget;
            if (test != 0) return test;
            test = a.distanceFromStart - b.distanceFromStart;
            return test;
        });

        if (candidates.length == 0) {
            Logger.info("No candidates!  Uh oh!");
            return GameEffect.createResults(effect, {
                distanceMoved: 0
            });
        }

        var location = candidates[0];
        return GameEffect.push(effect, GameEffect.create("ShiftUnit", {
            unit: params.unit,
            destination: location.cell
        })).then(function(result) {
            return GameEffect.createResults(effect, {
                distanceMoved: location.distanceFromStart
            }, [result]);
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

        SmallCoord.write(unit, SmallCoord.extract(cell));
        return GameEffect.createResults(effect, {});
    })


}
WoofRootController.register(UnitRules);