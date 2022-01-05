class Assignment {

    static findByName(elt, name) {
        return Utils.bfind(elt, '[wt~=RunScreen]', "[wt~=Assignment]" + Assignment.Name.buildSelector(name));
    }

    static Label = new ScopedAttr("label", StringAttr);
    static Name = new ScopedAttr("name", StringAttr);
    static InvokeFn = new ScopedAttr("assignment-invoke-fn", FunctionAttr);
    static EncounterFn = new ScopedAttr("encounter-fn", FunctionAttr);
    static Event = new ScopedAttr("event", StringAttr);
    static FromRumor(rumor) {

        var assignment = Assignment.inflate({
            name: Rumor.Name.findGet(rumor),
        });

        var resultHolder = qs(assignment, ".results");
        qsa(rumor, 'result').forEach(function(result) {
            resultHolder.appendChild(result);
        });

        var bpClone = WoofType.findDown(rumor, 'BP');
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

        // Cone our blueprint.
        var bpClone = elt.cloneNode(true);

        var resultHolder = qs(assignment, ".results");
        qsa(bpClone, 'result').forEach(function(result) {
            resultHolder.appendChild(result);
        });

        var bpHolder = WoofType.findDown(assignment, 'BP');
        Utils.moveChildren(bpClone, bpHolder);

        return assignment;
    }

    static AssignCards(assignment, cards) {
        var unitHolder = qs(assignment, '.units');
        cards.forEach(function(card) {
            unitHolder.appendChild(card);
        });
    }

    static GetAssignedCards(assignment) {
        return Card.findAll(assignment);
    }

    static AddResults(assignment, results) {
        var resultsHolder = qs(assignment, '.results');
        results.forEach(function(result) {
            resultsHolder.appendChild(result);
        });
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