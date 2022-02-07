class Tactics {
    static targetTeamExcept(card, teams, filterFn) {
        if (!Array.isArray(teams)) {
            teams = [teams];
        }
        var battlefield = BattlefieldHandler.find(card);        
        return TargetPicker.standardPickTarget(battlefield, IdAttr.generate(card),
                function() {
                    return Unit.findAll(battlefield).filter(function(unit) {
                        return teams.includes(TeamAttr.get(unit));
                    }).filter(filterFn || function() { return true; });
                },
                function(elt) {
                    return false;
                });
    }

}


class Retreat {
    static target(card) {
        return Tactics.targetTeamExcept(card, Teams.Player);
    }

    static invoke(card, target) {
        RetreatOrder.Apply(target, 0);
        return true;
    }
}
WoofRootController.register(Retreat);


class TauntEnemy {
    static target(card) {
        return Tactics.targetTeamExcept(card, Teams.not(Teams.Player), function(unit) {
            return !Unit.hasTaunt(unit, Teams.Player);
        });
    }

    static invoke(card, target) {
        Unit.setTaunt(target, Teams.Player);
        return true;
    }
}
WoofRootController.register(TauntEnemy);


class TauntAlly {
    static target(card) {
        return Tactics.targetTeamExcept(card, Teams.not(Teams.Enemy), function(unit) {
            return (TeamAttr.get(unit) == Teams.Player ||
                    (TeamAttr.get(unit) == Teams.Neutral && TeamAttr.get(CellBlock.findByContent(unit)) == Teams.Player)) &&
                    !Unit.hasTaunt(unit, Teams.Enemy);
        });
    }

    static invoke(card, target) {
        Unit.affect(target);
        Unit.setTaunt(target, Teams.Enemy);
        return true;
    }
}
WoofRootController.register(TauntAlly);


class Reposition {
    static target(card) {
        var battlefield = BattlefieldHandler.find(card);
        return Tactics.targetTeamExcept(card, Teams.Player, function(unit) {
            return !WoofType.has(unit, "GhostUnit");
        }).then(function(unit) {
            if (!unit) return null;
            var unitPrefs = Unit.getPreferredLocations(unit);

            var bigCoord = BigCoord.extract(unit);
            var allBlockOptions = FacingAttr.allDirections().map(function(dir) {
                var targetCoord = BigCoord.plus(bigCoord, FacingAttr.unitDelta(dir));
                return CellBlock.findByCoord(battlefield, targetCoord);
            }).filter(function(block) {
                // No block or disabled?  Skip.
                if (block === null) return false;
                return !DisabledAttr.get(block);
            }).extend([CellBlock.findByContent(unit)]);
            return TargetPicker.standardPickTarget(card, IdAttr.generate(card), function() {
                return allBlockOptions.flatMap(block => Cell.findAllInBlock(block)).filter(function(cell) {
                    var uberCoord = UberCoord.extract(cell);
                    return !BattlefieldHandler.unitAt(battlefield, uberCoord);
                });            
            }, function(elt) {
                // Preferred for extra bling bling.
                return WoofType.has(elt, 'Cell') && unitPrefs.contains(Grid.getEffectiveTile(elt));
            }).then(function(location) {  
                return {
                    unit: unit,
                    destination: location
                };
            });
        });
    }

    static invoke(card, target) {
        Unit.setTargetLocation(target.unit, target.destination);
        RepositionOrder.Apply(target.unit, 0);
        AgilityStatus.Apply(target.unit, 0);
        return true; // Discard this shit.
    }
}
WoofRootController.register(Reposition);



class Pivot {
    static target(card) {
        var battlefield = BattlefieldHandler.find(card);        
        var allPlayerBlocks = CellBlock.findAllByTeam(battlefield, Teams.Player).filter(function(block) {
            return Unit.findTeamInBlock(block, Teams.Player).length > 0;
        });
        var basePromise;

        if (allPlayerBlocks.length == 1) {
            basePromise = Promise.resolve(allPlayerBlocks[0]);
        } else {
            basePromise = TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                    function() {
                        return CellBlock.findAllByTeam(battlefield, Teams.Player);
                    },
                    function(block) {
                        return false;
                    });
        }

        return basePromise.then(function(block) {
            return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                    function() {
                        var enemyBlocks = Array.from(CellBlock.findAllByTeam(battlefield, Teams.Enemy)).filter(function(b) {
                            var bCoord = BigCoord.extract(b);
                            var aCoord = BigCoord.extract(block);
                            // Only adjacent.
                            if (BigCoord.distance(aCoord, bCoord) != 1) {
                                return false;
                            }
                            // Also, skip if we're already facing it.
                            var dir = FacingAttr.get(block);
                            return (dir != FacingAttr.fromTo(aCoord, bCoord));
                        });
                        return enemyBlocks;
                    },
                    function(elt) {
                        // If it has enemy units in it.
                        return Unit.findAllInBlock(elt).length > 0;
                    }).then(function(result) {
                        return {
                            target: block,
                            facing: result
                        };
                    });
        });
    }

    static invoke(card, target) {
        FacingAttr.set(target.target, FacingAttr.fromTo(
            BigCoord.extract(target.target), BigCoord.extract(target.facing)));
        return true;
    }
}
WoofRootController.register(Pivot);


class March {
    static target(card) {
        var battlefield = BattlefieldHandler.find(card);        
        var allPlayerBlocks = CellBlock.findAllByTeam(battlefield, Teams.Player).filter(function(block) {
            return Unit.findTeamInBlock(block, Teams.Player).length > 0;
        });
        var basePromise;
        if (allPlayerBlocks.length == 0) {
            return Promise.reject();
        } else if (allPlayerBlocks.length == 1) {
            basePromise = Promise.resolve(allPlayerBlocks[0]);
        } else {
            basePromise = TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                    function() {
                        return allPlayerBlocks;
                    },
                    function(block) {
                        return false;
                    });
        }

        return basePromise.then(function(block) {
            return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                    function() {
                        var bigCoord = BigCoord.extract(block);
                        return FacingAttr.allDirections().map(function(dir) {
                            var targetCoord = BigCoord.plus(bigCoord, FacingAttr.unitDelta(dir));
                            return CellBlock.findByCoord(battlefield, targetCoord);
                        }).filter(function(block) {
                            // No block or disabled?  Skip.
                            if (block === null) return false;
                            if (DisabledAttr.get(block)) return false;
                            if (TeamAttr.get(block) == Teams.Player) return true;
                            // Only blocks with no enemies in them!
                            return Teams.opposed(Teams.Player).flatMap(t => Unit.findTeamInBlock(block, t)).length == 0;
                        });
                    },
                    function(elt) {
                        return false;
                    }).then(function(result) {
                        return {
                            target: block,
                            marchTo: result
                        };
                    });
        });
    }

    static invoke(card, target) {
        var battlefield = BattlefieldHandler.find(card);
        var availableCells = Cell.findAllInBlock(target.marchTo).filter(function(cell) {
            // Filter out any cells that have stopped units in them.
            var unitAt = BattlefieldHandler.unitAt(battlefield, UberCoord.extract(cell));
            if (!unitAt) return true;
            return !Unit.getStopped(unitAt);
        }).toObject(function(cell) {
            return Grid.contextualLabelFor(cell, false);
        });

        // First pass: Any units already configured to march should have their claims
        // respected and not be in the list.
        var units = Unit.findTeamInBlock(target.target, Teams.Player).filter(function(unit) {
            var targetDestination = Unit.getTargetLocation(unit);            
            var currentTargetBlock = CellBlock.findByRef(battlefield, targetDestination);
            if (currentTargetBlock == target.marchTo) {
                // Stake the claim before anyone else grabs it.
                var dest = Grid.contextualLabelFor(targetDestination, false);
                if (availableCells[dest]) {
                    delete availableCells[dest];
                }
                return false;
            }
            return true;
        });

        // Second pass: Assign them out (by first pick, then backup picks after everyone gets their first pick)
        var sinceFirstPick = 0;
        while (units.length > 0) {
            var unit = units[0];

            var currentCoord = UberCoord.extract(unit);
            var destBigCoord = BigCoord.extract(target.marchTo);
            var targetCoord = UberCoord.from(destBigCoord, UberCoord.small(currentCoord));
            var cell = BattlefieldHandler.cellAt(battlefield, targetCoord);
            var unitAt = BattlefieldHandler.unitAt(battlefield, targetCoord);
            var label = Grid.contextualLabelFor(cell, false);

            // In this case, we should just grab our preferred spot.
            if (availableCells[label]) {
                sinceFirstPick = 0;
                Unit.setTargetLocation(unit, cell);
                delete availableCells[label];
                units.shift();
                RepositionOrder.Apply(unit, 0);
                AgilityStatus.Apply(unit, 0);
                continue;
            }
            // In this case, skip for now until everyone's had a chance for their first pick.
            if (sinceFirstPick < units.length) {
                // Skip this one for now.
                sinceFirstPick++;
                units.push(units.shift());
                continue;
            }
            // Grab whichever cell is closest to the actual target.
            var normD = NormCoord.extract(cell);
            cell = a(Object.values(availableCells)).sort(function(a, b) {
                var normA = NormCoord.extract(a);
                var normB = NormCoord.extract(b);

                return NormCoord.distance(normD, normA) - NormCoord.distance(normD, normB);
            })[0];
            if (!cell) {
                // No options left. Nobody else is getting placed. :(
                units.shift();
                continue;
            }
            Unit.setTargetLocation(unit, cell);
            label = Grid.contextualLabelFor(cell, false);
            delete availableCells[label];
            units.shift();
            RepositionOrder.Apply(unit, 0);
            AgilityStatus.Apply(unit, 0);    
        }

        return true;
    }
}
WoofRootController.register(March);


class Hustle {
    static target(card) {
        return Tactics.targetTeamExcept(card, Teams.Player);
    }

    static invoke(card, target) {
        Unit.affect(target);
        Ability.findAll(target).forEach(function(ability) {
            var toEdit = Ability.CooldownDuration.find(ability);
            Ability.CurrentCooldown.set(toEdit, Math.max(Ability.CurrentCooldown.get(toEdit) - 1, 1));
        });
        return true;
    }
}
WoofRootController.register(Hustle);



class WaitForIt {
    static target(card) {
        return Tactics.targetTeamExcept(card, Teams.Player);
    }

    static invoke(card, target) {
        Unit.affect(target);
        Ability.findAll(target).forEach(function(ability) {
            var toEdit = Ability.CooldownDuration.find(ability);
            Ability.CurrentCooldown.set(toEdit, Ability.CurrentCooldown.get(toEdit) + 1);
        });
        return true;
    }
}
WoofRootController.register(WaitForIt);