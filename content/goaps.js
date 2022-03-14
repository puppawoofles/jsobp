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
        // TODO: Implement to set a target like we do with destinations.
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
        var obstructions = path.map(function(cell) {
            var found = BattlefieldHandler.unitAt(battlefield, cell);
            if (!found || found == unit) return null;
            return (TeamAttr.get(unit) == TeamAttr.get(found)) ? null : found;
        }).filter(u => !!u);

        if (obstructions.length > 0) {
            Goap.MarkBlocked(ev);
        }

        Goap.AddEvalOption(ev, {
            path: path,
            obstructions: obstructions
        }, obstructions.length + path.length);
    });

    static UnobstructPath = GoapData._Base(function(ev, reqElt, params, unit) {
        Goap.MarkBlocked(ev);
        Goap.AddEvalOption(ev, {}, 1);
    });
    
    static UnobstructPath = GoapData._Base(function(ev, reqElt, params, unit) {
        Goap.MarkBlocked(ev);
        Goap.AddEvalOption(ev, {}, 0);
    });
    
    // Goal: Obstacles are now targets.
    static UnobstructPath = GoapData._Base(function(ev, reqElt, params, unit) {
        Goap.MarkBlocked(ev);
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