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
            var block = CellBlock.findByContent(unit);
            return TargetPicker.standardPickTarget(card, IdAttr.generate(card), function() {
                return Cell.findAllInBlock(block).filter(function(cell) {
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