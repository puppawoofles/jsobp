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

class HuntForFoodEncounter {

    static SpawnSelector = new ScopedAttr("spawn-selector", StringAttr);
    static SpawnCount = new ScopedAttr("spawn-count", IntAttr);
    static LocationFilter = new ScopedAttr("location-filter", FunctionAttr);
    static TargetBlock = new ScopedAttr('target-block', StringAttr);
    static SpawnDeer = GameEffect.handle(function(handler, event, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var spawnCount = HuntForFoodEncounter.SpawnCount.get(handler) || 0;
        if (spawnCount <= 0) {
            handler.remove();
            return;
        }

        var selector = HuntForFoodEncounter.SpawnSelector.get(handler);
        var cellSelector = WoofType.buildSelector('Cell');
        var locations = qsa(battlefield, selector).filter(function(elt) {
            return elt.matches(cellSelector);
        }).filter(e => HuntForFoodEncounter.LocationFilter.invoke(handler, battlefield, e));
        if (locations.length == 0) return;

        var location = BattlefieldHandler.rng.randomValue(locations);
        var uberCoord = UberCoord.extract(location);

        var unit = UnitGen.gen(battlefield, qs(handler, 'unit-gen'));
        BattlefieldHandler.placeUnitAt(battlefield, unit, uberCoord);

        // Set its preferred location.
        var norm = UberCoord.toNorm(uberCoord);
        // Since the deer are going left, we want to see how far left they can go.
        var preferredNorm = BasicAI.PreferredLocations.get(unit).map(function(label) {
            return UberCoord.toNorm(UberCoord.extract(Grid.fromUberLabel(battlefield, label)));
        }).sort(function(a, b) {
            // If we grab the closest one, we'll grab the one in the same row.
            return NormCoord.distance(norm, a) - NormCoord.distance(norm, b);
        })[0];
    
        var uberDest = UberCoord.fromNorm(preferredNorm);
        var destCell = BattlefieldHandler.cellAt(battlefield, uberDest);
        
        Unit.setTargetLocation(unit, destCell);

        HuntForFoodEncounter.SpawnCount.set(handler, spawnCount - 1);
    });

    static DespawnLocations = new ScopedAttr("despawn-locations", ListAttr);
    static DespawnSelector = new ScopedAttr("despawn-selector", StringAttr);
    static DespawnDeer = GameEffect.handle(function(handler, event, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var candidates = HuntForFoodEncounter.DespawnSelector.get(handler);
        var despawnLocations = HuntForFoodEncounter.DespawnLocations.get(handler);
        // TODO: Make this feel less weird.
        qsa(battlefield, candidates).filter(function(elt) {
            var cell = BattlefieldHandler.cellAt(battlefield, elt);
            var label = Grid.uberLabelFor(cell);
            return despawnLocations.includes(label);
        }).forEach(function(deer) {
            Unit.retreat(deer);
            deer.remove();    
        });
    });

    static SpawnLocationFilter(battlefield, cell) {
        var uberCoord = UberCoord.extract(cell);
        if (BattlefieldHandler.unitAt(battlefield, uberCoord)) return false;

        // If any adjacent tiles are full, skip them.
        return !Grid.adjacentCells(cell).findFirst(function(cell) {
            var coord = UberCoord.extract(cell);
            return BattlefieldHandler.unitAt(battlefield, coord);
        });
    };
}
WoofRootController.register(HuntForFoodEncounter);