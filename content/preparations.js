
class Preparations {

    static canAfford(preparation) {        
        var currentGold = RunInfo.getCurrentGold(preparation);
        var cost = Preparation.Cost.findGet(preparation);
        return cost <= currentGold;
    }

    static payCostAndMaybeIncrementUsage(preparation) {
        var currentGold = RunInfo.getCurrentGold(preparation);
        var cost = Preparation.Cost.findGet(preparation);
        RunInfo.setCurrentGold(preparation, currentGold - cost);

        var uses = Preparation.Used.findAll(preparation, false);
        Preparation.Used.set(uses[0], true);
        if (uses.length == 1) {
            // This card is exhausted for now.
            Preparation.resetUses(preparation);
            RunInfo.addToDeck(preparation, preparation);
            return false;
        }
        return true;
    }
}


class Barricade {
    static target(card) {
        var battlefield = BattlefieldHandler.find(card);
        return TargetPicker.standardPickTarget(card, IdAttr.generate(card),
                function() {
                    if (!Preparations.canAfford(card)) return [];
                    return CellBlock.findAllByTeam(battlefield, Teams.Player).map(function(block) {
                        return Cell.findAllInBlock(block).filter(function(cell) {
                            return !BattlefieldHandler.unitAt(battlefield, UberCoord.extract(cell));
                        });
                    }).flat();
                },
                function(elt) {
                    return false;
                });

    }

    static invoke(card, target) {
        var battlefield = BattlefieldHandler.find(card);        
        var barricade = Units.barricade();
        BattlefieldHandler.addUnitTo(battlefield, barricade, BigCoord.extract(target), SmallCoord.extract(target));
        return Preparations.payCostAndMaybeIncrementUsage(card);
    }
}
WoofRootController.register(Barricade);