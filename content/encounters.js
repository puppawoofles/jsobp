class EndConditions {

    static Location = new ScopedAttr("location", StringAttr);
    static AllAlliesIn(condition, encounter) {
        var location = EndConditions.Location.get(condition);
        var block = CellBlock.findByLabel(encounter, location);
        if (TeamAttr.get(block) != Teams.Player) return;
        
        var battlefield = BattlefieldHandler.find(encounter);
        var playerUnit = Unit.findAllByTeam(battlefield, Teams.Player);

        if (playerUnit.length == 0) return;
        if (playerUnit.findFirst(function(unit) {
            return !BigCoord.equals(BigCoord.extract(unit), BigCoord.extract(block));
        })) return;

        return {
            success: true,
            result: "victory"
        };
    }

}
WoofRootController.register(EndConditions);

class Encounters {

    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Event, NC.Encounter);
    static __encounter(innerFn) {
        return function(root) {
            var enc = innerFn(root);
            NoiseCounters.inc(NC.Encounter);
            Encounters._rng.invalidate();
            return enc;
        }
    }


    static rats = Encounters.__encounter(function(encounter) {
        var battlefield = BattlefieldHandler.find(encounter);
        var blocks = CellBlock.findAllByTeam(encounter, Teams.Enemy).filter(function(block) {
            // Only enabled blocks plz.
            return !DisabledAttr.get(block);
        });
        var cells = blocks.map(function(block) {
            return Cell.findAll(block);
        }).flat();

        var toPutRatsIn = times(8).map(function() {
            return Encounters._rng.randomValueR(cells);
        });

        toPutRatsIn.forEach(function(cell) {
            var coord = UberCoord.extract(cell);
            var blockLabel = BigGridLabel.get(CellBlock.findByCoord(encounter, UberCoord.big(coord)));
            var rat = Units.rat(encounter);
            BattlefieldHandler.addUnitTo(battlefield, rat,
                    UberCoord.big(coord), 
                    UberCoord.small(coord));
            RatAI.Apply(rat, 1);
        });
    });

    static golems = Encounters.__encounter(function(encounter) {
        var battlefield = BattlefieldHandler.find(encounter);
        var enemyBlocks = CellBlock.findAllByTeam(encounter, Teams.Enemy);
        var enemyBlock = Encounters._rng.randomValueR(enemyBlocks);
        var coords = Grid.fromEffectiveToReal(enemyBlock, Activations.back_row);
        coords.forEach(function(coord) {
            var golem = Units.golem(encounter);
            
            BattlefieldHandler.addUnitTo(battlefield, golem,
                  BigCoord.extract(enemyBlock), coord);

            RatAI.Apply(golem, 1);
        });
    });

    static jimmyTheRatKing = Encounters.__encounter(function(encounter) {
        var battlefield = BattlefieldHandler.find(encounter);
        var blocks = CellBlock.findAllByTeam(encounter, Teams.Enemy);
        var jimmyBlock = blocks.sort(function(a, b) {
            return BigCoord.extract(a)[1] - BigCoord.extract(b)[1] ||
                    BigCoord.extract(b)[0] - BigCoord.extract(a)[0];
        })[0];

        // Enemy counters
        var ratsIn = [[0,0], [0, 1], [0,2], [1,1], [1,2], [2,0], [2,1], [2,2]];

        // Populate rats.
        ratsIn.forEach(function(coord) {
            var rat = Units.rat(encounter);
            BattlefieldHandler.addUnitTo(battlefield, rat, BigCoord.extract(jimmyBlock), coord);
            RatAI.Apply(rat, 1);
        });

        var jimmy = Units.jimmyTheRatKing(encounter);
        BattlefieldHandler.addUnitTo(battlefield, jimmy, BigCoord.extract(jimmyBlock), [1, 0]);
        JimmyAI.Apply(jimmy, 1);
    });
}
WoofRootController.register(Encounters);