class BasicAI {
    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Encounter, NC.Round);
    static PreferredLocations = new ScopedAttr("preferred-locations", ListAttr);
    static OnAfterVolley = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var units = Array.from(BasicAI.findInstances(BattlefieldHandler.find(handler))).map(function(elt) {
            return {
                unit: Unit.findUp(elt),
                status: elt
            };
        });
        units.forEach(function(blorb) {
            var team = TeamAttr.get(blorb.unit);
            var position = Grid.getEffectiveTile(blorb.unit);
            var currentBlock = CellBlock.findByContent(blorb.unit);
            var preferredLocations = BasicAI.PreferredLocations.findGet(blorb.unit) || [];
            if (preferredLocations.length == 0 || preferredLocations.includes(position)) {
                // This rat is about as happy as can be.
                return;
            }
            // Alternative: Enemy wants CC and has CC.
            if (preferredLocations.includes(Grid.CloseCombat)) {
                if (!!Unit.findAllInBlock(currentBlock).findFirst(function(unit) {
                    return !TeamAttr.matches(unit, blorb.unit);
                })) {
                    // This unit wants melee, got melee.
                    return;
                }
            }
            var options = [];
            if (preferredLocations.includes(Grid.CloseCombat)) {
                // Special case: This enemy wants to get way up in your business.
                // Find any blocks that have enemy units in them.
                options.extend(CellBlock.findAll(battlefield).filter(function(block) {
                    // Has some enemy units in them.
                    return Teams.opposed(team).flatMap(oTeam => Unit.findTeamInBlock(block, oTeam)).length > 0;
                }).flatMap(function(block) {
                    // Find open cells.
                    return Cell.findAllInBlock(block);
                }).filter(function(cell) {
                    return !BattlefieldHandler.unitAt(battlefield, UberCoord.extract(cell));
                }).map(function(cell) {
                    return UberCoord.extract(cell);
                }));            
            }
            var current = SmallCoord.extract(blorb.unit);
            options.extend(Grid.fromEffectiveToReal(currentBlock, preferredLocations).map(function(coord) {
                return UberCoord.from(BigCoord.extract(blorb.unit), coord);
            }).filter(function(uber) {
                // Only return free spots.
                return !BattlefieldHandler.unitAt(battlefield, uber);
            }));

            BasicAI._rng.shuffle(options);
            if (options.length == 0) return;

            BasicAI._rng.shuffle(options);
            options = options.sort(function(a, b) {
                return SmallCoord.distance(current, UberCoord.small(a)) - SmallCoord.distance(current, UberCoord.small(b));
            });

            Unit.setTargetLocation(blorb.unit, BattlefieldHandler.cellAt(battlefield, options[0]));
        });
        return GameEffect.createResults(effect);
    });
}
WoofRootController.register(BasicAI);
Utils.classMixin(BasicAI, BaseStatus, 'basic_ai');


class BugCurlUp {}
Utils.classMixin(BugCurlUp, BaseStatus, 'bug_curl_up');

class BugEnemy {
    static CurlUpAfterHit = GameEffect.handle(function(handler, effect, params, result) {
        var target = params.target;
        if (!BugCurlUp.Has(target)) return;
        if (params.main_type != DamageTypes.MELEE) return;
        if (DefendStatus.StackCount(target) > 0) return;

        DefendStatus.AddStacks(target, BugCurlUp.StackCount(target));
    });

    static SpitWeb(units, ability, params, invokedEffects, targets, effect) {
        var amount = units.map(unit => Unit.getCunning(unit)).merge(sumMerge);

        targets.forEach(function(unit) {
            Ability.findAll(unit).forEach(function(target) {
                var toEdit = Ability.CurrentCooldown.find(ability);
                Ability.CurrentCooldown.set(toEdit, Ability.CurrentCooldown.get(toEdit) + Math.max(1, amount));
            });
        });
        return GameEffect.createResults(effect);
    }
}
WoofRootController.register(BugEnemy);

class WebDamageReduction {}
Utils.classMixin(WebDamageReduction, BaseStatus, 'web_damage_reduction');

class WebObstacle {
    static BeforeDamage = GameEffect.handle(function(handler, effect, params) {
        var target = params.target;
        if (!WebDamageReduction.Has(target)) return;
        var reducedTypes = [DamageTypes.THROWN, DamageTypes.RANGED];
        if (!reducedTypes.includes(params.main_type)) return;

        // Reduce to 1 because only strike works well on this thing.
        params.amount = 1;
        GameEffect.setParams(effect, params);
    });

}
WoofRootController.register(WebObstacle);


class GenericMoves {
    static Amount = new ScopedAttr("amount", IntAttr);
    static Status = new ScopedAttr("status", StringAttr);
    static AddStatus(units, ability, params, invokedEffects, targets, effect) {
        var skill = Ability.findSkillFor(ability);
        var amount = GenericMoves.Amount.get(skill);
        var status = GenericMoves.Status.get(skill);    
        units.forEach(function(unit) {
            BaseStatus.AddStacks(status, unit, amount);
        });
        return GameEffect.createResults(effect);
    }
}
WoofRootController.register(GenericMoves);

/** TODO: Deprecate this in favor of BasicAI above. */
class RatAI {

    static OnAfterVolley = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var preferredEffectivePositions = ["F1", "F2", "F3"];
        var rats = Array.from(RatAI.findInstances(BattlefieldHandler.find(handler)))
                .map(function(elt) {
                    return {
                        unit: Unit.findUp(elt),
                        status: elt
                    };
                });
        rats.forEach(function(blorb) {
            var position = Grid.getEffectiveTile(blorb.unit);
            if (preferredEffectivePositions.includes(position)) {
                // This rat is happy.
                return;
            }
            var block = CellBlock.findByRef(battlefield, blorb.unit);
            var current = SmallCoord.extract(blorb.unit);
            var options = Grid.fromEffectiveToReal(block, ["F1", "F2", "F3"]).map(function(coord) {
                return UberCoord.from(BigCoord.extract(blorb.unit), coord);
            }).filter(function(uber) {
                // Only return free spots.
                return !BattlefieldHandler.unitAt(battlefield, uber);
            }).shuffle().sort(function(a, b) {
                return SmallCoord.distance(current, UberCoord.small(a)) - SmallCoord.distance(current, UberCoord.small(b));
            });

            if (options.length == 0) {
                // No options.
                return;
            }

            Unit.setTargetLocation(blorb.unit, BattlefieldHandler.cellAt(battlefield, options[0]));
        });
        return GameEffect.createResults(effect);
    });
   

}
WoofRootController.register(RatAI);
Utils.classMixin(RatAI, BaseStatus, 'rat_ai');


class JimmyAI {

    // Jimmy's AI does 3 things:
    // 1) Gives every rat the ability to combo if they don't have it.
    // 2) Finds a spot behind someone or something to hide behind for his scurry ability
    // 3) On the first round combat, display an annoying banner.

    static BannerDisplayed = new ScopedAttr("jimmy-ai-banner-displayed", BoolAttr);
    static OnAfterVolley = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var jimmy = Units.UnitLabel.find(battlefield, "jimmy");
        if (!jimmy) return;

        var block = CellBlock.findByContent(jimmy);
        var facing = Grid.getFacing(jimmy);
        var fd = FacingAttr.unitDelta(facing);
        var banner = false;

        // Display annoying banner.
        if (!JimmyAI.BannerDisplayed.get(jimmy)) {
            JimmyAI.BannerDisplayed.set(jimmy, true);
            banner = true;
            UiTreatments.banner(handler, "Ahuhuhu!  Welcome to my lair!");
        }

        // Buff rats.
        var rats = Units.UnitLabel.findAll(battlefield, "rat");
        var buffTaunts = [
            "My rats are specially trained!",
            "Want to see a trick?",
            "I trained them myself!",
            "Think you can keep up?",
            "Wow, I'm annoying!"
        ];
        rats.filter(function(rat) {
            return !JimmyBlessing.Has(rat);
        }).forEach(function(rat) {
            if (!banner) {
                banner = true;
                UiTreatments.banner(handler, randomValue(buffTaunts));
            }
            JimmyBlessing.Apply(rat, 1);
        });

        // Find hiding spot.
        var hidingSpotsInOrder = Grid.fromEffectiveToReal(block, ["B3", "B1", "B2", "M3", "M1", "M2"]);
        var bc = BigCoord.extract(block);
        var selected = hidingSpotsInOrder.filter(function(coord) {
            // If there isn't at least one hiding blocking this spot, it's not good enough.
            var coverIn = SmallCoord.plus(coord, fd);
            var cover = BattlefieldHandler.unitAt(battlefield, UberCoord.from(bc, coverIn));
            if (!cover) return false;
            // Enemies aren't cover.
            if (Teams.opposed(TeamAttr.get(jimmy)).includes(TeamAttr.get(cover))) return false;
            return !!cover;
        }).map(function(spot) {
            return UberCoord.from(bc, spot);
        })[0];

        if (!selected && !banner && Math.random() < 0.05) {
            banner = true;
            UiTreatments.banner(handler, "I have nowhere to hide!");
        }

        if (selected) {
            Unit.setTargetLocation(jimmy, BattlefieldHandler.cellAt(battlefield, selected));
        };

        if (banner) {
            return new Promise(function(resolve, reject) {
                window.setTimeout(resolve, 1000);
            });
        }
    });


    static redirectInvoke(units, ability, params, invokedEffects, targets, effect) {
        var jimmy = units[0];
        var jimmyBlock = CellBlock.findByContent(jimmy);
        var opposing = Teams.opposed(TeamAttr.get(jimmy));

        var jC = SmallCoord.extract(jimmy);
        var rats = Unit.findAllInBlock(jimmyBlock).filter(function(unit) {
            if (unit == jimmy) return false; // Jimmy doesn't wat to be the target.
            return !opposing.includes(TeamAttr.get(jimmy));
        }).sort(function(a, b) {
            // Furthest way from Jimmy.
            var aC = SmallCoord.extract(a);
            var bC = SmallCoord.extract(b);
            return SmallCoord.distance(bC, jC) - SmallCoord.distance(aC, jC);
        });
        if (rats.length == 0) {
            return GameEffect.createResults(effect);
        }

        var existingTaunt = rats.filter(function(unit) {
            var toReturn = false;
            opposing.forEach(function(team) {
                toReturn ^= Unit.hasTaunt(unit, team);
            });
            return !!toReturn;
        })[0];

        if (!existingTaunt) {
            opposing.forEach(function(team) {
                Unit.setTaunt(rats[0], team);
            });
            existingTaunt = rats[0];
        }

        DefendStatus.Apply(existingTaunt, params.baseDefense);
        return GameEffect.createResults(effect);        
    }


    static summonInvoke(units, ability, params, invokedEffects, targets, effect) {
        var ratHP = 10 + Mana.total(params.mana) * 2;

        var jimmy = units[0];
        var jimmyBlock = CellBlock.findByContent(jimmy);
        var opposing = Teams.opposed(TeamAttr.get(jimmy));

        var block = CellBlock.bfindAll(jimmy).filter(function(b) {
            // Only enabled ones.
            return !DisabledAttr.get(b);            
        }).sort(function(a, b) {
            // Prioritize his own cell because jimmy loves meat shields.
            if (a == jimmyBlock) {
                return -1;
            }
            if (b == jimmyBlock) {
                return 1;
            }
            // Prioritize hero cells because chaos in the ranks.
            if (TeamAttr.get(a) != TeamAttr.get(b)) {
                if (opposing.includes(TeamAttr.get(a))) return -1;
                return 1;
            }
            // Prioritize whoever is fuller.
            return Unit.findAllInBlock(a).length - Unit.findAllInBlock(b).length;
        }).filter(function(block) {
            // No full blocks. :(
            return Unit.findAllInBlock(block).length < 9
        })[0];

        if (!block) {
            // Oh shit, everywhere is full.
            return GameEffect.createResults(effect);
        }

        var cells = Cell.findAllInBlock(block).filter(function(cell) {
            // Find empty ones.
            var uberCoord = UberCoord.extract(cell);
            var unit = BattlefieldHandler.unitAt(jimmy, uberCoord);
            return !unit;
        });
        cells.shuffle();
        var location = UberCoord.extract(cells[0]);

        var rat = UnitGenerator.generate('enemy_rat');

        var battlefield = BattlefieldHandler.findUp(jimmy);
        TeamAttr.set(rat, TeamAttr.get(jimmy));
        BattlefieldHandler.addUnitTo(battlefield, rat, UberCoord.big(location), UberCoord.small(location));
        Unit.setMaxHP(rat, ratHP);
        Unit.setCurrentHP(rat, ratHP);
        return GameEffect.createResults(effect);
    }
   

}
WoofRootController.register(JimmyAI);
Utils.classMixin(JimmyAI, BaseStatus, 'jimmy_ai');

class JimmyBlessing {

    static onApply(unit, status) {
        Unit.Month.set(unit, "????");
        Unit.ComboWith.add(unit, "????");
        Unit.ComboSelf.add(unit, "????");
        Mana.Attr.set(unit, "????");
    }

    static onRemove(unit, status) {
        Unit.Month.set(unit);
        Unit.ComboWith.remove(unit, "????");
        Unit.ComboSelf.remove(unit, "????");        
        Mana.Attr.set(unit);
    }
}
WoofRootController.register(JimmyBlessing);
Utils.classMixin(JimmyBlessing, BaseStatus, 'jimmy_blessing');