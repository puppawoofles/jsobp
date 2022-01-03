class PriorityAttr {}
Utils.classMixin(PriorityAttr, IntAttr, "priority");

class CostFnAttr {}
Utils.classMixin(CostFnAttr, FunctionAttr, "cost-fn");

class CostAttr {}
Utils.classMixin(CostAttr, StringAttr, "cost");

class ParamFnAttr {}
Utils.classMixin(ParamFnAttr, FunctionAttr, "param-fn");

class EffectFnAttr {}
Utils.classMixin(EffectFnAttr, FunctionAttr, "effect-fn");

class ActiveIn {

    static Standard(bp, ability) {        
        var activeIn = Ability.getActiveIn(ability);
        var active = false;
        if (activeIn.includes(Grid.CloseCombat)) {
            active = active || ActiveIn._testCC(bp, ability);
        }
        active = active || ActiveIn._testPosition(ability, activeIn);

        return !!active;
    }

    static _inOpponentBlock(unit) {
        var block = CellBlock.findByContent(unit);
        return !TeamAttr.matches(block, unit);
    }

    static _testCC(bp, ability) {
        var unit = Unit.findUp(ability);
        var battlefield = BattlefieldHandler.findUp(unit);
        if (!battlefield) return false;

        // First check: Am I in an opponent's block?
        if (ActiveIn._inOpponentBlock(unit)) return true;

        // Second check: Are opponents in my block?
        var targets = Targeting.GetCCPriorityTargets(unit, TeamAttr.get(unit));
        return targets.length > 0;
    }

    static _testPosition(ability, activeIn) {
        var unit = Unit.findUp(ability);
        var battlefield = BattlefieldHandler.findUp(unit);
        if (!battlefield) return false;

        // First check: Am I in an opponent's block?
        if (ActiveIn._inOpponentBlock(unit)) return false;

        return activeIn.includes(Grid.getEffectiveTile(unit));
    }
}
WoofRootController.register(ActiveIn);

class Targeting {
    
    static _buildMicroGrid(cell) {        
        var currentBlock = CellBlock.findByContent(cell);
        var facing = Grid.getFacing(cell);
        var targetBlock = Grid.getBlockIn(currentBlock, facing);
        if (!targetBlock) {
            return null;
        }

        // Our goal is to build a microgrid that has:
        //    0   1   2
        // 5 B3  B2  B1  Target block
        // 4 M3  M2  M1  Target block
        // 3 F3  F2  F1  Target block
        // 2 F1  F2  F3  Self block
        // 1 M1  M2  M3  Self block
        // 0 B1  B2  B3  Self block
        // The values will be an Ubercoord.
        // This will allow me to use simpler algorithms.
        var currentBigCoord = BigCoord.extract(currentBlock);
        var targetBigCoord = BigCoord.extract(targetBlock);
        var targetFacing = FacingAttr.opposite(facing);

        var grid = [
            [
                UberCoord.from(currentBigCoord, Grid.getSmallCoordFor("B1", facing)),
                UberCoord.from(currentBigCoord, Grid.getSmallCoordFor("M1", facing)),
                UberCoord.from(currentBigCoord, Grid.getSmallCoordFor("F1", facing)),
                UberCoord.from(targetBigCoord, Grid.getSmallCoordFor("F3", targetFacing)),
                UberCoord.from(targetBigCoord, Grid.getSmallCoordFor("M3", targetFacing)),
                UberCoord.from(targetBigCoord, Grid.getSmallCoordFor("B3", targetFacing))
            ],
            [
                UberCoord.from(currentBigCoord, Grid.getSmallCoordFor("B2", facing)),
                UberCoord.from(currentBigCoord, Grid.getSmallCoordFor("M2", facing)),
                UberCoord.from(currentBigCoord, Grid.getSmallCoordFor("F2", facing)),
                UberCoord.from(targetBigCoord, Grid.getSmallCoordFor("F2", targetFacing)),
                UberCoord.from(targetBigCoord, Grid.getSmallCoordFor("M2", targetFacing)),
                UberCoord.from(targetBigCoord, Grid.getSmallCoordFor("B2", targetFacing))
            ],
            [
                UberCoord.from(currentBigCoord, Grid.getSmallCoordFor("B3", facing)),
                UberCoord.from(currentBigCoord, Grid.getSmallCoordFor("M3", facing)),
                UberCoord.from(currentBigCoord, Grid.getSmallCoordFor("F3", facing)),
                UberCoord.from(targetBigCoord, Grid.getSmallCoordFor("F1", targetFacing)),
                UberCoord.from(targetBigCoord, Grid.getSmallCoordFor("M1", targetFacing)),
                UberCoord.from(targetBigCoord, Grid.getSmallCoordFor("B1", targetFacing))
            ]
        ];

        var rGrid = {};
        for (var x = 0; x < grid.length; x++) {
            for (var y = 0; y < grid[x].length; y++) {
                rGrid[UberCoord.toString(grid[x][y])] = [x, y];
            }
        }

        return {  
            gridFn: function(x, y) {
                return grid[x][y];
            },
            reverseFn: function(uberCoord) {
                return rGrid[UberCoord.toString(uberCoord)]
            },
            myBlock: currentBlock,
            myFacing: facing,
            targetBlock: targetBlock,
            targetFacing: FacingAttr.opposite(facing)
        };  
    }

    // Builds a walk from the microgrid.  Directions on this are really simple:
    // Microgrids are 3x6, but since the unit can be anywhere on the X axis,
    // this diagram is 5x4 (project the top line further up)

    // V V V V V
    // V V V V V
    // X O O O X   <= Can hit anything in the front arc.
    // > X S X <
    static BuildTargetWalk(mg, startingCell, targetUnit, targetFn, blockFn) {
        var startCoord = UberCoord.extract(startingCell);
        var endCoord = UberCoord.extract(targetUnit);
        var ms = mg.reverseFn(startCoord);
        var me = mg.reverseFn(endCoord);

        var delta = SmallCoord.minus(me, ms);
        var mainDelta;
        var otherDelta;
        if (Math.abs(delta[0]) > Math.abs(delta[1])) {
            mainDelta = [Math.sign(delta[0]), 0];
            otherDelta = [0, Math.sign(delta[1])];
        } else {
            otherDelta = [Math.sign(delta[0]), 0];
            mainDelta = [0, Math.sign(delta[1])];
        }

        var walk = [ms];
        // Every iteration, we want to step forward, and sideways if we need to.

        for (var i = 0; i < SmallCoord.diagDistance(ms, me); i++) {
            var current = walk.peek();
            var next = SmallCoord.plus(current, mainDelta);
            walk.push(next);
            next = SmallCoord.plus(next, otherDelta);
            // If going diagonal gets us closer, let's do it.
            if (SmallCoord.distance(walk.peek(), me) > SmallCoord.distance(next, me)) {
                walk.push(next);
            }
        }

        // Check if we're blocked.
        var blocked = false;
        walk.map(function(coord) {
            coord = mg.gridFn(coord[0], coord[1]);
            var cell = BattlefieldHandler.cellAt(startingCell, coord);
            var unit = BattlefieldHandler.unitAt(startingCell, coord);
            blocked = blocked || blockFn(cell, unit || null);
            return coord;
        });
        if (blocked) return [];

        // Next up, filter it down to just the enemies we want to target.
        return walk.map(function(coord) {
            coord = mg.gridFn(coord[0], coord[1]);
            return BattlefieldHandler.unitAt(startingCell, coord);
        }).filter(function(unit) {
            return !!unit;
        }).filter(targetFn);
    }

    static ExtractTeam(cellOrUnit) {
        var block = CellBlock.findByContent(cellOrUnit);
        var team = TeamAttr.get(block);

        if (isElement(cellOrUnit)) {
            if (WoofType.has(cellOrUnit, "Unit")) {
                team = TeamAttr.get(cellOrUnit);
            }
        }
        return team;
    }
    
    static FindInTargetBlock(block, unitFilter, sortFn) {
        var unitsInBlock = Unit.findAllInBlock(block);
        return unitsInBlock.filter(unitFilter).sort(sortFn);
    }

    static _smallCoordCloseSort(relativeTo) {
        var rC = SmallCoord.extract(relativeTo);
        return function(a, b) {
            var aC = SmallCoord.extract(a);
            var bC = SmallCoord.extract(b);

            return (SmallCoord.distance(rC, aC) - SmallCoord.distance(rC, bC)) ||
                    (SmallCoord.diagDistance(rC, bC) - SmallCoord.diagDistance(rC, bC)) ||
                    (aC[1] - bC[1]) || (aC[0] - bC[1]);
        };
    }

    static _microgridCloseSort(mgr, relativeTo) {
        var mu = UberCoord.extract(relativeTo);
        var mmec = mgr.reverseFn(mu);

        return function(a, b) {
            var auc = UberCoord.extract(a);
            var buc = UberCoord.extract(b);
            var mac = mgr.reverseFn(auc);
            var mbc = mgr.reverseFn(buc);
            // Horizontal distance: We want the current lane to win if possible.
            var hac = Math.abs(mmec[0] - mac[0]);
            var hbc = Math.abs(mmec[0] - mbc[0]);

            // Adjusted distance, favoring closer lanes.
            return (SmallCoord.distance(mmec, mac) + hac) - (SmallCoord.distance(mmec, mbc) + hbc) ||
                    (SmallCoord.diagDistance(mmec, mac) + hac) - (SmallCoord.diagDistance(mmec, mbc) + hbc) ||
                    (hac - hbc) ||
                    (mac[0] - mbc[0]) ||
                    (mac[1] - mbc[1]);
        };
    }

    static GetCCPriorityTargets(cellOrUnit, optTeam) {

        var team = optTeam || Targeting.ExtractTeam(cellOrUnit);
        var opposed = Teams.opposed(team);
        var myBlock = CellBlock.findByContent(cellOrUnit);

        var priorityTargets = []; 
        var closeSortFn = Targeting._smallCoordCloseSort(cellOrUnit);       

        // Melee-specific: First, things not on our team that are taunted in our block.
        // Enemies and taunted enemy constructs, basically.
        priorityTargets.extend(Targeting.FindInTargetBlock(myBlock, function(unit) {
            return TeamAttr.get(unit) != team && Unit.hasTaunt(unit, team);
        }, closeSortFn));

        // Melee-specific: Second, things on the enemy team in our block.
        priorityTargets.extend(Targeting.FindInTargetBlock(myBlock, function(unit) {
            return opposed.includes(TeamAttr.get(unit));
        }, closeSortFn));

        return priorityTargets;
    }

    static GetRemotePriorityTargets(cellOrUnit, optTeam, optMgr) {
        var mgr = optMgr || Targeting.BuildMicroGrid(cellOrUnit);
        var team = optTeam || Targeting.ExtractTeam(cellOrUnit);
        var opposed = Teams.opposed(team);
        var targetBlock = mgr.targetBlock;
        
        var priorityTargets = []; 
        var closeSortWithLaneFn = Targeting._microgridCloseSort(mgr, cellOrUnit);  

        // Taunted targets in the enemy block.
        priorityTargets.extend(Targeting.FindInTargetBlock(targetBlock, function(unit) {
            return TeamAttr.get(unit) != team && Unit.hasTaunt(unit, team);
        }, closeSortWithLaneFn));

        // Enemy targets
        priorityTargets.extend(Targeting.FindInTargetBlock(targetBlock, function(unit) {
            return opposed.includes(TeamAttr.get(unit));
        }, closeSortWithLaneFn));

        return priorityTargets;
    }

    static EnemyPriorityTargets(origin, team, mg, includeCC) {

        var priorityTargets = [];
        if (includeCC) {
            priorityTargets.extend(Targeting.GetCCPriorityTargets(origin, team));
        }
        priorityTargets.extend(Targeting.GetRemotePriorityTargets(origin, team, mg));
        var unitsInList = {};

        return priorityTargets.filter(function(unit) {
            var id = IdAttr.generate(unit);
            if (unitsInList[id]) {
                return false;
            }
            unitsInList[id] = true;
            return true;
        });
    }

    static ChooseTargetByWalk(targets, cell, team, mgr, backupTargetFn) {
        var backupTarget = null;
        var opposed = Teams.opposed(team);

        while (targets.length > 0) {
            var target = targets.shift();

            var targetWalk = Targeting.BuildTargetWalk(mgr, cell, target, function(unit) {
                var theirTeam = TeamAttr.get(unit);
                return theirTeam != team;
            }, function(cell, unit) {
                // Shit blocks now.
                if (!unit) return false; // Nothing blocking here.
                // Nothing blocks yet.
                return false;
            });

            if (targetWalk == null || targetWalk.length == 0) {
                // Skip this one because there's no target.
                continue;
            }
            var isBackup = false;
            targetWalk = targetWalk.filter(function(unit) {
                return TeamAttr.get(unit) != team;
            });
            if (targetWalk.length == 0) {
                // Can his ever happen?
                continue;
            }
            targetWalk.forEach(function(unit) {
                isBackup = isBackup || backupTargetFn(unit);
            });

            if (!isBackup) {
                return targetWalk;
            }
            if (!backupTarget) {
                backupTarget = targetWalk;
            }
        }

        return backupTarget || [];
    }

    static StandardEnemy(origin, team, config) {
        var mgr = Targeting._buildMicroGrid(origin);
        var priorityTargets = Targeting.EnemyPriorityTargets(origin, team, mgr, config.CC);
        var opposed = Teams.opposed(team);

        switch (config.travelMode) {
            case "walk":
            case "line":
                return Targeting.ChooseTargetByWalk(priorityTargets, origin, team, mgr, function(unit) {
                    if (config.overhead) return false;
                    return !opposed.includes(TeamAttr.get(unit)) && !Unit.hasTaunt(unit, team);
                });
        }

        return [];
    }

    static StandardSelf(origin, team, config) {
        return [BattlefieldHandler.unitAt(origin, UberCoord.extract(origin))];
    }
}
WoofRootController.register(Targeting);



class SkillParams {

    static Function = new ScopedAttr('fn', FunctionAttr);
    static Type = new ScopedAttr('type', StringAttr);
    static ExtraParams = new ScopedAttr('extra-param-types', ListAttr);
    static Standard(units, ability, bp, mana, modifiers) {
        var params = {};
        SkillParams._baseParams(params, units, ability, mana, modifiers);

        var config = [SkillParams.Type.get(bp)];
        config.extend(SkillParams.ExtraParams.get(bp) || []);

        config.forEach(function(value) {
            var paramElt = Utils.bfind(units[0], 'body', 'skill-param-fn[type="' + value + '"]')
            SkillParams.Function.invoke(paramElt, params, units, ability, mana, modifiers);
        });

        return params;
    }

    // For damage dealing.
    
    static _totalBaseDamage(units) {
        var total = 0;
        units.forEach(function(unit) {
            total += Unit.baseDamage(unit);
        });
        return total;
    }

    static _totalBaseDefense(units) {
        var total = 0;
        units.forEach(function(unit) {
            total += Unit.baseDefense(unit);
        });
        return total;
    }

    static _damageParams(params, units, ability, mana, modifiers) {
        params.baseDamage = SkillParams._totalBaseDamage(units);
    }
    
    static _defenseParams(params, units, ability, mana, modifiers) {
        params.baseDefense = SkillParams._totalBaseDefense(units);
    }    

    // For all skills.
    static _baseParams(params, units, ability, mana, modifiers) {
        params.mana = Mana.normalize(mana);
    }

    // For 🗡️ skill.
    static MeleeParams(params, units, ability, mana, modifiers) {
        SkillParams._damageParams(params, units, ability, mana, modifiers);
    }

    // For ⚾ skill.
    static ThrownParams(params, units, ability, mana, modifiers) {
        SkillParams._damageParams(params, units, ability, mana, modifiers);
    }

    // For 🏹 skill.
    static ShootParams(params, units, ability, mana, modifiers) {
        SkillParams._damageParams(params, units, ability, mana, modifiers);
    }

    // For ☄️ skill.
    static MAttackParams(params, units, ability, mana, modifiers) {
        SkillParams._damageParams(params, units, ability, mana, modifiers);
    }
    
    // For 🛡️ skill.
    static DefendParams(params, units, ability, mana, modifiers) {
        SkillParams._defenseParams(params, units, ability, mana, modifiers);
    }
    
    // For 🔨 skill.
    static ConstructParams(params, units, ability, mana, modifiers) {
    }
    
    // For 🔮 skill.
    static SummonParams(params, units, ability, mana, modifiers) {
    }
    
    // For 🤲 skill.
    static PushParams(params, units, ability, mana, modifiers) {
        params.pushForce = SkillParams._totalBaseDamage(units);
    }
    
    // For 🥾 skill.
    static MoveParams(params, units, ability, mana, modifiers) {
        params.distance = 1;
    }
    
    // For ✨ skill.
    static BuffParams(params, units, ability, mana, modifiers) {
        params.buffSize = units.length;
    }
    
    // For 💫 skill.
    static DebuffParams(params, units, ability, mana, modifiers) {
        params.debuffSize = units.length;
    }
    
    // For 🏳️ skill.
    static RetreatParams(params, units, ability, mana, modifiers) {
        params.retreat = 1;
    }
}
WoofRootController.register(SkillParams);