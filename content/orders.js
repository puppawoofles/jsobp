class OrderAttr{}
Utils.classMixin(OrderAttr, StringAttr, 'order');

class RetreatOrder {
    static onApply(unit, status, params) {
        RetreatStatus.Apply(unit, 3);
        var abilities = Ability.findAll(unit);

        abilities.forEach(function(ability) {
            var retreat = AbilityBlueprint.inflate({
                priority: 10,
                skillName: 'retreat',
                activeIn: Activations.all_rows
            });
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

        abilities.forEach(function(ability) {
            var retreat = AbilityBlueprint.inflate({
                priority: 10,
                skillName: 'step',
                activeIn: Activations.all_rows
            });
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
            var unit = Unit.findUp(p);
            var bigCoord = BigCoord.extract(unit);
            var targetLocation = Unit.getTargetLocation(unit);
            var block = CellBlock.findByCoord(battlefield, bigCoord);
            var cell = Cell.findByLabel(block, targetLocation);
            var smallCoord = SmallCoord.extract(cell);
            var at = BattlefieldHandler.unitAt(battlefield, UberCoord.from(bigCoord, smallCoord));
            // Only keep these if there's a unit there and the unit is stopped.
            return !!at && (at == unit || Unit.getStopped(at));
        }).forEach(function(status) {
            RepositionOrder.Remove(Unit.findUp(status), status);
        });

        return GameEffect.createResults(effect);
    })
}
WoofRootController.register(RepositionOrder);
Utils.classMixin(RepositionOrder, BaseStatus, 'reposition_order');

