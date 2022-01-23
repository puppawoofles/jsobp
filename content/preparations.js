
class Preparations {
    static rng = ASRNG.newRng(NC.Seed, true, NC.Encounter, NC.Round, NC.Day);
    static resetRng = Preparations.rng.invalidate;

    static InitDefaultMode(elt, useTypes) {
        var usesParent = Preparation.Uses.find(elt);
        Utils.clearChildren(usesParent);
        var maxUses = Preparation.Uses.get(usesParent)
        times(maxUses).forEach(function(idx) {
            var use = Templates.inflateIn("preparation_use", usesParent);
            Preparation.Used.set(use, false);
            Preparation.OnUseFn.copy(use, useTypes["default"]);
        });
    }
    
    static InitExhaustMode(elt, useTypes) {
        var usesParent = Preparation.Uses.find(elt);
        Utils.clearChildren(usesParent);
        var maxUses = Preparation.Uses.get(usesParent);
        times(maxUses).forEach(function(idx) {
            var use = Templates.inflateIn("preparation_use", usesParent);
            Preparation.Used.set(use, false);
            Preparation.OnUseFn.copy(use, useTypes["exhaust"]);
            Preparation.Exhaust.set(use, true);
        });
    }

    static InitDegradeMode(elt, useTypes) {
        var usesParent = Preparation.Uses.find(elt);
        Utils.clearChildren(usesParent);
        var maxUses = Preparation.Uses.get(usesParent);
        times(maxUses).forEach(function(idx) {
            var use = Templates.inflateIn("preparation_use", usesParent);
            if (idx == 0) {
                Preparation.OnUseFn.copy(use, useTypes["exhaust"]);
                Preparation.Exhaust.set(use, true);
            } else {
                Preparation.OnUseFn.copy(use, useTypes["default"]);
            }
            Preparation.Used.set(use, false);
        });
    }

    static InitGiftMode(elt, useTypes) {
        var usesParent = Preparation.Uses.find(elt);
        Utils.clearChildren(usesParent);
        var maxUses = Preparation.Uses.get(usesParent);
        if (maxUses == 1) {
            var use = Templates.inflateIn("preparation_use", usesParent);
            Preparation.Used.set(use, false);
            Preparation.Gift.set(use, true);
            Preparation.OnUseFn.copy(use, useTypes["gift"]);
        } else {
            times(maxUses).forEach(function(idx) {
                var use = Templates.inflateIn("preparation_use", usesParent);
                if (idx == maxUses - 1) {
                    Preparation.OnUseFn.copy(use, useTypes["exhaust"]);
                    Preparation.Exhaust.set(use, true);
                } else {
                    Preparation.OnUseFn.copy(use, useTypes["default"]);
                }
                Preparation.Used.set(use, false);
            });
        }

    }

    static OnDefaultUse(preparation, use) {
        Preparation.Used.set(use, true);
        return true;      
    }

    static OnExhaustUse(preparation, use) {
        use.remove();
        var usesElt = Preparation.Uses.find(preparation);        
        var uses = Preparation.Uses.get(usesElt);
        Preparation.Uses.set(usesElt, uses - 1);
        return true;      
    }

    static OnGiftUse(preparation, use) {
        var card = Card.findUp(preparation);
        var goodies = Blueprint.findAll(qs(preparation, 'info.gift'), 'preparation');
        var newPrep = Preparation.inflate(Preparations.rng.randomValue(goodies));

        Preparation.findDown(card).remove();
        card.appendChild(newPrep);        
        return false;
    }

    static canAfford(preparation) {        
        var currentGold = RunInfo.getCurrentGold(preparation);
        var cost = Preparation.Cost.findGet(preparation);
        return cost <= currentGold;
    }

    static payCostAndMaybeIncrementUsage(preparation) {
        var currentGold = RunInfo.getCurrentGold(preparation);
        var cost = Preparation.Cost.findGet(preparation);
        RunInfo.setCurrentGold(preparation, currentGold - cost);

        var shouldDiscard = Preparation.OnUse(preparation);        
        if (Preparation.HasAvailableUses(preparation)) {
            // Discard.
            return shouldDiscard;
        }
        if (Preparation.HasRemainingUses(preparation)) {
            // Return to deck.
            Preparation.resetUses(preparation);
            var current = EffectQueue.findCurrentEvent(preparation);
            var encounterParams = GameEffect.getParams(GameEffect.findParentByType(current, 'Encounter'));
            encounterParams.deck.appendChild(preparation);
            return false;
        }
        // This card is fully drained.
        preparation.remove();
        return false;
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

    static Owner(card) {
        var battlefield = BattlefieldHandler.find(card);
        var forUnit = Card.ForUnit.findGet(card);
        if (!forUnit) return Promise.resolve([]);
        return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
        function() {
            if (!Preparations.canAfford(card)) return [];
            var selector = WoofType.buildSelectorFrom('Unit', forUnit);
            return BattlefieldHandler.bfindAllInner(battlefield, selector);
        }, function() { return false; });
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

    static retreatUnit(battlefield, unit) {
        var effect = EffectQueue.findCurrentQueue(battlefield);

        return GameEffect.push(effect, GameEffect.create("UnitRetreat", {
            unit: unit
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

    static push(battlefield, targets, amount) {
        var effect = EffectQueue.findCurrentQueue(battlefield);
        return Promise.all(targets.map(function(target) {
            return GameEffect.push(effect, GameEffect.create("PushUnit", {
                target: target.target,
                direction: target.direction,
                amount: amount
            }));
        }));
    }

    static addCardToHand(cardHud, card) {
        var effect = EffectQueue.findCurrentQueue(cardHud);
        CardHud.addCardToDrawPile(cardHud, card);
        return GameEffect.push(effect, GameEffect.create("DrawCard", {
            card: card
        }));
    }
}
WoofRootController.register(Preparations);


class BuffPotions {
    static minorBaseDamage(card, target) {
        Unit.affect(target);
        BaseDamageStatus.AddStacks(target, 3);
        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static minorBaseDefense(card, target) {
        Unit.affect(target);
        BaseDefenseStatus.AddStacks(target, 3);        
        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static turtlePotion(card, target) {
        Unit.affect(target);
        Ability.findAll(target).forEach(function(ability) {
            var toEdit = Ability.CooldownDuration.find(ability);
            Ability.CurrentCooldown.set(toEdit, Ability.CurrentCooldown.get(toEdit) + 2);
        });
        DefendStatus.Apply(target, 15);
        
        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static cheetahPotion(card, target) {
        Unit.affect(target);
        Ability.findAll(target).forEach(function(ability) {
            var toEdit = Ability.CooldownDuration.find(ability);
            Ability.CurrentCooldown.set(toEdit, 1);
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

        Preparations.dealDamage(battlefield, units, 30).then(function(result) {
            if (Unit.findAllInBlock(targetBlock).length == 0) {
                CellBlock.findAllByTeam(battlefield, Teams.Player).filter(function(block) {
                    var thisCoord = BigCoord.extract(block);
                    return BigCoord.distance(thisCoord, bigCell) == 1 &&
                            FacingAttr.get(block) == FacingAttr.fromUnit(BigCoord.minus(bigCell, thisCoord));
                }).forEach(EncounterRules.setDefaultFacingOnBlock);        
            }
            EncounterRules.CheckAndTriggerEnd(battlefield);
        });

        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static iceBomb(card, target) {
        var battlefield = BattlefieldHandler.find(target);
        var targetBlock = CellBlock.findByContent(target);
        var bigCell = BigCoord.extract(targetBlock);
        
        var units = FacingAttr.allDirections().map(FacingAttr.unitDelta).map(function(delta) {
            return UberCoord.from(bigCell, SmallCoord.plus(SmallCoord.extract(target), delta));
        }).extend([UberCoord.extract(target)]).map(function(coord) {
            return BattlefieldHandler.unitAt(battlefield, coord)
        }).filter(function(unit) { return !!unit; });

        units.forEach(function(unit) {
            Ability.findAll(unit).forEach(function(ability) {
                var toEdit = Ability.CooldownDuration.find(ability);
                Ability.CurrentCooldown.set(toEdit, Ability.CurrentCooldown.get(toEdit) + 6);
            });    
        });

        Preparations.dealDamage(battlefield, units, 15).then(function(result) {
            if (Unit.findAllInBlock(targetBlock).length == 0) {
                CellBlock.findAllByTeam(battlefield, Teams.Player).filter(function(block) {
                    var thisCoord = BigCoord.extract(block);
                    return BigCoord.distance(thisCoord, bigCell) == 1 &&
                            FacingAttr.get(block) == FacingAttr.fromUnit(BigCoord.minus(bigCell, thisCoord));
                }).forEach(EncounterRules.setDefaultFacingOnBlock);        
            }
            EncounterRules.CheckAndTriggerEnd(battlefield);
        });

        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static windBomb(card, target) {
        var battlefield = BattlefieldHandler.find(target);
        var targetBlock = CellBlock.findByContent(target);
        var bigCell = BigCoord.extract(targetBlock);
        
        var units = FacingAttr.allDirections().map(function(dir) {
            return {
                uberCoord: UberCoord.from(bigCell, SmallCoord.plus(SmallCoord.extract(target), FacingAttr.unitDelta(dir))),
                dir: dir                
            };
        }).map(function(coord) {
            return  {
                unit: BattlefieldHandler.unitAt(battlefield, coord.uberCoord),
                dir: coord.dir
            };
        }).filter(function(unit) { return !!unit.unit; }).map(function(unit) {
            return {
                target: unit.unit,
                direction: unit.dir
            }
        });

        Preparations.push(battlefield, units, 40).then(function(result) {
            if (Unit.findAllInBlock(targetBlock).length == 0) {
                CellBlock.findAllByTeam(battlefield, Teams.Player).filter(function(block) {
                    var thisCoord = BigCoord.extract(block);
                    return BigCoord.distance(thisCoord, bigCell) == 1 &&
                            FacingAttr.get(block) == FacingAttr.fromUnit(BigCoord.minus(bigCell, thisCoord));
                }).forEach(EncounterRules.setDefaultFacingOnBlock);        
            }
            EncounterRules.CheckAndTriggerEnd(battlefield);
        });

        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static earthBomb(card, target) {
        var battlefield = BattlefieldHandler.find(target);
        var targetBlock = CellBlock.findByContent(target);
        var bigCell = BigCoord.extract(targetBlock);
        
        var units = FacingAttr.allDirections().map(FacingAttr.unitDelta).map(function(delta) {
            return UberCoord.from(bigCell, SmallCoord.plus(SmallCoord.extract(target), delta));
        }).extend([UberCoord.extract(target)]).map(function(coord) {
            return BattlefieldHandler.unitAt(battlefield, coord)
        }).filter(function(unit) { return !!unit; });

        units.forEach(function(unit) {
            DefendStatus.SubtractStacks(unit, 45);
        });

        return Preparations.payCostAndMaybeIncrementUsage(card);
    }
}
WoofRootController.register(OffensiveItems);


class DefensiveItems {
    static instantRetreat(card, target) {
        var battlefield = BattlefieldHandler.find(target);
        var targetBlock = CellBlock.findByContent(target);
        var bigCell = BigCoord.extract(targetBlock);

        Preparations.retreatUnit(battlefield, target).then(function(result) {
            EncounterRules._adjustActionButton(battlefield);
        });

        return Preparations.payCostAndMaybeIncrementUsage(card);
    }
}
WoofRootController.register(DefensiveItems);


class SpecialItems {

    static bombBag(card, target) {
        var cardHud = CardHud.find(card);

        var blueprintNames = ['fireBomb', 'windBomb', 'iceBomb', 'earthBomb'];
        var bpName = Preparations.rng.randomValueR(blueprintNames);

        var preparation = Preparation.findBlueprint(card, bpName);
        preparation = Preparation.inflate(preparation);
        var newCard = Card.WrapInCard(preparation);
        Card.Ephemeral.set(newCard, true);

        Preparations.addCardToHand(cardHud, newCard);

        return Preparations.payCostAndMaybeIncrementUsage(card);
    }

    static mysteryBox(card, target) {
        var result = Preparations.payCostAndMaybeIncrementUsage(card);
        if (!result) {
            // If we only have 1 use of type gift and it's already used, this thing is popping!

        }
    }
}
WoofRootController.register(SpecialItems);