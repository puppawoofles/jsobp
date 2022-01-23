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
    var cellBlock = qs(handler, blockSelector);
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
}