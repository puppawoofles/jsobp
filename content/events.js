class Events {
    static success() {
        return {
            success: true
        };
    }

    static CostPerYunit = new ScopedAttr('cost-per-unit', IntAttr);
    static CostPerUnit(assignment, assignElt, units) {
        return units.length * Events.CostPerYunit.get(assignElt);
    }

    static MaxUnitsByCost(assignment, assignElt) {
        return Math.floor(RunInfo.getCurrentGold(assignment) / Events.CostPerYunit.get(assignElt));
    }

    // Nothing yet!!
    static hangOutGold(assignment, addGoldResult) {
        var units = Unit.findAll(assignment);
        return units.length;
    }

    static DamagedUnits(assignment, assignElt, units) {
        return function(unit) {
            return Unit.currentHP(unit) < Unit.maxHP(unit);
        };
    }

    static MostDamage(assignment, assignElt, units) {
        return function(a, b) {
            return (Unit.maxHP(a) - Unit.currentHP(a)) - (Unit.maxHP(b) - Unit.currentHP(b));
        };        
    }
}
WoofRootController.register(Events);