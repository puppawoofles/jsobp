class InitiativeOrderAttr {}
Utils.classMixin(InitiativeOrderAttr, ListAttr, "initiative-order");

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