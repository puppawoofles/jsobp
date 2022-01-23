
class BattlefieldHandler {

    static findGridContainer(elt) {
        return qs(BattlefieldHandler.find(elt), ".battlefield_widget_inner");
    }

    static findCells(elt, blockSelector, cellSelector) {
        blockSelector = blockSelector || "";
        cellSelector = cellSelector || "";
        return qsa(BattlefieldHandler.find(elt), blockSelector + "[wt~='CellBlock']:not([disabled='true']) [wt~='Cell']" + cellSelector);
    }

	static CellBlock = new ScopedAttr("in-block", StringAttr);
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

    static unitAt(battlefield, uberCoord) {
		var overlay = BattlefieldHandler.findOverlay(battlefield);
        return qs(overlay, UberCoord.selector(uberCoord));
    }

	static cellAt(battlefield, uberCoord) {		
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

}
Utils.classMixin(BattlefieldHandler, AbstractDomController, {
    matcher: '.battlefield_widget',
    template: 'battlefield',
    params: emptyObjectFn
})
WoofRootController.register(BattlefieldHandler);