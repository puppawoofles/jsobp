class TownScreen {

    static Name = new ScopedAttr("name", StringAttr);
    static Cost = new ScopedAttr("cost", IntAttr);
    static CostFn = new ScopedAttr("cost-fn", FunctionAttr);
    static MinUnits = new ScopedAttr("min-units", IntAttr);
    static MaxUnits = new ScopedAttr("max-units", IntAttr);
    static MaxUnitsFn = new ScopedAttr("max-units-fn", FunctionAttr);
    static UnitFilter = new ScopedAttr("unit-filter", FunctionAttr);
    static UnitSort = new ScopedAttr("unit-sort", FunctionAttr);

    static BuyRumor(event, handler) {
        var rumor = WoofType.findUp(event.target, "Rumor");
        if (!TownScreen.IsRumorPossible(handler, rumor)) {
            Logger.info("This rumor is impossible for some reason or another.");
            return;
        }
        var assignInfo = qs(rumor, 'assign');

        var minUnits = TownScreen.MinUnits.findGet(assignInfo);
        var maxUnits = TownScreen.MaxUnits.has(assignInfo) ?
                TownScreen.MaxUnits.get(assignInfo) :
                TownScreen.MaxUnitsFn.invoke(assignInfo, rumor, assignInfo);

        var cost = TownScreen.Cost.has(assignInfo) ? TownScreen.Cost.get(assignInfo) : null;
        
        var unitFilter = TownScreen.UnitFilter.has(assignInfo) ? TownScreen.UnitFilter.invoke(assignInfo, rumor, assignInfo) : function() { return true; };
        var unitSort = TownScreen.UnitSort.has(assignInfo) ? TownScreen.UnitSort.invoke(assignInfo, rumor, assignInfo) : function() { return 0; };

        var assignmentContainer = qs(TownScreen.findUp(handler), ".assignment_holder");
        var availableUnits = Assignment.GetAssignedCards(Assignment.findByTag(assignmentContainer, 'idle')).filter(unitFilter).sort(unitSort);        

        var wrapper = WoofType.findUp(handler, "ScreenWrapper");

        DialogScreen.Show(wrapper, UnitSelect, {
            minUnits: minUnits,
            maxUnits: maxUnits,
            extraClasses: "encounter_config",
            deck: availableUnits
        }).then(function(units) {
            // Spend dat gold.
            if (cost === null) {
                cost = TownScreen.CostFn.invoke(assignInfo, rumor, assignInfo, units);
            }
            RunInfo.spendGold(handler, cost);

            var cards = units.map(function(card) {
                return Utils.bfind(handler, 'body', card);                
            });

            var assignment = Assignment.FromRumor(rumor);
            assignmentContainer.appendChild(assignment);
            rumor.remove();

            Assignment.AssignCards(assignment, cards);
        }, function() {});
    }

    static addRumor(townScreen, rumor) {
        var holder = qs(townScreen, ".rumor_holder");
        holder.appendChild(rumor);
    }
    
    static clearRumors(townScreen) {
        var holder = qs(townScreen, ".rumor_holder");
        Utils.clearChildren(holder);
    }

    static getRumors(townScreen) {
        return qsa(townScreen, "[wt~=Rumor]");
    }
    
    static addAssignment(townScreen, assignment) {
        var holder = qs(townScreen, ".assignment_holder");
        holder.appendChild(assignment);
    }

    static clearAssignments(townScreen) {
        var holder = qs(townScreen, ".assignment_holder");
        Utils.clearChildren(holder);
    }

    static Disabled = new ScopedAttr("disabled", BoolAttr);
    static RefreshEmbark(event, handler) {
        TownScreen.RefreshButtons(handler);
    }

    static RefreshButtons(townScreen) {
        var goButton = qs(townScreen, "[wt~=Go]");
        var assignmentHolder = qs(townScreen, ".assignment_holder");
        TownScreen.Disabled.set(goButton, assignmentHolder.children.length == 0, true);

        // Also!  We need up evaluate whether our rumors are doable!
        WoofType.findAll(townScreen, 'Rumor').forEach(function(rumor) {
            var buyButton = Rumor.FindButton(rumor);
            TownScreen.Disabled.set(buyButton, !TownScreen.IsRumorPossible(townScreen, rumor), true);
            TownScreen.UpdateRumor(townScreen, rumor);
        });
    }

    static CostPerUnit = new ScopedAttr('cost-per-unit', IntAttr)
    static UpdateRumor(townScreen, rumor) {
        var assignInfo = qs(rumor, 'assign');

        // First: If we have an explicit cost, this is easy.
        if (TownScreen.Cost.has(assignInfo)) {
            Rumor.RefreshCost(rumor, {
                minCost: TownScreen.Cost.get(assignInfo)
            });
            return;
        }

        // Hack: We use Cost-per-unit here for UI reasons.
        // Maybe I should have a stupid renderer thing in the DOM for this.
        if (TownScreen.CostPerUnit.has(assignInfo)) {
            var rate = TownScreen.CostPerUnit.get(assignInfo);
            Rumor.RefreshCost(rumor, {
                minCost: rate,
                unit: '🙂'
            });

            return;
        } 
    }

    static IsRumorPossible(townScreen, rumor) {
        var assignInfo = qs(rumor, 'assign');

        var minUnits = TownScreen.MinUnits.findGet(assignInfo);
        var maxUnits = TownScreen.MaxUnits.has(assignInfo) ?
                TownScreen.MaxUnits.get(assignInfo) :
                TownScreen.MaxUnitsFn.invoke(assignInfo, rumor, assignInfo);

        var cost = TownScreen.Cost.has(assignInfo) ? TownScreen.Cost.get(assignInfo) : null;
        
        if (maxUnits < minUnits || (cost !== null && cost > RunInfo.getCurrentGold(townScreen))) {
            return false;
        }

        var unitFilter = TownScreen.UnitFilter.has(assignInfo) ? TownScreen.UnitFilter.invoke(assignInfo, rumor, assignInfo) : function() { return true; };

        var assignmentContainer = qs(TownScreen.findUp(townScreen), ".assignment_holder");
        var availableUnits = Assignment.GetAssignedCards(Assignment.findByTag(assignmentContainer, 'idle')).filter(unitFilter);

        if (availableUnits.length == 0) {
            return false;
        }
        if (availableUnits.length < minUnits) {
            return false;
        }
        return true;
    }

    static OnEmbark(event, handler) {
        var assignments = WoofType.findAll(handler, "Assignment");
        var encounters = assignments.map(function(encounter) {
            return {
                encounterFn: GameRules.EncounterFn.findGet(encounter),
                assignment: WoofType.buildSelectorFor(encounter)
            };
        });
        GameRules.Embark(handler, encounters);
    }
}
WoofRootController.register(TownScreen);
Utils.classMixin(TownScreen, AbstractDomController, {
    template: 'town_screen',
    matcher: '[wt~="TownScreen"]',
    params: function() {
        return {};
    }
});