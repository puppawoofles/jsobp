// Utils for move targeting stuff, like walks.
class MoveTargeting {

    /**
     * Returns an array of arrays:
     * [
     *   [A, B, C...], // We have to get through one of these targets...
     *   ...,          // To get to these targets...
     *   ...           // Until our final target here.
     * ]
     */
    static buildTargetWalk(from, to) {
        var fu = UberCoord.extract(from);
        var tu = UberCoord.extract(to);

        if (BigCoord.equals(UberCoord.big(fu), UberCoord.big(tu))) {
            // Same block.
            return MoveTargeting._targetWalkSameBlock(from, to);
        } else {
            // Different block.
            return MoveTargeting._targetWalkCrossBlock(from, to);
        }
    }

    static _targetWalkSameBlock(from, to) {
        var battlefield = BattlefieldHandler.find(from);
        var fs = SmallCoord.extract(from);
        var ts = SmallCoord.extract(to);
        var big = BigCoord.extract(to);
        if (SmallCoord.diagDistance(fs, ts) == 1) {
            // Basically right there, so may as well skip the hard parts.
            return [[BattlefieldHandler.unitAt(battlefield, to)]];
        }
        // If we have to move, assume we should use the cross-block version.
        return MoveTargeting._targetWalkCrossBlock(from, to);
    }

    static _targetWalkCrossBlock(from, to) {
        var battlefield = BattlefieldHandler.find(from);

        var fn = UberCoord.toNorm(UberCoord.extract(from));
        var tn = UberCoord.toNorm(UberCoord.extract(to));

        var walk = [];
        var unitAt = function(coord) {
            var uber = UberCoord.fromNorm(coord);            
            return BattlefieldHandler.unitAt(battlefield, uber);
        };
        var appendTo = function(coord, addTo) {
            var found = unitAt(coord);
            if (found) addTo.push(found);
        }

        while (NormCoord.diagDistance(fn, tn) > 1) {
            var delta = NormCoord.minus(tn, fn);
            var sign = NormCoord.sign(tn, fn);

            // We want to push up to 2 target sets.  The
            // [dx, dy] targets (for prioritization), and the [dx+dy] target.
            var initialTargets = [];
            if (NormCoord.x(sign) != 0) {
                appendTo(NormCoord.plus(fn, NormCoord.onlyX(sign)), initialTargets);
            }
            if (NormCoord.y(sign) != 0) {
                appendTo(NormCoord.plus(fn, NormCoord.onlyY(sign)), initialTargets);                
            }
            if (initialTargets.length > 0) walk.push(initialTargets);
            if (NormCoord.x(sign) != 0 && NormCoord.y(sign) != 0) {
                // Diagonal.
                var found = unitAt(NormCoord.plus(fn, sign));
                if (found) walk.push([found]);
            }
            // Move towards our target until we're basically adjacent to them.
            fn = NormCoord.plus(fn, sign);
        }
        var destination = unitAt(tn);
        if (destination) walk.push([destination]);

        return walk;
    }
}



class MoveUtils {

    // Active Functions.
    static UserNotInTargetLocation(activeModeElt, move) {
        var unit = Unit.findUp(move);
        var targetLocation = Unit.getTargetLocation(unit);
        if (!targetLocation) return false;
        var battlefield = BattlefieldHandler.find(unit);
        return !(targetLocation == BattlefieldHandler.cellAt(battlefield, unit));
    }

    static CellSelector = new ScopedAttr("cell-selector", StringAttr);
    static UserInMatchingTeamCell(activeModeElt, move) {
        var unit = Unit.findUp(move);
        var battlefield = BattlefieldHandler.find(unit);
        var location = BattlefieldHandler.cellAt(battlefield, unit);
        var block = CellBlock.findUp(location);
        if (TeamAttr.get(unit) != TeamAttr.get(block)) return false;
        return location.matches(MoveUtils.CellSelector.get(activeModeElt));
    }

    // Target Resolution Functions.
    static ResolveMeleeTarget(move, users, target, idealOnly, sort) {
        var mainUser = users[0];
        var battlefield = BattlefieldHandler.find(mainUser);
        var cellStart = BattlefieldHandler.cellAt(battlefield, mainUser);
        var cellEnd = BattlefieldHandler.cellAt(battlefield, target);

        // We basically need to draw a path from here to there involving minimal detours.
        // If anything is in the way, we return that.  We only return things in the way if
        // we want unideal targets.
        var walk = MoveTargeting.buildTargetWalk(cellStart, cellEnd);

        while (walk.length > 0) {
            // Basically if everything here is blocking, return the priority.
            var options = walk.shift();
            var allyPath = options.filter(function(e) {
                return Allegiance.allies(mainUser, e);
            });
            if (allyPath.length > 0) {
                // Cool!  Skip this row, we can walk through our buddy.
                continue;
            }
            // Second, let's see if there are any dudes to punch.
            var enemyPath = options.filter(function(e) {
                return Allegiance.opposed(mainUser, e)
            }).sort(sort);
            if (enemyPath.length > 0) {
                // Priority sorted, baby.
                return enemyPath[0];
            }
            // No enemy?  No ally?  We must just be cockblocked.
            if (!idealOnly) {
                return options.sort(sort)[0];
            } else {
                // No ideal target found. :(
                return null;
            }
        }
        // Clearly nothing blocking is in the way.
        return target;
    }

    // Game Effect Stuff.
    static Push(elt, newBoy) {
        var queue = EffectQueue.find(elt);
        var event = EffectQueue.findCurrentEvent(queue);
        return GameEffect.push(event, newBoy);
    }

    static Bail(elt) {
        var queue = EffectQueue.find(elt);
        var event = EffectQueue.findCurrentEvent(queue);
        return GameEffects.createResults(event);
    }

}
WoofRootController.register(MoveUtils);


class StepMove {
    static invoke(move, components, target) {
        var targetCell = Unit.getTargetLocation(target);
        if (!targetCell) return MoveUtils.Bail(move);

        // TODO: Factor in move speed and such.

        return MoveUtils.Push(move, GameEffect.create('UnitMoveToward', {
            unit: target,
            destination: targetCell,
            distance: 1
        }));
    }
}
WoofRootController.register(StepMove);

class RetreatMove {
    static invoke(move, components, target) {
        var targetCell = Unit.getTargetLocation(target);
        if (!targetCell) return MoveUtils.Bail(move);

        return MoveUtils.Push(move, GameEffect.create('UnitRetreat', {
            unit: target
        }));
    }
}
WoofRootController.register(RetreatMove);

class AttackMove {
    static invoke(move, components, target) {


        
    }
}
WoofRootController.register(AttackMove);

