
class MoveSlot {
    static Used = new ScopedAttr("used", BoolAttr);
    static Inactive = new ScopedAttr("inactive", BoolAttr);


    static Priority = new ScopedAttr("priority", IntAttr);
    static MovesetName = new ScopedAttr("moveset_name", StringAttr);
    static Default = new ScopedAttr("default", StringAttr);

    static findAllUnitsWithReadySlot(battlefield) {
        battlefield = BattlefieldHandler.find(battlefield);        
        return IdAttr.unique(qsa(battlefield, '.battle_script [wt~="MoveSlot"] > [current-cooldown="1"]')
                .map(moveSlot => WoofType.findUp(moveSlot, "Unit")));
    }

    static CurrentCooldown = new ScopedAttr("current-cooldown", IntAttr);
    static CooldownDuration = new ScopedAttr("cooldown-duration", IntAttr);
    static getReadyMovesWithTargets(unit) {
        var slot = MoveSlot.findUp(qs(unit, '.battle_script [wt~="MoveSlot"] > [current-cooldown="1"]'));
        if (!slot) return [];
        return qsa(slot, "[wt~=Move]:not([inactive=true])").map(function(move) {
            // These are in the DOM in priority order.  Neat!
            var targets = Move.findTargets(move);
            if (targets.length == 0) return null;
            return {
                move: move,
                // This complex shit is in preparation for combos.
                usedBy: [
                    {move: move, unit: unit}
                ],
                targets: targets
            };
        }).filter(e => !!e);
    }

    static resetCooldown(slot) {
        MoveSlot.CurrentCooldown.findSetAll(slot, MoveSlot.CooldownDuration.findGet(slot));
    }

    static tickCooldown(slot) {
        var current = MoveSlot.CurrentCooldown.findGet(slot);
        if (current > 1) {
            MoveSlot.CurrentCooldown.findSetAll(slot, current - 1);
        }
    }

    static currentCooldown(slot) {
        return MoveSlot.CurrentCooldown.findGet(slot);
    }

    static OnMoveActiveChange(event, handler) {
        var active = Move.findAllWith(handler, Move.Inactive.buildAntiSelector(true));
        Move.Inactive.set(handler, active.length == 0);
    }
}
Utils.classMixin(MoveSlot, AbstractDomController, {
    matcher: "[wt~=MoveSlot]",
    template: "move_slot",
    decorate: function(elt, bp) {
        // This is a weird one in that we don't copy our blueprint directly.   
        // Appearance.
        MoveSlot.MovesetName.findGetCopySetAll(bp, elt);
        // TODO: Description, skip for now.
    }
});


class Move {


    static ResolveTargetFn = new ScopedAttr("resolve-target-fn", FunctionAttr);
    static resolveTarget(move, users, target, ideal) {
        var found = Move.ResolveTargetFn.findDown(move);
        if (!found) return target;
        return Move.ResolveTargetFn.get(found, move, users, target, ideal);
    }

    static InvokeFn = new ScopedAttr('invoke-fn', FunctionAttr);
    static invoke(moveElt, blobs, target) {
        var found = Move.InvokeFn.findDown(moveElt);
        var returnValue = Move.InvokeFn.invoke(found, moveElt, blobs, target);
        if (isPromise(returnValue)) return returnValue;
        return Promise.resolve(returnValue);
    }

    static refreshActive(parent) {
        Move.findAll(parent).forEach(Move.isActive);
    }

    static ActiveFn = new ScopedAttr('active-fn', FunctionAttr);
    static Inactive = new ScopedAttr('inactive', BoolAttr);
    static isActive(move) {
        var active = Move._isActive(move);
        Move.Inactive.set(move, active ? undefined : true);
        return active;
    }

    static _isActive(move) {        
        var activeMoveElts = qsa(move, 'active-mode');
        // Backup mode: If you have a target, we can do the thing.
        if (activeMoveElts.length == 0) {
            return Move.findTargets(move).length > 0;
        }

        // This will return the first active fn that fails.
        return !activeMoveElts.findFirst(function(elt) {
            // Active if true, so we return false here so it runs through them.
            return !Move.ActiveFn.invoke(elt, elt, move);
        });
    }
    static MoveIcon = new ScopedAttr("move_icon", StringAttr);


    /** TODO: Consider splitting this up somehow. */
    static TargetMode = new ScopedAttr("target-mode", StringAttr);
    static TargetType = new ScopedAttr("target-type", StringAttr);
    static EffectiveFrom = new ScopedAttr("effective-from", ListAttr);
    static findTargets(move) {
        var battlefield = BattlefieldHandler.find(move);
        var user = Unit.findUp(move);
        var inCell = BattlefieldHandler.cellAt(battlefield, user);
        var inZone = CellBlock.findByRef(battlefield, user);
        var baseTeam = TeamAttr.get(user);

        return qsa(move, 'target-mode').map(function(modeElt) {
            // Special case: Self target just returns self.
            var targetType = Move.TargetType.findGet(modeElt);
            var targetMode = Move.TargetMode.findGet(modeElt) || null;
            var effectivePos = Move.EffectiveFrom.findGet(modeElt) || [];

            if (targetType == 'self') {
                return [user];
            }
            var found = [];
            switch (targetMode) {
                case "AT":
                    // Adjacent tiles.
                    found = Grid.adjacentCells(inCell).map(function(cell) {
                        return BattlefieldHandler.unitAt(battlefield, cell);
                    }).filter(e => !!e);
                    break;
                case "SZ":
                    found = Unit.findAllInBlock(inZone);
                    break;
                case "AZ":
                    found = Direction.allDirections().filter(function(dir) {
                        // First, check that the block even exists.
                        var thatBlock = CellBlock.findByCoord(battlefield, BigCoord.plus(BigCoord.extract(inZone), Direction.coordDelta(dir)));
                        if (!thatBlock || !CellBlock.isActive(thatBlock)) {
                            return false;
                        }
                        
                        // Then check if we're active.
                        var withDir = effectivePos.map(ep => `${dir}-${ep}`);
                        return !!withDir.findFirst(function(selector) {
                            return inCell.matches(`[wt~=CellBlock] [effective-positions~="${selector}"]`);
                        });
                    }).map(function(dir) {
                        // We can target all units in this direction.
                        return Unit.findAllInBlock(CellBlock.findByCoord(battlefield, BigCoord.plus(BigCoord.extract(inZone), Direction.coordDelta(dir))))
                    }).flat();
                    break;
            }
            var opposed = Teams.opposed(baseTeam);
            switch(Move.TargetType.findGet(move)) {
                case "hostile":
                    return found.filter(function(unit) {
                        if (opposed.includes(TeamAttr.get(unit))) {
                            return true;
                        }
                        // TODO: Taunted neutrals.
                        return false;
                    });
                    break;
                case "ally":
                    return found.filter(function(unit) {
                        return TeamAttr.get(unit) == baseTeam;
                    });
                    break;
            }
        }).flat();
    }
}
Utils.classMixin(Move, AbstractDomController, {
    matcher: "[wt~=Move]",
    template: "move",
    decorate: function(elt, blueprint) {
        var bp = blueprint.cloneNode(true);
        WoofType.findDown(elt, "MoveBP").appendChild(bp);
        
        // Copy icons over.
        var holder = qs(elt, '.appearance_holder');
        var bpIcon = Move.MoveIcon.find(bp);
        Move.MoveIcon.copy(holder, bpIcon);

        // Set priority if relevant.
        var priorityHolder = MoveSlot.Priority.find(bp);
        if (priorityHolder) MoveSlot.Priority.copy(elt, bp);
    }
});














/** Move Generators down here at the bottom. */

class MoveSlotScriptCommands {
    static setMoves(elt, moveSet, defs) {
        var moveHolder = qs(moveSet, '.move_container');
        // Clean this out, since we're setting moves here.
        Utils.clearChildren(moveHolder);

        a(elt.children).forEach(function(child) {
            moveHolder.appendChild(MoveGen.gen(null, child, defs));
        });
    }
}

class MoveSlotGen {

}
Utils.classMixin(MoveSlotGen, BPScriptBasedGenerator, GenUtils.decorateFindFor({
    normalizeObject: MoveSlot.inflate,
    commands: [
        BasicScriptCommands,
        MetaScriptCommands.for(MoveSlotGen, UnitGen._rng),
        MoveSlotScriptCommands
    ]
}, 'move-slot'));

class MoveScriptCommands {
    // Custom Commands go here.
    static IntValue = new ScopedAttr("value", IntAttr);
    static priority(elt, move, defs) {
        var newValue = MoveScriptCommands.IntValue.get(elt);
        MoveSlot.Priority.set(MoveSlot.Priority.find(move), newValue);
    }
}

class MoveGen {
    // Custom Invokes go here.
}
Utils.classMixin(MoveGen, BPScriptBasedGenerator, GenUtils.decorateFindFor({
    normalizeObject: Move.inflate,
    commands: [
        BasicScriptCommands,
        MetaScriptCommands.for(MoveGen, UnitGen._rng),
        MoveScriptCommands
    ]
}, 'move'));
WoofRootController.register(MoveGen);