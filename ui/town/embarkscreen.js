
class EmbarkDialog {
    static Accept(event, handler) {
        DialogScreen.Resolve(handler, null);
    }
    
    static Cancel(event, handler) {
        DialogScreen.Reject(handler, null);
    }

    static Reset(event, handler) {
        var holder = qs(handler, '.units_holder');
        Card.findAll(handler).forEach(function(card) {
            holder.appendChild(card);
            Card.setSelected(card, false);
        });

        // Refresh.
        EmbarkDialog._refresh(handler);
    }

    static Disabled = new ScopedAttr("disabled", BoolAttr);
    static Selected = new ScopedAttr("selected", BoolAttr);
    static Cost = new ScopedAttr("cost", IntAttr);
    static _refresh(self) {
        var embarkDisabled = false;

        // No unassigned units.
        if (EmbarkDialog.bfindInner(self, '.units_holder').childElementCount > 0) {
            embarkDisabled = true;
        }

        var currentSelection = Card.findSelectedIn(self);

        // Verify that all of our assignments are happy.
        var pendingCost = 0;
        var assignments = Assignment.findAll(self);
        assignments.forEach(function(assignment) {
            // Disable embark if any of our assignments say no.
            embarkDisabled |= !Assignment.AbleToEmbark(assignment);
            pendingCost += Assignment.GetCurrentCost(assignment);

            if (currentSelection.length == 0) {
                EmbarkDialog.Selected.set(assignment, false);
            } else {
                EmbarkDialog.Selected.set(assignment, Assignment.CanSupport(assignment, currentSelection));
            }

            // If this assignment can straight-up handle these units (per requirements).
        });

        // Now that we have our total pending cost, we need to do a second pass to ensure that
        // we only enable assignments we can afford.
        var maxCost = RunInfo.getCurrentGold(self) - pendingCost;
        assignments.filter(function(assignment) {
            // We only care about those we've already selected.
            return EmbarkDialog.Selected.get(assignment);
        }).forEach(function(assignment) {
            var predicted = Assignment.PredictCost(assignment, currentSelection);
            if (predicted > maxCost) {
                EmbarkDialog.Selected.set(assignment, false);
            }
        });
        
        var embarkButton = EmbarkDialog.bfindInner(self, WoofType.buildSelector("Okay"));
        EmbarkDialog.Disabled.set(embarkButton, embarkDisabled || undefined);

        var pendingCostElt = EmbarkDialog.bfindInner(self, '.pending_cost');
        EmbarkDialog.Cost.set(pendingCostElt, pendingCost);
    }

    static ClickCard(event, handler) {
        var selected = Card.findUp(event.target);
        var existing = Card.findSelectedIn(handler);
        var inAssignment = Assignment.findUp(selected);
        // Clicked the same boy.  Unselect and return.
        if (Card.isSelected(selected)) {
            // Just unselecting.
            Card.setSelected(selected, false);
        } else if (inAssignment) {
            // We clicked a card in an encounter.  This means we want to move it
            // back to our main holder.
            qs(handler, '.units_holder').appendChild(selected);
        } else {
            // We clicked a card not in an assignment, so we're just selecting it.
            Card.setSelected(selected, true);
        }

        EmbarkDialog._refresh(handler);
    }

    static ClickAddUnit(event, handler) {
        var selected = Card.findSelectedIn(handler);
        if (!selected || selected.length == 0) return;

        selected.forEach(function(unit) {
            Assignment.AddUnit(event.target, unit);
            Card.setSelected(unit, false);    
        });

        EmbarkDialog._refresh(handler);
    }

    static DefaultForUnits = new ScopedAttr("default-for-units", BoolAttr);
    static setup(self, params) {
        var assignmentsHolder = qs(self, '.assignment_holder');
        Utils.moveChildren(params.assignmentHolder, assignmentsHolder);        

        var defaultUnitHolder = EmbarkDialog.DefaultForUnits.find(assignmentsHolder, true);
        if (defaultUnitHolder) {
            a(params.unitsHolder.children).forEach(function(unit) {
                Assignment.AddUnit(defaultUnitHolder, unit);
            });
        } else {
            var unitsHolder = qs(self, '.units_holder');
            Utils.moveChildren(params.unitsHolder, unitsHolder);    
        }
        EmbarkDialog._refresh(self);
    }

    static teardown(self, params) {        
        var unitsHolder = qs(self, '.units_holder');
        a(unitsHolder.children).forEach(function(card) {
            // Unselect all units.
            Card.setSelected(card, false);
        });
        Utils.moveChildren(unitsHolder, params.unitsHolder);

        var assignmentsHolder = qs(self, '.assignment_holder');
        Utils.moveChildren(assignmentsHolder, params.assignmentHolder);
    }

}
Utils.classMixin(EmbarkDialog, AbstractDomController, {
    matcher: ".embark_dialog",
    template: "embark_dialog",
    params: function(params) {
        return {};
    }
});
WoofRootController.register(EmbarkDialog);