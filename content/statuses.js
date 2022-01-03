class RetreatStatus {

    static OnAfterVolley = GameEffect.handle(function(handler, effect, params) {
        var retreats = Array.from(RetreatStatus.findInstances(BattlefieldHandler.find(handler)))
                .filter(function(elt) {
                    var count = RetreatStatus.StackCount(elt);
                    return count <= 0;
                });

        var results = [];
        var retreatFn = function(success, result) {
            if (result) {
                GameEffect.mergeResults(results, result);
            }

            if (retreats.length == 0) {
                // We're done.
                return GameEffect.createResults(effect, {
                }, results);
            }

            var retreat = retreats.shift();
            var unit = Unit.findUp(retreat);
            RetreatStatus.Remove(unit, retreat);

            return GameEffect.push(effect, GameEffect.create("UnitRetreat", {
                unit: WoofType.buildSelectorFor(unit)
            })).then(retreatFn.bind(this, true), retreatFn.bind(this, false));
        }

        return Promise.resolve().then(retreatFn);
    });

    static merge(unit, existing, amount) {
        var count = RetreatStatus.StackCount(unit);
        if (count > 0) {
            RetreatStatus.SubtractStacks(unit, 1, existing);
        }
        return true;
    }
}
WoofRootController.register(RetreatStatus);
Utils.classMixin(RetreatStatus, BaseStatus, 'retreating');



class AgilityStatus {

    static OnAfterVolley = GameEffect.handle(function(handler, effect, params) {
        var agilitiesToRemove = Array.from(AgilityStatus.findInstances(BattlefieldHandler.find(handler)))
                .map(function(elt) {
                    return {
                        unit: Unit.findUp(elt),
                        status: elt
                    };
                })
                .filter(function(blorb) {
                    return Unit.getStopped(blorb.unit);
                });
        agilitiesToRemove.forEach(function(blorb) {
            AgilityStatus.Remove(blorb.unit, blorb.status);
        });

        return GameEffect.createResults(effect);
    });

    static merge(unit, existing, amount) {
        AgilityStatus.AddStacks(unit, Math.max(1, amount), existing);
        return true;
    }
}
WoofRootController.register(AgilityStatus);
Utils.classMixin(AgilityStatus, BaseStatus, 'agility');


class DefendStatus {

    static OnBeforeRound = GameEffect.handle(function(handler, effect, params) {
        var defends = Array.from(DefendStatus.findInstances(BattlefieldHandler.find(handler)))
                .map(function(elt) {
                    return {
                        unit: Unit.findUp(elt),
                        status: elt
                    };
                });

        defends.forEach(function(blorb) {
            var stacks = DefendStatus.StackCount(blorb.unit);
            if (stacks > 0) {
                DefendStatus.SubtractStacks(blorb.unit, stacks, blorb.status);
            }
        });

        return GameEffect.createResults(effect);
    });

    static merge(unit, existing, amount) {
        if (amount == 0) {
            return true;
        }
        var current = DefendStatus.StackCount(existing);
        var parity = Math.sign(amount);
        // If we're adding defend to defend or vuln to vuln.
        if (parity == Math.sign(current)) {
            current *= parity;
            amount *= parity;
            if (current < amount) {
                DefendStatus.AddStacks(unit, (amount - current) * parity, existing);
            }
        } else {
            // Else we're adding vuln to defend or vice versa; just add them up.
            DefendStatus.AddStacks(unit, amount, existing);
        }

        return true;
    }

    static stack(status, unit, oldAmount) {
        var newAmount = DefendStatus.StackCount(unit);
        Unit.setDefend(unit, newAmount);
    }
}
WoofRootController.register(DefendStatus);
Utils.classMixin(DefendStatus, BaseStatus, 'defend');


class BleedStatus {

    static OnAfterUseAbility = GameEffect.handle(function(handler, effect, params, result) {
        for (var i = 0; i < params.components.length; i++) {
            var unit = Utils.bfind(handler, 'body', params.components[i].unit);
            var results = [];
            var stacks = BleedStatus.StackCount(unit);
            if (stacks) {
                return GameEffect.push(effect, GameEffect.create("TakeDamage", {
                    target: params.unit,
                    amount: stacks,
                    source: BleedStatus.Get(unit)

                })).then(function(result) {
                    if (BleedStatus.StackCount(unit) == 1) {
                        BleedStatus.Remove(unit);
                    } else {
                        BleedStatus.SubtractStacks(unit, Math.floor(stacks / 2));
                    }                
                    GameEffect.mergeResults(results, result);
                    return GameEffect.createResults(effect, {}, results)
                });
            }
        }

        return GameEffect.createResults(effect);
    });

    static merge(unit, existing, amount) {
        BleedStatus.AddStacks(unit, amount, existing);
        return true;
    }
}
WoofRootController.register(BleedStatus);
Utils.classMixin(BleedStatus, BaseStatus, 'bleed');



class DistractedStatus {
    static TickDownMaybe = GameEffect.handle(function(handler, effect, params, result) {
        var units = params.components.map(function(a) {
            return Utils.bfind(effect, 'body', a.unit);
        });
        units.forEach(function(u) {
            var stack = DistractedStatus.findInstances(u)[0];
            if (!stack) return;
            var stacks = DistractedStatus.StackCount(u);
            if (stacks > 1) {
                DistractedStatus.SubtractStacks(u, 1, stack);
            } else {
                DistractedStatus.Remove(u, stack);
            }
        });
    });

    static merge(unit, existing, amount) {
        DistractedStatus.AddStacks(unit, amount, existing);
        return true;
    }

    static onRemove(unit, status) {
        var id = IdAttr.generate(status);
        Unit.PreventCombo.remove(unit, id);
    }

    static onApply(unit, status) {
        var id = IdAttr.generate(status);
        Unit.PreventCombo.add(unit, id);
    }
}
WoofRootController.register(DistractedStatus);
Utils.classMixin(DistractedStatus, BaseStatus, 'distracted');
