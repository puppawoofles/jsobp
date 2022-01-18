class TownScreen {

    static Name = new ScopedAttr("name", StringAttr);
    static Cost = new ScopedAttr("cost", IntAttr);
    static CostFn = new ScopedAttr("cost-fn", FunctionAttr);
    static MinUnits = new ScopedAttr("min-units", IntAttr);
    static MaxUnits = new ScopedAttr("max-units", IntAttr);
    static MaxUnitsFn = new ScopedAttr("max-units-fn", FunctionAttr);
    static UnitFilter = new ScopedAttr("unit-filter", FunctionAttr);
    static UnitSort = new ScopedAttr("unit-sort", FunctionAttr);

    static ViewStorage(event, handler) 
    {
        var wrapper = WoofType.findUp(handler, "ScreenWrapper");
        DialogScreen.Show(wrapper, ManageItemsDialog, {
            unitsHolder: RunInfo.getUnitHolder(handler),
            itemsHolder: RunInfo.getStorageHolder(handler)
        });
    }

    static GoShopping(event, handler) {
        var wrapper = WoofType.findUp(handler, "ScreenWrapper");
        var merchant = WoofType.findUp(event.target, "Visitor");
        DialogScreen.Show(wrapper, ShopDialog, {
            merchant: merchant,
            itemsHolder: RunInfo.getStorageHolder(handler)
        });
    }

    static clearRumors(townScreen) {
        var holder = qs(townScreen, ".rumor_holder");
        Utils.clearChildren(holder);
    }

    static addAssignment(townScreen, assignment) {
        var holder = qs(townScreen, ".assignment_holder");
        holder.appendChild(assignment);
    }

    static clearAssignments(townScreen) {
        var holder = qs(townScreen, ".assignment_holder");
        Utils.clearChildren(holder);
    }

    static addVisitor(townScreen, visitor) {
        var holder = qs(townScreen, ".visitor_holder");
        holder.appendChild(visitor);
    }

    static getVisitors(townScreen) {
        return a(qs(townScreen, ".visitor_holder").children);
    }

    static Disabled = new ScopedAttr("disabled", BoolAttr);
    static RefreshEmbark(event, handler) {
        TownScreen.RefreshButtons(handler);
    }

    static RefreshButtons(townScreen) {
        var goButton = qs(townScreen, "[wt~=Go]");
        TownScreen.Disabled.set(goButton);
    }

    static Selected = new ScopedAttr("selected", BoolAttr);
    static OnEmbark(event, handler) {

        var wrapper = WoofType.findUp(handler, "ScreenWrapper");
        DialogScreen.Show(wrapper, EmbarkDialog, {
            unitsHolder: RunInfo.getUnitHolder(handler),
            assignmentHolder: qs(handler, '.assignment_holder')
        }).then(function() {
            var assignments = Assignment.findAll(handler);
            assignments.forEach(function(assignment) {
                // Unselect our boyos.
                TownScreen.Selected.set(assignment, false);
            });
            GameRules.Embark(handler, assignments);
        }, function() {
            // On rejection, reset everything.
            var assignments = Assignment.findAll(handler);
            assignments.forEach(function(assignment) {
                // Unselect our boyos.
                Assignment.GetAssignedCards(assignment).forEach(function(card) {
                    RunInfo.addUnit(handler, card);
                });
            });
        });
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