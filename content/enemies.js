class BasicAI {
    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Encounter, NC.Round);

    static PreferredLocations = new ScopedAttr("preferred-locations", ListAttr);
    static OnAfterVolley = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var units = Array.from(BasicAI.findInstances(BattlefieldHandler.find(handler))).map(function(elt) {
            return {
                unit: Unit.findUp(elt),
                status: elt
            };
        });
        units.forEach(function(blorb) {
            var team = TeamAttr.get(blorb.unit);
            var position = Grid.getEffectiveTile(blorb.unit);
            var currentBlock = CellBlock.findByContent(blorb.unit);
            var preferredLocations = BasicAI.PreferredLocations.findGet(blorb.unit) || [];
            if (preferredLocations.length == 0 || preferredLocations.includes(position)) {
                // This rat is about as happy as can be.
                return;
            }
            // Alternative: Enemy wants CC and has CC.
            if (preferredLocations.includes(Grid.CloseCombat)) {
                if (!!Unit.findAllInBlock(currentBlock).findFirst(function(unit) {
                    return !TeamAttr.matches(unit, blorb.unit);
                })) {
                    // This unit wants melee, got melee.
                    return;
                }
            }
            var options = [];
            if (preferredLocations.includes(Grid.CloseCombat)) {
                // Special case: This enemy wants to get way up in your business.
                // Find any blocks that have enemy units in them.
                options.extend(CellBlock.findAll(battlefield).filter(function(block) {
                    // Has some enemy units in them.
                    return Teams.opposed(team).flatMap(oTeam => Unit.findTeamInBlock(block, oTeam)).length > 0;
                }).flatMap(function(block) {
                    // Find open cells.
                    return Cell.findAllInBlock(block);
                }).filter(function(cell) {
                    return !BattlefieldHandler.unitAt(battlefield, UberCoord.extract(cell));
                }).map(function(cell) {
                    return UberCoord.extract(cell);
                }));            
            }
            var current = SmallCoord.extract(blorb.unit);
            options.extend(Grid.fromEffectiveToReal(currentBlock, preferredLocations).map(function(coord) {
                return UberCoord.from(BigCoord.extract(blorb.unit), coord);
            }).filter(function(uber) {
                // Only return free spots.
                return !BattlefieldHandler.unitAt(battlefield, uber);
            }));

            BasicAI._rng.shuffle(options);
            if (options.length == 0) return;

            BasicAI._rng.shuffle(options);
            options = options.sort(function(a, b) {
                return SmallCoord.distance(current, UberCoord.small(a)) - SmallCoord.distance(current, UberCoord.small(b));
            });

            Unit.setTargetLocation(blorb.unit, BattlefieldHandler.cellAt(battlefield, options[0]));
        });
        return GameEffect.createResults(effect);
    });
}
WoofRootController.register(BasicAI);
Utils.classMixin(BasicAI, BaseStatus, 'basic_ai');


class BugCurlUp {}
Utils.classMixin(BugCurlUp, BaseStatus, 'bug_curl_up');

class BugEnemy {
    static CurlUpAfterHit = GameEffect.handle(function(handler, effect, params, result) {
        var target = params.target;
        if (!BugCurlUp.Has(target)) return;
        if (params.main_type != DamageTypes.MELEE) return;
        if (DefendStatus.StackCount(target) > 0) return;

        DefendStatus.AddStacks(target, BugCurlUp.StackCount(target));
    });

    static SpitWeb(units, ability, params, invokedEffects, targets, effect) {
        var amount = units.map(unit => Unit.getCunning(unit)).merge(sumMerge);

        targets.forEach(function(unit) {
            Ability.findAll(unit).forEach(function(target) {
                var toEdit = Ability.CurrentCooldown.find(ability);
                Ability.CurrentCooldown.set(toEdit, Ability.CurrentCooldown.get(toEdit) + Math.max(1, amount));
            });
        });
        return GameEffect.createResults(effect);
    }
}
WoofRootController.register(BugEnemy);

class WebDamageReduction {}
Utils.classMixin(WebDamageReduction, BaseStatus, 'web_damage_reduction');

class WebObstacle {
    static BeforeDamage = GameEffect.handle(function(handler, effect, params) {
        var target = params.target;
        if (!WebDamageReduction.Has(target)) return;
        var reducedTypes = [DamageTypes.THROWN, DamageTypes.RANGED];
        if (!reducedTypes.includes(params.main_type)) return;

        // Reduce to 1 because only strike works well on this thing.
        params.amount = 1;
        GameEffect.setParams(effect, params);
    });

}
WoofRootController.register(WebObstacle);


class GenericMoves {
    static Amount = new ScopedAttr("amount", IntAttr);
    static Status = new ScopedAttr("status", StringAttr);
    static AddStatus(units, ability, params, invokedEffects, targets, effect) {
        var skill = Ability.findSkillFor(ability);
        var amount = GenericMoves.Amount.get(skill);
        var status = GenericMoves.Status.get(skill);    
        units.forEach(function(unit) {
            BaseStatus.AddStacks(status, unit, amount);
        });
        return GameEffect.createResults(effect);
    }
}
WoofRootController.register(GenericMoves);
