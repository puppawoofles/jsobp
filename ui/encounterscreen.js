class EncounterScriptCommands {

    static battlefield(elt, encounter, defs) {
        BattlefieldGen.gen(encounter, elt, defs, encounter);
    }

    static Locations = new ScopedAttr("locations", ListAttr);
    static Count = new ScopedAttr("count", IntAttr);
    static spawnUnits(elt, encounter, defs) {
        var unitCount = EncounterScriptCommands.Count.get(elt) || 1;
        var validLocations = (EncounterScriptCommands.Locations.get(elt) || []).map(function(coord) {
            if (Grid.isUberLabel(coord)) {
                return Grid.fromUberLabel(encounter, coord);
            }
            return Cell.findAllInBlock(CellBlock.findByLabel(encounter, coord));
        }).flat().filter(function(cell) {
            return !BattlefieldHandler.unitAt(encounter, UberCoord.extract(cell));
        });

        times(unitCount).forEach(function(ignore) {
            if (validLocations.length == 0) {
                return;
            }

            // TODO: Include preferred spawn locations.
            var unit = UnitGen.gen(encounter, elt, defs);
            var spawnLocation = EncounterRules._rng.randomValueR(validLocations);
            BattlefieldHandler.placeUnitAt(encounter, unit, UberCoord.extract(spawnLocation));
        });
    }

    static endCondition(elt, encounter, defs) {
        // TODO: Implement!
        var container = WoofType.findDown(encounter, 'EndConditions');
        container.appendChild(elt.cloneNode(true));
    }

    static bonusCards(elt, encounter, defs) {
        // TODO: Implement!
    }

    static For = new ScopedAttr('for', StringAttr);
    static installHandlers(elt, encounter, defs) {
        
        var handlerSet = HandlerSet.installFor(encounter, encounter);
        Utils.moveChildren(elt.cloneNode(true), handlerSet);
    }
}


class EncounterGen {
}
Utils.classMixin(EncounterGen, BPScriptBasedGenerator, GenUtils.decorateFindFor({
    finalize: function(encounter) {
        // Run some validation to help me debug.
        if (qsa(encounter, 'endCondition').length == 0) {
            throw boom("No end conditions configured for this combat.");
        }

    },
	commands: [
		BasicScriptCommands,
		MetaScriptCommands.for(EncounterGen, BattlefieldHandler.rng),
		EncounterScriptCommands
	]
}, 'encounter'));

class EncounterScreenHandler {
    static BlockHintAttr = new ScopedAttr("block-hover-hint", StringAttr);

    static findBattlefieldContainer(parent) {
        return qs(parent, ".battlefield_widget_container");
    }

    static OnCellBlockFacingChange(event, encounterScreen) {
        var block = event.target;
        var team = TeamAttr.get(block);
        if (team != Teams.Player) {
            // Don't care if this isn't a player team!
            return;
        }
        var label = BigGridLabel.get(block);
                
        var currentHoverHint = EncounterScreenHandler.BlockHintAttr.get(encounterScreen);
        if (!currentHoverHint) {
            currentHoverHint = label;
            EncounterScreenHandler.BlockHintAttr.set(encounterScreen, label);
        }
        if (currentHoverHint == label) {
            FacingAttr.copy(encounterScreen, block);
        }
    }

    static OnCellBlockMouseOver(event, encounterScreen) {
        var block = event.target;
        var team = TeamAttr.get(block);
        if (team != Teams.Player) {
            // Don't care if not player!
            return;
        }
        var label = BigGridLabel.get(block);
        EncounterScreenHandler.BlockHintAttr.set(encounterScreen, label);
    }
}

Utils.classMixin(EncounterScreenHandler, AbstractDomController, {
    matcher: '.encounter_screen',
    template: 'encounter_screen',
    params: emptyObjectFn,
    decorate: function(elt) {
        // TODO: this is where active combos will go instead!
    }
});
WoofRootController.register(EncounterScreenHandler);