class Events {
    static success() {
        return {
            success: true
        };
    }

    static CostPerYunit = new ScopedAttr('cost-per-unit', IntAttr);
    static CostPerUnit(assignment, units) {        
        return units.length * Events.CostPerYunit.findGet(assignment);
    }

    // Nothing yet!!
    static hangOutGold(assignment, addGoldResult) {
        var units = Unit.findAll(assignment);
        return units.length;
    }

    // Returns true if all units are damaged.
    static DamagedUnits(assignment, units) {
        return !units.findFirst(function(unit) {
            return Unit.currentHP(unit) >= Unit.maxHP(unit);
        });
    }

    static MostDamage(assignment, assignElt, units) {
        return function(a, b) {
            return (Unit.maxHP(a) - Unit.currentHP(a)) - (Unit.maxHP(b) - Unit.currentHP(b));
        };        
    }
}
WoofRootController.register(Events);


class LostCity {

    static ProgressMin = new ScopedAttr("progress-min", IntAttr);
    static progress(elt, progress) {
        return progress >= LostCity.ProgressMin.get(elt);
    }

    static ItemAvailable(elt) {
        // TODO: Figure out how to do this.
        return false;
    }

    static MakeProgress(elt, progress) {
        return progress++;
    }
}
WoofRootController.register(LostCity);