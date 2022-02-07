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

class HallOfBugs {
    static OnAfterVolley = GameEffect.handle(function(handler, effect, params) {
        // Logic: See if A2 is empty, but there is at least one player unit in A3.
        // If so, spawn a bunch of bugs.        
        var battlefield = BattlefieldHandler.find(handler);
        var encounter = EncounterScreenHandler.find(battlefield);
        var a2 = CellBlock.findByLabel(battlefield, "A2");
        var a3 = CellBlock.findByLabel(battlefield, "A3");
        var a4 = CellBlock.findByLabel(battlefield, "A4");
        var unitsCrossedThreshold = [a3, a4].flatMap(function(block) {
            return Unit.findTeamInBlock(block, Teams.Player);
        }).length > 0;
        var a2Available = Unit.findTeamInBlock(a2, Teams.Player).length == 0;

        // Womp womp.
        if (!unitsCrossedThreshold || !a2Available) return;
        
        // Script go off!
        qsa(handler, ':scope > place-units').forEach(function(placeUnit) {
            EncounterGenerator.placeUnits(placeUnit, encounter);
        });

        // Remove our handler.
        handler.remove();
    });
}
WoofRootController.register(HallOfBugs);