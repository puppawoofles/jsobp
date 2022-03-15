/**
 * All of our <goap-node> Expand functions.
 */
class GoapModes {

    static MoveRequirements(nodeOption, req, dataOption, unit) {
        return qsa(dataOption.move, 'goap-pnode > req');
    }


    // Given a unit, creates movesets based on the provided node.
    static Movesets() {
        return [];
    }
}
WoofRootController.register(GoapModes);

/**
 * All of our <goap-action> invokes.
 */
class GoapAction {
    static SetDestination(action, unit, data, resources) {
        if (resources['destination']) return;
        resources['destination'] = true;

        Unit.setTargetLocation(unit, data.destination);
    }

    static SetTarget(action, unit, data, resources) {
        if (resources['target']) return;
        resources['target'] = true;

        Unit.setTarget(unit, data.target);
    }

    static ActivateMove(action, unit, data, resources) {
        var slotId = IdAttr.generate(data.slot);
        if (resources[slotId]) return;
        resources[slotId] = true;

        Move.Inactive.set(data.move);
        qsa(data.slot, WoofType.buildSelector("Move")).forEach(function(m) {
            if (data.move !== m) {
                Move.Inactive.set(m, true);
            }
        });
    }
}
WoofRootController.register(GoapAction);

/**
 * All of our <goap-data> evals.
 */
class GoapData {
    /** A base impl that makes an ev and returns it. */
    static _Base(func) {
        return function(reqElt, params, unit) {
            var ev = Goap.BaseEvalFor(reqElt);
            func(ev, reqElt, params, unit);
            return ev;
        };
    }


    static Matching = new ScopedAttr('matching', StringAttr);
    static Team = new ScopedAttr('team', StringAttr);
    static Mode = new ScopedAttr('mode', StringAttr);

    static HasMoveActive = GoapData._Base(function(ev, reqElt, params, unit) {
        // Always return blocked so the AI evaluates all move options.
        Goap.MarkBlocked(ev);

        var matcher = GoapData.Matching.get(reqElt);
        var slots = MoveSlot.findAll(qs(unit, '.battle_script')).map(function(slot) {
            return {
                slot: slot,
                moves: Move.findAll(slot).filter(function(move) {
                    return move.matches(matcher);
                })
            };
        });

        slots.map(function(slot) {
            return slot.moves.map(function(move) {
                return {
                    slot: slot.slot,
                    move: move
                };
            });
        }).flat().forEach(function(slots) {
            // TODO: calculate cost based on the slots.
            Goap.AddEvalOption(ev, slots, 1);
        });
    });

    static HasDestination = GoapData._Base(function(ev, reqElt, param, unit) {
        Goap.AddEvalOption(ev, param, 0);

        var targetLocation = Unit.getTargetLocation(unit);
        var uberLabel = Grid.uberLabelFor(param.destination);

        Goap.MarkBlocked(ev, uberLabel != targetLocation);
    });

    static HasEnemyTarget = GoapData._Base(function(ev, reqElt, params, unit) {                
        var target = Unit.getTarget(unit);
        if (params.target == target) {
            return;
        }
        Goap.MarkBlocked(ev, true);
        Goap.AddEvalOption(ev, {}, 0);
    });

    /** Verifies if were at the location, and if not, returns those as options. */
    static AtLocation = GoapData._Base(function(ev, reqElt, params, unit) {
        var mode = GoapData.Mode.get(reqElt);
        if (mode === 'move_target') {
            return GoapData.AtLocation_MoveTarget(ev, reqElt, params, unit);
        }
        if (GoapData.Matching.has(reqElt)) {
            return GoapData.AtLocation_Matcher(ev, reqElt, params, unit);
        }
    });

    static AtLocation_Matcher(ev, reqElt, params, unit) {
        var matcher = GoapData.Matching.get(reqElt);
        var battlefield = BattlefieldHandler.find(unit);

        if (GoapData.Team.has(reqElt)) {
            var unitTeam = TeamAttr.get(unit);
            switch (GoapData.Team.get(reqElt)) {
                case 'allied':
                    matcher = `[wt~="CellBlock"][team="${unitTeam}"] ${matcher}`;
                    break;
                case 'opposed':
                    var opposed = Teams.opposed(unitTeam);
                    matcher = opposed.map(t => `[wt~="CellBlock"][team="${unitTeam}"] ${matcher}`).join(',');
                    break;
            }
        }

        var cell = BattlefieldHandler.cellAt(battlefield, unit);
        Goap.MarkBlocked(ev, !cell.matches(matcher));

        Cell.findAll(battlefield).filter(function(cell) {
            return cell.matches(matcher);
        }).forEach(function(option) {
            var distance = NormCoord.distance(UberCoord.toNorm(unit), UberCoord.toNorm(option));
            // Favor close-by stuff.
            Goap.AddEvalOption(ev, {
                destination: option
            }, distance, IdAttr.generate(option));
        });
    }

    static AtLocation_MoveTarget(ev, reqElt, params, unit) {
        // We want to figure out where we have to be to hit this boy.
        var move = params.move;
        var target = params.target;

        var locations = Move.findUsablePositions(move, target);
        var battlefield = BattlefieldHandler.find(unit);
        var standing = BattlefieldHandler.cellAt(battlefield, unit);

        if (!locations.includes(standing)) {
            Goap.MarkBlocked(ev);
        }

        locations.forEach(function(loc) {
            var distance = NormCoord.distance(UberCoord.toNorm(standing), UberCoord.toNorm(loc));
            Goap.AddEvalOption(ev, {
                destination: loc
            }, distance, IdAttr.generate(loc));
        });
    }


    static UnobstructedPathToDestination = GoapData._Base(function(ev, reqElt, params, unit) {
        var battlefield = BattlefieldHandler.find(unit);
        var startCoord = UberCoord.toNorm(unit);
        var destCoord = UberCoord.toNorm(params.destination);

        var path = Grid.pathTo(startCoord, destCoord, function(norm) {
            var uber = UberCoord.fromNorm(norm);
            // Make sure it's a cell.
            var cellInSpot = BattlefieldHandler.cellAt(battlefield, uber);
            if (!cellInSpot) return false;
            var block = CellBlock.findByRef(battlefield, cellInSpot);
            return !DisabledAttr.get(block);
        }, function(norm) {
            var uber = UberCoord.fromNorm(norm);
            var blocked = BattlefieldHandler.unitAt(battlefield, uber);
            if (!blocked) return 1;
            return (TeamAttr.get(unit) == TeamAttr.get(blocked)) ? 1 : 15;
        }).map(function(coord) {
            return BattlefieldHandler.cellAt(battlefield, UberCoord.fromNorm(coord));
        });

        // Check if we're obstructed.
        var allObstructions = path.map(function(cell) {
            var found = BattlefieldHandler.unitAt(battlefield, cell);
            if (!found || found == unit) return null;
            return found;
        }).filter(u => !!u);

        var obstructions = allObstructions.filter(function(found) {
            return (TeamAttr.get(unit) == TeamAttr.get(found)) ? null : found;
        });

        if (allObstructions.length > 0) {
            Goap.MarkBlocked(ev);
        }

        Goap.AddEvalOption(ev, {
            path: path,
            obstructions: obstructions
        }, (allObstructions.length * 5) + path.length);
    });
    
    // Goal: Obstacles are now targets.
    static UnobstructPath = GoapData._Base(function(ev, reqElt, params, unit) {
        if (params.obstructions.length > 0) {
            Goap.MarkBlocked(ev);
        }
        Goap.AddEvalOption(ev, {
            targets: params.obstructions.clone()
        }, params.obstructions.length);
    });

    /** Populates {target:} for each of our potential enemies. */
    static EnemiesAlive = GoapData._Base(function(ev, reqElt, params, unit) {
        // If something else set some targets, carry those forward.
        var targets = params.targets || [];
        if (targets.length == 0) {
            // TODO: Implement this.
            // You should factor in targeting.

        }
        if (targets.length > 0) {
            Goap.MarkBlocked(ev);
        }

        targets.forEach(function(target) {
            // TODO: Figure out how to cost these targets.
            Goap.AddEvalOption(ev, {
                target: target
            }, 0, IdAttr.generate(target));
        });
    });


}
WoofRootController.register(GoapData);



/**
 * A wrapper thing that knows how to kick off the GOAP node stuff.
 */
class Goals {
    static __cached = null;

    static __precache() {
        if (!Goals.__cached) {
            Goals.__cached = fa('goap-node[tag~="goal"]').toObject(function(key) {
                return Goap.N.get(key);
            });
        }
        return Goals.__cached.clone();
    }


    static TestHandler = GameEffect.handle(function(handler, effect, params) {
        var b = BattlefieldHandler.find(handler);
        Unit.findAll(b).forEach(Goals.doTheThing);
    });



    static InvokeFn = new ScopedAttr('invoke-fn', FunctionAttr)
    static doTheThing(unit) {

        var goals = qsa(unit, 'goal');

        // For now, just do them in order.
        if (goals.length == 0) return;


        var result;
        for (var i = 0; i < goals.length && !result; i++) {
            result = Goals.InvokeFn.invoke(goals[i], unit);
        }
        if (!result) return;

        // Flip our actions around.
        result.actions.reverse();

        var resources = {};
        result.actions.forEach(function(actionStuff) {
            Goals.InvokeFn.invoke(actionStuff.action, actionStuff.action, unit, actionStuff.data, resources);
        });

    }

    static Flee(unit) {
        var cached = Goals.__precache();
        return Goap.goap(cached['flee'], unit);
    }

}
WoofRootController.register(Goals);