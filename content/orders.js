class OrderAttr{}
Utils.classMixin(OrderAttr, StringAttr, 'order');

class RetreatOrder {
    static onApply(unit, status, params) {
        RetreatStatus.Apply(unit, 3);
        var abilities = Ability.findAll(unit);
        var skill = Ability.findSkill(unit, "retreat");

        abilities.forEach(function(ability) {
            var retreat = AbilityBlueprint.inflate({
                priority: 10,
                skillName: '',
                activeIn: []
            });
            AbilityBlueprint.applySkill(retreat, skill);
            OrderAttr.set(retreat, 'RetreatOrder');
            Ability.addBlueprint(ability, retreat);
        });
    }

    static onRemove(unit, status) {
        RetreatStatus.Remove(unit);
        var blueprints = OrderAttr.findAll(unit, 'RetreatOrder');
        blueprints.forEach(function(bp) {
            bp.remove();
        });
    }

    static merge(unit, existing, amount) { 
        if (RetreatStatus.StackCount(unit) > 0) {
            RetreatStatus.SubtractStacks(unit, 1);
        }
        return true;
    }
}
WoofRootController.register(RetreatOrder);
Utils.classMixin(RetreatOrder, BaseStatus, 'retreat_order');



class RepositionOrder {
    static onApply(unit, status, params) {
        var abilities = Ability.findAll(unit);
        
        var skill = Ability.findSkill(unit, "step");
        abilities.forEach(function(ability) {
            var retreat = AbilityBlueprint.inflate({
                priority: 10,
                skillName: '',
                activeIn: []
            });
            AbilityBlueprint.applySkill(retreat, skill);
            OrderAttr.set(retreat, 'RepositionOrder');
            Ability.addBlueprint(ability, retreat);
        });

        Unit.setStopped(unit, false);
    }

    static onRemove(unit, status) {
        var blueprints = OrderAttr.findAll(unit, 'RepositionOrder');
        blueprints.forEach(function(bp) {
            bp.remove();
        });
        Unit.setStopped(unit, true);
    }

    static OnAfterVolley = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var repositions = Array.from(RepositionOrder.findInstances(battlefield)).filter(function(p) {
            // We're looking for repositions that have been reached.
            // TODO: You were updating this method to only stop if the unit can no longer make
            // progress towards the goal.
            var unit = Unit.findUp(p);
            var cell = Unit.getTargetLocation(unit);
            var at = BattlefieldHandler.unitAt(battlefield, UberCoord.extract(cell));
            if (!!at && at == unit) return true;

            // Last check: We want to draw a path from here to there, and see if
            // we're completely blocked.
            var battlefield = BattlefieldHandler.find(handler);
            var start = UberCoord.toNorm(UberCoord.extract(unit));
            var dest = UberCoord.toNorm(UberCoord.extract(cell));
    
            var path = Grid.pathTo(start, dest, function(norm) {
                var uber = UberCoord.fromNorm(norm);
                // Make sure it's a cell.
                var cellInSpot = BattlefieldHandler.cellAt(battlefield, uber);
                if (!cellInSpot) return false;
                var block = CellBlock.findByRef(battlefield, cellInSpot);
                // And we don't care if it's blocked.
                return !DisabledAttr.get(block);
            }, function (norm) {
                var uber = UberCoord.fromNorm(norm);
                var unitInSpot = BattlefieldHandler.unitAt(battlefield, uber);
                // Moving through units is much harder.
                return !!unitInSpot ? 10 : 1;
            });
            if (!path) return true;
            for (var i = path.length - 1; i >= 0; i--) {
                var uber = UberCoord.fromNorm(path[i]);
                var unitAt = BattlefieldHandler.unitAt(battlefield, uber);
                if (!unitAt || !Unit.getStopped(unitAt)) {
                    return false;
                }
            }

            return true;
        }).forEach(function(status) {
            RepositionOrder.Remove(Unit.findUp(status), status);
        });

        return GameEffect.createResults(effect);
    })
}
WoofRootController.register(RepositionOrder);
Utils.classMixin(RepositionOrder, BaseStatus, 'reposition_order');

