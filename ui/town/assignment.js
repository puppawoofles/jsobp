class Assignment {

    static findByName(elt, name) {
        return Utils.bfind(elt, '[wt~=RunScreen]', "[wt~=Assignment]" + Assignment.Name.buildSelector(name));
    }

    static Label = new ScopedAttr("label", StringAttr);
    static ReqLabel = new ScopedAttr("req-label", StringAttr);
    static Name = new ScopedAttr("name", StringAttr);
    static InvokeFn = new ScopedAttr("assignment-invoke-fn", FunctionAttr);
    static EncounterFn = new ScopedAttr("encounter-fn", FunctionAttr);
    static Event = new ScopedAttr("event", StringAttr);
    static PendingCost = new ScopedAttr("pending-cost", IntAttr);
    static FromRumor(rumor) {

        var assignment = Assignment.inflate({
            name: Rumor.Label.findGet(rumor),
        });

        var resultHolder = qs(assignment, ".rewards");
        qsa(rumor, 'result').forEach(function(result) {
            resultHolder.appendChild(result);
        });
        Assignment.Name.copy(assignment, rumor);

        var bpClone = WoofType.findDown(rumor, 'BP');

        var reqTldr = Assignment.ReqLabel.find(assignment);
        var reqTldrBase = Assignment.ReqLabel.find(bpClone);
        Assignment.ReqLabel.copy(reqTldr, reqTldrBase);

        var bpHolder = WoofType.findDown(assignment, 'BP');
        Utils.moveChildren(bpClone, bpHolder);

        return assignment;
    }

    static FromBlueprint(elt, opt_name) {
        if (opt_name) {
            elt = Utils.bfind(elt, 'body', 'assignment-blueprint[name="' + opt_name + '"]')
        }

        var assignment = Assignment.inflate({
            name: Assignment.Label.findGet(elt)
        });
        Assignment.Name.copy(assignment, elt);

        // Cone our blueprint.
        var bpClone = elt.cloneNode(true);

        var reqTldr = Assignment.ReqLabel.find(assignment);
        var reqTldrBase = Assignment.ReqLabel.find(bpClone);
        Assignment.ReqLabel.copy(reqTldr, reqTldrBase);

        var resultHolder = qs(assignment, ".rewards");
        qsa(bpClone, 'result').forEach(function(result) {
            resultHolder.appendChild(result);
        });

        var bpHolder = WoofType.findDown(assignment, 'BP');
        Utils.moveChildren(bpClone, bpHolder);

        return assignment;
    }

    static AddUnit(assignment, card) {
        Assignment.bfindInner(assignment, '.populate_units').appendChild(card);
    }

    static GetAssignedCards(assignment) {
        return Card.findAll(assignment);
    }

    static IsResolved(assignment) {
        return true;
    }

    static AddResults(assignment, results) {
        var resultsHolder = qs(assignment, '.rewards');
        results.forEach(function(result) {
            resultsHolder.appendChild(result);
        });
    }


    static CostFn = new ScopedAttr("cost-fn", FunctionAttr);
    static _calculateCost(self, forUnits) {
        var costFnElt = Assignment.CostFn.find(self);
        if (!costFnElt) {
            // Free!
            return 0;
        }

        return Assignment.CostFn.invoke(costFnElt, self, forUnits);
    }
    
    static Required = new ScopedAttr("required", BoolAttr);
    static MaxUnits = new ScopedAttr("max-units", IntAttr);
    static UnitFilter = new ScopedAttr("unit-filter", FunctionAttr);
    static _isValidArrangement(self, units, inProgress) {

        // If this is a required mission, ensure that we have at least 1 unit.
        if (Assignment.Required.findGet(self) && units.length == 0) {
            return false;
        }

        // Too many units?  No dice.
        var maxUnits = Assignment.MaxUnits.find(self);
        if (maxUnits && Assignment.MaxUnits.get(maxUnits) < units.length) {
            return false;
        }

        // Units that don't fit the filters?  No dice.
        var unitFilters = Assignment.UnitFilter.findAll(self);
        if (unitFilters.findFirst(function(filter) {
            return !Assignment.UnitFilter.invoke(filter, self, units);
        })) {            
            return false;
        }

        // Checks that we use to determine if we're actually good to know.        
        if (!inProgress) {
            // TODO: Min units, etc.

        }

        return true;
    }

    static GetCurrentCost(self) {
        var allUnits = Assignment.GetAssignedCards(self);
        return Assignment._calculateCost(self, allUnits);
    }

    static AbleToEmbark(self) {
        var units = Assignment.GetAssignedCards(self);
        return Assignment._isValidArrangement(self, units, false);
    }

    static CanSupport(self, additionalUnits) {
        var allUnits = Assignment.GetAssignedCards(self).extendNoMove(additionalUnits);
        return Assignment._isValidArrangement(self, allUnits, true);
    }

    static PredictCost(self, additionalUnits) {
        /** Note: This is the predicted cost of just the additional units! */
        var currentCost = Assignment.GetCurrentCost(self);

        var allUnits = Assignment.GetAssignedCards(self).extendNoMove(additionalUnits);
        var cost = Assignment._calculateCost(self, allUnits);

        return cost - currentCost;
    }

}
Utils.classMixin(Assignment, AbstractDomController, {
    matcher: "[wt~=Assignment]",
    template: "town_assignment",
    params: function(config) {
        return {
            NAME: config.name
        }
    },
    decorate: IdAttr.generate
});