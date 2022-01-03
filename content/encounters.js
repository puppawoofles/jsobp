class Encounters {


    static theRats(encounter) {

        var battlefield = BattlefieldHandler.find(encounter);
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
        blocks = blocks.shuffle();
        var cells = Array.from(blocks[0].querySelectorAll("[wt~='Cell']"));
        cells = cells.concat(Array.from(blocks[1].querySelectorAll("[wt~='Cell']")));
        cells = cells.shuffle();

        // Disable the other 2.
        DisabledAttr.set(blocks[2], true);
        DisabledAttr.set(blocks[3], true);

        // Enemy counters
        var counters = {};
        for (var i = 0; i < 8; i++) {
            var block = CellBlock.findUp(cells[i]);
            var label = BigGridLabel.get(block);
            counters[label] = (counters[label] || 0) + 1;
            var rat = Units.rat();

            BattlefieldHandler.addUnitTo(battlefield, rat,
                    BigCoord.extract(block), 
                    SmallCoord.extract(cells[i]));
            RatAI.Apply(rat, 1);
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
    }

    static theGolems(encounter) {
        var battlefield = BattlefieldHandler.find(encounter);
        GridGenerator.generate(BattlefieldHandler.findGridContainer(battlefield), 2, 1);

        var playerBlock = CellBlock.findByCoord(battlefield, [0, 0]);
        TeamAttr.set(playerBlock, Teams.Player);
        FacingAttr.set(playerBlock, FacingAttr.Right);
        var enemyBlock = CellBlock.findByCoord(battlefield, [1, 0]);
        TeamAttr.set(enemyBlock, Teams.Enemy);
        FacingAttr.set(enemyBlock, FacingAttr.Left);

        // Spawn a golem on each of these spots.
        var coords = Grid.fromEffectiveToReal(enemyBlock, Activations.back_row);
        coords.forEach(function(coord) {
            var golem = Units.golem();
            
            BattlefieldHandler.addUnitTo(battlefield, golem,
                BigCoord.extract(enemyBlock), coord);

            RatAI.Apply(golem, 1);
        });
    }

    static jimmyTheRatKing(encounter) {

        var battlefield = BattlefieldHandler.find(encounter);
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

        // Enemy counters
        var ratsIn = [[0,0], [0, 1], [0,2], [1,1], [1,2], [2,0], [2,1], [2,2]];

        // Populate rats.
        ratsIn.forEach(function(coord) {
            var rat = Units.rat();
            BattlefieldHandler.addUnitTo(battlefield, rat, [1, 0], coord);
            RatAI.Apply(rat, 1);
        });

        var jimmy = Units.jimmyTheRatKing();
        BattlefieldHandler.addUnitTo(battlefield, jimmy, [1, 0], [1, 0]);
        JimmyAI.Apply(jimmy, 1);

        FacingAttr.set(CellBlock.findByCoord(battlefield, [1, 1]), FacingAttr.Up);
    }
}
WoofRootController.register(Encounters);