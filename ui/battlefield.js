class BattlefieldHandler {
	static rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Round, NC.Encounter, NC.Event);

    static findGridContainer(elt) {
        return qs(BattlefieldHandler.find(elt), ".battlefield_widget_inner");
    }

    static findCells(elt, blockSelector, cellSelector) {
        blockSelector = blockSelector || "";
        cellSelector = cellSelector || "";
        return qsa(BattlefieldHandler.find(elt), blockSelector + "[wt~='CellBlock']:not([disabled='true']) [wt~='Cell']" + cellSelector);
    }

	static CellBlock = new ScopedAttr("in-block", StringAttr);
	// Deprecate this one eventually!
    static addUnitTo(parentElt, unit, bigCoord, smallCord) {
		var overlay = BattlefieldHandler.findOverlay(parentElt);
        var block = CellBlock.findByCoord(parentElt, bigCoord);
		Unit.CellBlock.set(unit, BigGridLabel.get(block));
        BigCoord.write(unit, bigCoord);
        SmallCoord.write(unit, smallCord);
		if (!TeamAttr.get(unit)) TeamAttr.copy(unit, block);
		IdAttr.generate(unit);
		overlay.appendChild(unit);
		Unit.join(unit);
	}

	static placeUnitAt(parentElt, unit, uberCoord) {
		var bigCoord = UberCoord.big(uberCoord);
		var smallCoord = UberCoord.small(uberCoord);
		var overlay = BattlefieldHandler.findOverlay(parentElt);
        var block = CellBlock.findByCoord(parentElt, bigCoord);
		Unit.CellBlock.set(unit, BigGridLabel.get(block));
        BigCoord.write(unit, bigCoord);
        SmallCoord.write(unit, smallCoord);
		if (!TeamAttr.get(unit)) TeamAttr.copy(unit, block);
		IdAttr.generate(unit);
		overlay.appendChild(unit);
		Unit.join(unit);
	}

    static unitAt(battlefield, uberCoord) {
		uberCoord = UberCoord.extract(uberCoord);
		var overlay = BattlefieldHandler.findOverlay(battlefield);
        return qs(overlay, UberCoord.selector(uberCoord));
    }

	static cellAt(battlefield, uberCoord) {	
		uberCoord = UberCoord.extract(uberCoord);	
		return Utils.bfind(battlefield, '.encounter_screen', BigCoord.selector(UberCoord.big(uberCoord)) + " " +
			WoofType.buildSelector("Cell") + SmallCoord.selector(UberCoord.small(uberCoord)));
	}

    static unitsOn(battlefield, bigCoord) {
		var overlay = BattlefieldHandler.findOverlay(battlefield);
        return qsa(overlay, BigCoord.selector(bigCoord));
    }

    static findOverlay(mainElt) {
		return Utils.bfind(mainElt, '.encounter_screen', '.battlefield_widget_overlay');
	}

    static OnOverlayItemMove(evt, handler) {
		var battlefield = BattlefieldHandler.find(handler);
		var unit = evt.detail.node;		
		BattlefieldHandler._positionUnit(battlefield, unit);

		var bigAttrs = [BigXAttr.key(), BigYAttr.key()];		
		if (bigAttrs.includes(evt.detail.attribute)) {
			var newCoord = BigCoord.extract(unit);
			var block = CellBlock.findByCoord(handler, newCoord);
			Unit.CellBlock.set(unit, BigGridLabel.get(block));
		}

		if (evt.detail.oldValue !== null && evt.detail.oldValue !== undefined) {
			WoofRootController.dispatchNativeOn(battlefield, 'UnitMoved', {
				unit: unit
			});			
		}
	}
	
	static OnOverlayItemAdd(evt, handler) {
		var target = evt.detail.child;
		if (!WoofType.has(target, 'Unit')) {
			return;
		}
		var unit = evt.detail.child;
		BattlefieldHandler._positionUnit(handler, unit);

		var battlefield = BattlefieldHandler.find(unit);
		WoofRootController.dispatchNativeOn(battlefield, 'NewUnit', {
			unit: unit
		});
		var block = CellBlock.findByContent(unit);
		BattlefieldHandler.updateBlockAllegiance(block);
	}
	
	static OnOverlayItemRemove(evt, handler) {
		var target = evt.detail.child;
		if (!WoofType.has(target, 'Unit')) {
			return;
		}
		
		var battlefield = BattlefieldHandler.find(handler);
		WoofRootController.dispatchNativeOn(battlefield, 'RemovedUnit', {
			unit: target
		});
	}

	static OnOverlayItemMoveTo(evt, handler) {
		var from = evt.detail.from;
		var to = evt.detail.to;
		if (!BattlefieldHandler.findUp(from) && !!BattlefieldHandler.findUp(to)) {
			BattlefieldHandler.OnOverlayItemAdd(evt, handler);
		}
	}

    static _positionUnit(parentElt, unitElt) {
        var battlefield = BattlefieldHandler.find(unitElt);
        var blockCoord = BigCoord.extract(unitElt);
		var coordinateCoord = SmallCoord.extract(unitElt);
        var block = CellBlock.findByCoord(parentElt, blockCoord);
        var cell = Cell.findByCoord(block, coordinateCoord);

		if (!cell) return false;
		// We need to factor in the offset from our screen containers.
		var heightOffset = 0;

		// Deal with nested screens.
		var screen = WoofType.findUp(battlefield, "ScreenWrapper");
		while (screen) {
			// Weird hack.  Who cares.
			if (!WoofType.has(screen, "MainScreen")) heightOffset += -screen.offsetTop;
			screen = WoofType.findUp(screen.parentNode, "ScreenWrapper")
		}

        var rect = cell.getClientRects()[0];
        var unitRect = unitElt.getClientRects()[0];
		var left = battlefield.scrollLeft + rect.left + (rect.width - unitRect.width) / 2;
        // Weird hack to make heights work again. :(
		var top = heightOffset + battlefield.scrollTop + rect.top - unitRect.height - 5 + (rect.height) / 2;		
		unitElt.style.cssText = "left: " + left + "px; top: " + top + "px;";
	}

	static resetUnit(unitElt) {
		unitElt.style.cssText = '';
	}

	static updateBlockAllegiance(block) {
		var unitCounts = {};
		unitCounts[Teams.Player] = 0;
		unitCounts[Teams.Enemy] = 0;
		Unit.findAllInBlock(block).filter(function(unit) {
			return TeamAttr.get(unit) != Teams.Neutral;
		}).groupBy(function(unit) {
			unitCounts[TeamAttr.get(unit)] += 1;
		});

		if (unitCounts[Teams.Player] > 0 && unitCounts[Teams.Enemy] > 0) {
			// This one is still contested.
			return;				
		}
		if (unitCounts[Teams.Player] > 0) {
			TeamAttr.set(block, Teams.Player);
		}
		if (unitCounts[Teams.Enemy] > 0) {
			TeamAttr.set(block, Teams.Enemy);
		}
	}

	static onMoveBlock(event, handler) {
		var oldLabel = event.detail.oldValue;
        var newLabel = event.detail.newValue;

		var blocks = [];
		if (oldLabel) {
			blocks.push(CellBlock.findByLabel(handler, oldLabel));
		}
		if (newLabel) {
			blocks.push(CellBlock.findByLabel(handler, newLabel));
		}

		blocks.forEach(function(block) {
			BattlefieldHandler.updateBlockAllegiance(block)
		});
	}

	static findEnemyInBlock(block, team) {
		return Teams.opposed(team).map(function(t) {
			return Unit.findTeamInBlock(block, t);
		}).flat();
	}

	static refreshThreat(event, handler) {
		// We got a signal to recalculate threats.
		BlockThreats.refreshAll(handler);
	}
}
Utils.classMixin(BattlefieldHandler, AbstractDomController, {
    matcher: '.battlefield_widget',
    template: 'battlefield',
    params: emptyObjectFn
})
WoofRootController.register(BattlefieldHandler);


/**
 * You know how we do "direction-effectivePos" as a shortcut?  Yeah,
 * this is basically direction-team as a similar shortcut.  Hooray for
 * storing tuples 'n shit.
 * 
 * Basically the way this works, though, is that we store threats to other
 * teams.  In other words, "player-left" means one block to the left, there
 * is something that is threatening the player team.
 * 
 * This combines to mean if:
 *  - Move X is active in F1, F2, F3
 *  - The Unit is on Team Y
 *  - The Block has "Y-up" in its threats list.
 *  then the move can be used in positions up-F1, up-F2, and up-F3.
 */
class BlockThreats {
	static Threats = new ScopedAttr("threats", ListAttr);
	static buildSelector(team, direction) {
		return "[threats~='" + team + "-" + direction + "']"
	}

	static buildValue(team, direction) {
		return team + "-" + direction;
	}

	static threatsAt(block, team) {
		// Grab the property and split the strings.
		return (BlockThreats.Threats.findGet(block) || []).map(function(threat) {
			return threat.split("-");
		}).filter(function(tuple) {
			// Compare the teams to make sure this is a threat for that team.
			return tuple[0] == team;
		}).map(function(tuple) {
			// But then only return the direction.
			return tuple[1];
		});
	}

	static refreshAll(baseElt) {
		var unitLookups = {};

		CellBlock.findAll(baseElt).forEach(function(bBlock) {
			var toSet = {};
			var directions = [Direction.None].concat(Direction.allDirections());
			var baseCoord = BigCoord.extract(bBlock);

			directions.forEach(function(direction) {
				var delta = Direction.coordDelta(direction);
				var block = CellBlock.findByCoord(baseElt, BigCoord.plus(baseCoord, delta));
				if (!block) return;
				if (DisabledAttr.get(block)) return;

				// Set up / use our memoized thing to reduce lookups.
				var bid = IdAttr.generate(block);
				if (!unitLookups[bid]) unitLookups[bid] = Unit.findAllInBlock(block);

				unitLookups[bid].forEach(function(unit) {
					Teams.opposed(TeamAttr.get(unit)).forEach(function(oTeam) {
						toSet[oTeam + "-" + direction] = true;
					});
				});
			});
			
			BlockThreats.Threats.set(bBlock, a(Object.keys(toSet)));
		});
	}
}






/* Battlefield Generator */
class BattlefieldScriptCommands {
    static BattlefieldFn = new ScopedAttr('battlefield-fn', FunctionAttr);

	/** Generate geometry. */
	static geo(elt, battlefield, defs) {
		BattlefieldScriptCommands.BattlefieldFn.invoke(elt, elt, battlefield, defs);
	}

    static Fn = new ScopedAttr('fn', FunctionAttr);
    static Labels = new ScopedAttr('labels', ListAttr);
    
	/** Invoke a sub-script on respective blocks. */
	static forBlocks(elt, battlefield, defs) {
		var labels = BattlefieldScriptCommands.Labels.get(elt);
		labels.forEach(function(label) {
			var block = CellBlock.findByLabel(battlefield, label);
			ScriptShortcuts.runScriptFor(elt, [BasicScriptCommands], block, defs);
		});
	}

	static forCells(elt, battlefield, defs) {
		var labels = BattlefieldScriptCommands.Labels.get(elt);
		labels.forEach(function(label) {
			var cell = Grid.fromUberLabel(battlefield, label);
			ScriptShortcuts.runScriptFor(elt, [BasicScriptCommands], cell, defs);
		});
	}

}

class BattlefieldGen {
	static Width = new ScopedAttr('width', IntAttr);
    static Height = new ScopedAttr('height', IntAttr);
	static generateRect(elt, battlefield, defs) {
        var width = BattlefieldGen.Width.get(elt);
        var height = BattlefieldGen.Height.get(elt);
        // And go.
        GridGenerator.generate(BattlefieldHandler.findGridContainer(battlefield), width, height);
	}

	// Util Functions.
}
Utils.classMixin(BattlefieldGen, BPScriptBasedGenerator, GenUtils.decorateFindFor({
	// No normalizeObject: Shouldn't be called!
	commands: [
		BasicScriptCommands,
		MetaScriptCommands.for(BattlefieldGen, BattlefieldHandler.rng),
		BattlefieldScriptCommands
	]
}, 'battlefield'));
WoofRootController.register(BattlefieldGen);