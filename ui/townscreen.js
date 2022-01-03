class TownScreen {
    static EncounterFn = new ScopedAttr("encounter-fn", StringAttr);
    static OnEncounterClick(event, handler) {
        var queue = EffectQueue.currentQueue(handler);        
        var townScreen = TownScreen.find(handler);
        var container = WoofType.findUp(townScreen, "ScreenWrapper");

        DialogScreen.Show(handler, UnitSelect, {
            minUnits: 1,
            maxUnits: 8,
            extraClasses: "encounter_config",
            deck: RunInfo.getDeck(handler).filter(function(card) {
                return Card.CardType.findGet(card) == 'unit';
            })
        }).then(function(units) {
            var deck = RunInfo.getDeck(handler).filter(function(card) {
                return Card.CardType.findGet(card) != 'unit';
            }).map(WoofType.buildSelectorFor);
            deck.extend(units);

            return GameEffect.push(queue, GameEffect.create("Encounter", {
                encounter: TownScreen.EncounterFn.get(event.target),
                container: WoofType.buildSelectorFor(townScreen),
                deck: deck
            })).then(function(result) {
                // Clean up the encounter.
                Logger.info("Cleaning up encounter screen.");
                var encounterScreen = WoofType.find(container, "Screen");
                var old = Screen.showScreen(encounterScreen, WoofType.buildSelector("TownScreen"));
                if (old) old.remove();
    
                // Deal with rewards.
                if (result.result.win) {
                    var gold = RunInfo.getCurrentGold(townScreen);
                    RunInfo.setCurrentGold(townScreen, gold + 50);
                }
            });
        }, function() {});
    }
}
WoofRootController.register(TownScreen);
Utils.classMixin(TownScreen, AbstractDomController, {
    template: 'town_screen',
    matcher: '[wt~="TownScreen"]',
    params: function() {
        return {};
    }
});