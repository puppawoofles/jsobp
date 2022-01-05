class Retreat {
    static target(card) {
        var battlefield = BattlefieldHandler.find(card);        
        return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                function() {
                    return Array.from(Unit.findAllByTeam(battlefield, 'player')) || [];
                },
                function(elt) {
                    return false;
                });
    }

    static invoke(card, target) {
        RetreatOrder.Apply(target, 0);
        return true;
    }
}
WoofRootController.register(Retreat);


class TauntEnemy {
    static target(card) {
        var battlefield = BattlefieldHandler.find(card);        
        return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                function() {
                    return Unit.findAll(battlefield).filter(function(unit) {
                        return TeamAttr.get(unit) != Teams.Player &&
                                !Unit.hasTaunt(unit, Teams.Player);
                    });
                },
                function(elt) {
                    return false;
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
        var battlefield = BattlefieldHandler.find(card);        
        return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                function() {
                    return Unit.findAll(battlefield).filter(function(unit) {
                        // Can taunt any ally or any neutral in ally territory.
                        return (TeamAttr.get(unit) == Teams.Player ||
                            (TeamAttr.get(unit) == Teams.Neutral && TeamAttr.get(CellBlock.findByContent(unit)) == Teams.Player)) &&
                            !Unit.hasTaunt(unit, Teams.Enemy);
                    });
                },
                function(elt) {
                    return false;
                });
    }

    static invoke(card, target) {
        Unit.setTaunt(target, Teams.Enemy);
        return true;
    }
}
WoofRootController.register(TauntAlly);


class Reposition {
    static target(card) {
        var battlefield = BattlefieldHandler.find(card);        
        return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                function() {
                    var found = Array.from(Unit.findAllByTeam(battlefield, 'player')) || [];
                    return found;                    
                },
                function(elt) {
                    return false;
                }).then(function(unit) {
                    // Bail if bullshit.
                    if (!unit) {
                        return null;
                    }
                    var battlefield = BattlefieldHandler.find(card);        
                    var unitPrefs = Unit.getPreferredLocations(unit);
                    var root = BattlefieldHandler.findGridContainer(battlefield);
            
                    return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                            function() {
                                var cells = Array.from(BattlefieldHandler.findCells(root, "[team='player']"));
                                cells = cells.filter(function(cell) {
                                    var coord = Cell.uberCoord(cell);
                                    var big = UberCoord.big(coord);
                                    var foundUnit = BattlefieldHandler.unitAt(battlefield, coord);
                                    return !foundUnit && BigCoord.equals(big, BigCoord.extract(unit));
                                });
                                return cells;
                            },
                            function(elt) {
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
        var allPlayerBlocks = CellBlock.findAllByTeam(battlefield, Teams.Player);
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
