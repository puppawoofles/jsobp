class Rumor {

    static Name = new ScopedAttr("name", StringAttr);
    static Label = new ScopedAttr("label", StringAttr);
    static Cost = new ScopedAttr("cost", IntAttr);
    static InvokeFn = new ScopedAttr("assignment-invoke-fn", FunctionAttr);
    static EncounterFn = new ScopedAttr("encounter-fn", FunctionAttr);
    static Event = new ScopedAttr("event", StringAttr);
    static FromAssignmentBlueprint(elt, opt_name) {
        if (opt_name) {
            elt = Utils.bfind(elt, 'body', 'assignment-blueprint[name="' + opt_name + '"]');
        }

        var rumor = Rumor.inflate({
            name: Rumor.Label.findGet(elt),
            cost: Rumor.Cost.findGet(elt) || 0
        });

        // Move the results up.
        var bpClone = elt.cloneNode(true);
        var resultHolder = qs(rumor, '.results');
        qsa(bpClone, 'result').forEach(function(result) {
            resultHolder.appendChild(result);
        });

        var bpHolder = WoofType.findDown(rumor, 'BP');
        Utils.moveChildren(bpClone, bpHolder);

        return rumor;
    }

    static FindButton(elt) {
        return qs(elt, 'button');
    }

    static MinCost = new ScopedAttr('min-cost', IntAttr);
    static Unit = new ScopedAttr('unit', StringAttr);
    static RefreshCost(rumor, blob) {
        var appearance = qs(rumor, '.cost_appearance');
            
        Rumor.MinCost.set(appearance, blob.minCost);
        Rumor.Unit.set(appearance, blob.unit)
    }    
}
Utils.classMixin(Rumor, AbstractDomController, {
    matcher: "[wt~=Rumor]",
    template: "town_rumor",
    params: function(config) {
        return {
            NAME: config.name,
            COST: config.cost
        }
    },
    decorate: IdAttr.generate
});