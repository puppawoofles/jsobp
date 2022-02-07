class EndConditions {

    static Location = new ScopedAttr("location", StringAttr);
    static AllAlliesIn(condition, encounter) {
        var location = EndConditions.Location.get(condition);
        var block = CellBlock.findByLabel(encounter, location);
        if (TeamAttr.get(block) != Teams.Player) return;
        
        var battlefield = BattlefieldHandler.find(encounter);
        var playerUnit = Unit.findAllByTeam(battlefield, Teams.Player);

        if (playerUnit.length == 0) return;
        if (playerUnit.findFirst(function(unit) {
            return !BigCoord.equals(BigCoord.extract(unit), BigCoord.extract(block));
        })) return;

        return {
            success: true,
            result: "victory"
        };
    }

}
WoofRootController.register(EndConditions);
