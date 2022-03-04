class Events {
    static success() {
        return {
            success: true
        };
    }

    // Nothing yet!!
    static hangOutGold(assignment, addGoldResult) {
        var units = Unit.findAll(assignment);
        return units.length;
    }
}
WoofRootController.register(Events);
