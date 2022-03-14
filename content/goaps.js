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
        // TODO: Implement.
    });

    static AtLocation = GoapData._Base(function(ev, reqElt, params, unit) {
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
        }).map(function(cell) {
            return {
                destination: cell
            };
        }).forEach(function(option) {
            var distance = NormCoord.distance(
                    UberCoord.toNorm(unit), UberCoord.toNorm(option.destination));
            // Favor close-by stuff.
            Goap.AddEvalOption(ev, option, distance);
        });
    });

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
        var obstructions = !!path.map(function(cell) {
            var found = BattlefieldHandler.unitAt(battlefield, cell);
            if (!found || found == unit) return null;
            return (TeamAttr.get(unit) == TeamAttr.get(found)) ? null : found;
        }).filter(u => !!u);

        Goap.AddEvalOption(ev, {
            path: path,
            obstructions: obstructions
        }, obstructions.length + path.length);
    });
}
WoofRootController.register(GoapData);