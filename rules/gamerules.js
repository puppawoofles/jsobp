class GameRules {
    static RunTicket = new ScopedAttr("run-ticket", StringAttr);
    static RunEffect = new ScopedAttr("run-effect", StringAttr);

    static NewRun = GameEffect.handle(function(handler, effect, params) {
        Logger.info("Got a request for a run!");
        var ticket = PendingOpAttr.takeTicket(effect, "NewRun");

        var runScreen = RunScreen.inflate();

        // Store what we need to in order to fix this run.
        GameRules.RunTicket.set(runScreen, ticket);
        GameRules.RunEffect.set(runScreen, WoofType.buildSelectorFor(effect));
    
        // Put up the run screen.
        Screen.showScreen(handler, runScreen);

        // Next up, generate the starter deck.
        var starterDeck = [
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Tactic.inflate(Tactic.findBlueprint(handler, "retreat")),
            Tactic.inflate(Tactic.findBlueprint(handler, "reposition")),
            Tactic.inflate(Tactic.findBlueprint(handler, "pivot")),
            Tactic.inflate(Tactic.findBlueprint(handler, "taunt-enemy")),
            Tactic.inflate(Tactic.findBlueprint(handler, "taunt-ally")),
            Preparation.inflate(Preparation.findBlueprint(handler, "barricade"))
        ];
        starterDeck.forEach(function(content) {
            var card = Card.inflate(Utils.UUID());
            card.appendChild(content);
            RunInfo.addToDeck(runScreen,card);
        });
        RunInfo.setCurrentGold(handler, params.startingGold);




    });
}
WoofRootController.register(GameRules);