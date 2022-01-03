ConsoleCommands.register("setup", function(handler, params) {
    Screen.hideScreen(handler);
    var selected = !!params ? ConsoleCommandUtils.parseParams(params) : "__default";
    Logger.info("Using " + selected + " setup");
    TestSetup[selected](handler, params);
});

ConsoleCommands.register("draw", function(handler, params) {
    var queue = EffectQueue.findDown(handler);
    GameEffect.enqueue(queue, GameEffect.create("DrawCard", {}));
});

ConsoleCommands.register("discard", function(handler, params) {
    var queue = EffectQueue.findDown(handler);
    GameEffect.enqueue(queue, GameEffect.create("DiscardCards", {
        random: true,
        count: 1
    }));
});

ConsoleCommands.register("targetcheck", function(handler, params) {
    var parts = params.split(' ');
    var coordString = parts[0];
    var coordParts = coordString.split(".");
    if (coordParts.length != 2) {
        Logger.info("Can't read coords out of params", coordString);
        return;
    }
    var blockSelector = CellBlock.labelSelector(coordParts[0]);
    var cellBlock = handler.querySelector(blockSelector);
    if (!cellBlock) {
        Logger.info("Can't find cell block", coordParts[0]);
        return;
    }
    var cell = Cell.findByLabel(cellBlock, coordParts[1]);
    if (!cell) {
        Logger.info("Can't find cell", coordParts[1], "in", coordParts[0]);
        return;
    }
    var type = parts[1] || "Targeting.StandardEnemy";
    if (type == ".") type = "Targeting.StandardEnemy";

    var config = {
        CC: false,
        travelMode: "walk",
        unit: false,
    };
    for (var i = 2; i < parts.length; i++) {
        var subParts = parts[i].split("=");
        config[subParts[0]] = subParts[1];
    }

    var team = config.team || TeamAttr.get(cellBlock);
    var unit = BattlefieldHandler.unitAt(cellBlock, UberCoord.extract(cell));
    if (unit) {
        if (!config.team) team = TeamAttr.get(unit);
        if (config.unit) {
            // TODO: look up the next command and do the thing.
        }
    }

    var targets = WoofRootController.invokeController(type, [cell, team, config]);
    DomHighlighter.highlight(cell);
    targets.forEach(function(unit) {
        DomHighlighter.highlight(unit);
    });
});

class TestSetup {
    static reset(handler, params) {
        var mainScreen = MainScreenHandler.find(handler);       
		Utils.clearChildren(mainScreen);
    }

    static __default(handler, params) {
        var mainScreen = MainScreenHandler.find(handler);       
        var encounter = EncounterScreenHandler.inflateIn(mainScreen);
        var teams = [Teams.Player, Teams.Enemy];
        InitiativeOrderAttr.put(encounter, teams);

        var container = CardHud.find(encounter);
        CardHud.inflateIn(container, [
            Units.sample_hero(mainScreen),
            Units.sample_hero(mainScreen),
            Units.sample_hero(mainScreen),
            Units.sample_hero(mainScreen),
            Units.sample_hero(mainScreen),
            Tactic.inflate(Tactic.findBlueprint(mainScreen, "retreat")),
            Tactic.inflate(Tactic.findBlueprint(mainScreen, "reposition")),
            Tactic.inflate(Tactic.findBlueprint(mainScreen, "pivot"))
        ]);

        // Set up battlefield.
        var battlefield = BattlefieldHandler.inflateIn(EncounterScreenHandler.findBattlefieldContainer(encounter));
        GridGenerator.generate(BattlefieldHandler.findGridContainer(battlefield), 3, 3);
        // Remove corners.
        DisabledAttr.set(CellBlock.findByCoord(battlefield, [0, 0]), true);
        DisabledAttr.set(CellBlock.findByCoord(battlefield, [0, 2]), true);
        DisabledAttr.set(CellBlock.findByCoord(battlefield, [2, 0]), true);
        DisabledAttr.set(CellBlock.findByCoord(battlefield, [2, 2]), true);
        // Set the middle one as a player-enabled one.
        TeamAttr.set(CellBlock.findByCoord(battlefield, [1, 1]), Teams.Player);

        // Left enemy grid
        TeamAttr.set(CellBlock.findByCoord(battlefield, [0, 1]), Teams.Enemy);
        FacingAttr.set(CellBlock.findByCoord(battlefield, [0, 1]), FacingAttr.Right);

        // Top enemy grid
        TeamAttr.set(CellBlock.findByCoord(battlefield, [1, 0]), Teams.Enemy);
        FacingAttr.set(CellBlock.findByCoord(battlefield, [1, 0]), FacingAttr.Down);

        // Right enemy grid
        TeamAttr.set(CellBlock.findByCoord(battlefield, [2, 1]), Teams.Enemy);
        FacingAttr.set(CellBlock.findByCoord(battlefield, [2, 1]), FacingAttr.Left);

        // Bottom enemy grid
        TeamAttr.set(CellBlock.findByCoord(battlefield, [1, 2]), Teams.Enemy);
        FacingAttr.set(CellBlock.findByCoord(battlefield, [1, 2]), FacingAttr.Up);

        // Grab 2 blocks to put enemies in.
        var blocks = Array.from(battlefield.querySelectorAll("[team='enemy']"));
        blocks.shuffle();
        var cells = Array.from(blocks[0].querySelectorAll("[wt~='Cell']"));
        cells = cells.concat(Array.from(blocks[1].querySelectorAll("[wt~='Cell']")));
        cells.shuffle();

        // Enemy counters
        var counters = {};
        for (var i = 0; i < 8; i++) {
            var block = CellBlock.findUp(cells[i]);
            var label = BigGridLabel.get(block);
            counters[label] = (counters[label] || 0) + 1;

            BattlefieldHandler.addUnitTo(battlefield, Units.rat(),
                    BigCoord.extract(block), 
                    SmallCoord.extract(cells[i]))
        }

        // Find the label with the most enemies.
        var winningLabel = null;
        for (var [key, object] of Object.entries(counters)) {
            if (!winningLabel || counters[winningLabel] < object) {
                winningLabel = key;
            }
        }

        // Face the good team towards the bad guys.
        var targetCoords = BigCoord.extract(CellBlock.findByLabel(battlefield, winningLabel));
        FacingAttr.set(CellBlock.findByCoord(battlefield, [1, 1]),
                FacingAttr.fromTo([1, 1], targetCoords));


        // Draw a hand of cards.
        EncounterRules.OnStartRound(null, battlefield);

        // Draw a hand of cards.
        var queue = EffectQueue.findDown(mainScreen);
        // TODO: Round counter.
        GameEffect.enqueue(queue, GameEffect.create("RefillHand", {}));
    }
}