
class Preparations {

    static canAfford(preparation) {        
        var currentGold = RunInfo.getCurrentGold(preparation);
        var cost = Preparation.Cost.findGet(preparation);
        return cost <= currentGold;
    }

    static payCostAndMaybeIncrementUsage(preparation) {
        var currentGold = RunInfo.getCurrentGold(preparation);
        var cost = Preparation.Cost.findGet(preparation);
        RunInfo.setCurrentGold(preparation, currentGold - cost);

        var uses = Preparation.Used.findAll(preparation, false);
        Preparation.Used.set(uses[0], true);
        if (uses.length == 1) {
            if (Preparation.Exhaust.findGet(preparation)) {
                // This card exhausts.  It should be removed.
                preparation.remove();
                return false;
            }
            // This card needs a break and needs to go back to the deck.

            // TODO: This is kind of gross.  Maybe something saner?
            var current = EffectQueue.findCurrentEvent(preparation);
            var encounterParams = GameEffect.getParams(GameEffect.findParentByType(current, 'Encounter'));
            Preparation.resetUses(preparation);
            encounterParams.deck.appendChild(preparation);
            return false;
        }
        return true;
    }
    
    static AllyUnitTarget(card) {
        var battlefield = BattlefieldHandler.find(card);
        return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                function() {
                    if (!Preparations.canAfford(card)) return [];
                    return Unit.findAllByTeam(battlefield, Teams.Player);
                },
                function(elt) {
                    return false;
                });

    }

    static AdjacentEnemyBlockCellTarget(card) {
        var battlefield = BattlefieldHandler.find(card);
        return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                function() {
                    return CellBlock.findAllByTeam(battlefield, Teams.Player).filter(function(block) {
                        // Only player blocks that have player units in them.
                        return Unit.findAllInBlock(block).filter(function(unit) {
                            return TeamAttr.get(unit) == Teams.Player;
                        }).length > 0;
                    }).map(function(block) {
                        // Find adjacent enemy blocks.
                        return CellBlock.findAllByTeam(battlefield, Teams.Enemy).filter(function(otherBlock) {
                            if (DisabledAttr.get(otherBlock)) return false;
                            return BigCoord.distance(BigCoord.extract(block), BigCoord.extract(otherBlock)) == 1;
                        }).map(function(otherBlock) {
                            return Cell.findAllInBlock(otherBlock);
                        }).flat().map(function(cell) {
                            var coord = UberCoord.extract(cell);
                            return BattlefieldHandler.unitAt(battlefield, coord) || cell;
                        });
                    }).flat(3);
                },
                function(elt) {
                    return false;
                });
    }

    static FrontEnemyInAdjacentBlockTarget(card) {
        var battlefield = BattlefieldHandler.find(card);
        return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                function() {
                    if (!Preparations.canAfford(card)) return [];

                    return CellBlock.findAllByTeam(battlefield, Teams.Player).filter(function(block) {
                        // Only player blocks that have player units in them.
                        return Unit.findAllInBlock(block).filter(function(unit) {
                            return TeamAttr.get(unit) == Teams.Player;
                        }).length > 0;
                    }).map(function(block) {
                        // Find adjacent enemy blocks.
                        return CellBlock.findAllByTeam(battlefield, Teams.Enemy).filter(function(otherBlock) {
                            if (DisabledAttr.get(otherBlock)) return false;
                            return BigCoord.distance(BigCoord.extract(block), BigCoord.extract(otherBlock)) == 1;
                        }).map(function(otherBlock) {
                            var direction = FacingAttr.fromUnit(BigCoord.minus(BigCoord.extract(block), BigCoord.extract(otherBlock)));
                            var priorities = [['F1', 'M1', 'B1'], ['F2', 'M2', 'B2'], ['F3', 'M3', 'B3']];

                            // Figure out if there are enemies in each of those 3 lines.
                            return priorities.map(function(prioritySet) {
                                return Grid.fromEffectiveToReal(otherBlock, prioritySet, direction).map(function(smallCoord) {
                                    return BattlefieldHandler.unitAt(battlefield, UberCoord.from(BigCoord.extract(otherBlock), smallCoord));
                                }).findFirst(function(unitMaybe) {
                                    if (!unitMaybe) return false;
                                    return TeamAttr.get(unitMaybe) == Teams.Enemy;
                                });
                            }).filter(function(unit) {
                                return !!unit;
                            });
                        });
                    }).flat(3   );
                },
                function(elt) {
                    return false;
                });
    }

    static TeleportUnitToCell(battlefield, unit, destination) {
        var effect = EffectQueue.findCurrentQueue(battlefield);
        return GameEffect.push(effect, GameEffect.create("ShiftUnit", {
            unit: unit,
            destination: destination
        }));
    }

    
    static dealDamage(battlefield, targets, amount) {
        var effect = EffectQueue.findCurrentQueue(battlefield);

        return Promise.all(targets.map(function(target) {
            return GameEffect.push(effect, GameEffect.create("TakeDamage", {
                target: target,
                source: null,
                amount: amount,
                immediateDeath: true
            }));
        }));        
    }
}
WoofRootController.register(Preparations);


class BuffPotions {
    static minorBaseDamage(card, target) {
        BaseDamageStatus.AddStacks(target, 3);
        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static minorBaseDefense(card, target) {
        BaseDefenseStatus.AddStacks(target, 3);        
        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static turtlePotion(card, target) {
        Ability.findAll(target).forEach(function(ability) {
            var toEdit = Ability.CooldownDuration.find(ability);
            Ability.CurrentCooldown.set(toEdit, Ability.CurrentCooldown.get(toEdit) + 1);
        });
        DefendStatus.Apply(target, 15);
        
        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static cheetahPotion(card, target) {
        Ability.findAll(target).forEach(function(ability) {
            var toEdit = Ability.CooldownDuration.find(ability);
            Ability.CurrentCooldown.set(toEdit, Math.max(1, Ability.CurrentCooldown.get(toEdit) - 1));
        });
        return Preparations.payCostAndMaybeIncrementUsage(card);
    }
}
WoofRootController.register(BuffPotions);


class Barricade {
    static target(card) {
        var battlefield = BattlefieldHandler.find(card);
        return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                function() {
                    if (!Preparations.canAfford(card)) return [];
                    return CellBlock.findAllByTeam(battlefield, Teams.Player).map(function(block) {
                        return Cell.findAllInBlock(block).filter(function(cell) {
                            return !BattlefieldHandler.unitAt(battlefield, UberCoord.extract(cell));
                        });
                    }).flat();
                },
                function(elt) {
                    return false;
                });

    }

    static invoke(card, target) {
        var battlefield = BattlefieldHandler.find(card);        
        var barricade = Units.barricade();
        BattlefieldHandler.addUnitTo(battlefield, barricade, BigCoord.extract(target), SmallCoord.extract(target));
        return Preparations.payCostAndMaybeIncrementUsage(card);
    }
}
WoofRootController.register(Barricade);




class BlinkCrystal {
    static TargetFn(card) {
        // Lol, temp reuse.
        return Reposition.target(card);
    }

    static invoke(card, target) {
        var battlefield = BattlefieldHandler.find(target.unit);

        Preparations.TeleportUnitToCell(battlefield, target.unit, target.destination);
        return Preparations.payCostAndMaybeIncrementUsage(card);
    }
}
WoofRootController.register(BlinkCrystal);


class OffensiveItems {
    
    static throwingKnife(card, target) {
        var battlefield = BattlefieldHandler.find(target);
        var bigCell = UberCoord.big(UberCoord.extract(target));
        Preparations.dealDamage(battlefield, [target], 5).then(function(result) {
            if (Unit.isDead(target)) {
                CellBlock.findAllByTeam(battlefield, Teams.Player).filter(function(block) {
                    var thisCoord = BigCoord.extract(block);
                    return BigCoord.distance(thisCoord, bigCell) == 1 &&
                            FacingAttr.get(block) == FacingAttr.fromUnit(BigCoord.minus(bigCell, thisCoord));
                }).forEach(EncounterRules.setDefaultFacingOnBlock);        
            }
            EncounterRules.CheckAndTriggerEnd(battlefield);
        });

        // Find an adjacent block, update the facing.

        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static fireBomb(card, target) {
        var battlefield = BattlefieldHandler.find(target);
        var targetBlock = CellBlock.findByContent(target);
        var bigCell = BigCoord.extract(targetBlock);
        
        var units = FacingAttr.allDirections().map(FacingAttr.unitDelta).map(function(delta) {
            return UberCoord.from(bigCell, SmallCoord.plus(SmallCoord.extract(target), delta));
        }).extend([UberCoord.extract(target)]).map(function(coord) {
            return BattlefieldHandler.unitAt(battlefield, coord)
        }).filter(function(unit) { return !!unit; });

        Preparations.dealDamage(battlefield, units, 50).then(function(result) {
            if (Unit.findAllInBlock(targetBlock).length == 0) {
                CellBlock.findAllByTeam(battlefield, Teams.Player).filter(function(block) {
                    var thisCoord = BigCoord.extract(block);
                    return BigCoord.distance(thisCoord, bigCell) == 1 &&
                            FacingAttr.get(block) == FacingAttr.fromUnit(BigCoord.minus(bigCell, thisCoord));
                }).forEach(EncounterRules.setDefaultFacingOnBlock);        
            }
            EncounterRules.CheckAndTriggerEnd(battlefield);
        })

        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

}
WoofRootController.register(OffensiveItems);