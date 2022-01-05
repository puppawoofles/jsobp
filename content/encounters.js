class Encounters {

    static rats(encounter) {
        var battlefield = BattlefieldHandler.find(encounter);
        var blocks = CellBlock.findAllByTeam(encounter, Teams.Enemy).filter(function(block) {
            // Only enabled blocks plz.
            return !DisabledAttr.get(block);
        });
        var cells = blocks.map(function(block) {
            return Cell.findAll(block);
        }).flat();
        cells.shuffle();
        var toPutRatsIn = cells.splice(0, 8);        

        toPutRatsIn.forEach(function(cell) {
            var coord = UberCoord.extract(cell);
            var blockLabel = BigGridLabel.get(CellBlock.findByCoord(encounter, UberCoord.big(coord)));
            var rat = Units.rat();
            BattlefieldHandler.addUnitTo(battlefield, rat,
                    UberCoord.big(coord), 
                    UberCoord.small(coord));
            RatAI.Apply(rat, 1);
        });
    }

    static golems(encounter) {
        var battlefield = BattlefieldHandler.find(encounter);
        var enemyBlocks = CellBlock.findAllByTeam(encounter, Teams.Enemy);
        enemyBlocks.shuffle();
        var enemyBlock = enemyBlocks[0];

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
        var blocks = CellBlock.findAllByTeam(encounter, Teams.Enemy);
        var jimmyBlock = blocks.sort(function(a, b) {
            return BigCoord.extract(a)[1] - BigCoord.extract(b)[1] ||
                    BigCoord.extract(b)[0] - BigCoord.extract(a)[0];
        })

        // Enemy counters
        var ratsIn = [[0,0], [0, 1], [0,2], [1,1], [1,2], [2,0], [2,1], [2,2]];

        // Populate rats.
        ratsIn.forEach(function(coord) {
            var rat = Units.rat();
            BattlefieldHandler.addUnitTo(battlefield, rat, BigCoord.extract(jimmyBlock), coord);
            RatAI.Apply(rat, 1);
        });

        var jimmy = Units.jimmyTheRatKing();
        BattlefieldHandler.addUnitTo(battlefield, jimmy, BigCoord.extract(jimmyBlock), [1, 0]);
        JimmyAI.Apply(jimmy, 1);
    }
}
WoofRootController.register(Encounters);