
class RunInfo {
    static Month = new ScopedAttr("month", StringAttr);
    static Day = new ScopedAttr("day", StringAttr);
    static CurrentGold = new ScopedAttr("current-gold", IntAttr);

    static addToDeck(elt, card) {
        var runInfo = RunInfo.find(elt);
        var deck = runInfo.querySelector("deck");
        deck.appendChild(card);
    }

    static getDeck(elt) {
        var runInfo = RunInfo.find(elt);
        var deck = runInfo.querySelector("deck");
        return Array.from(deck.children);
    }

    static setMonth(elt, month) {
        var runInfo = RunInfo.find(elt);        
        var m = RunInfo.Month.find(runInfo)
        RunInfo.Month.set(m, month);
    }

    static getMonth(elt) {
        var runInfo = RunInfo.find(elt);        
        return RunInfo.Month.findGet(runInfo)
    }

    static setDay(elt, month) {
        var runInfo = RunInfo.find(elt);        
        var m = RunInfo.Day.find(runInfo)
        RunInfo.Day.set(m, month);
    }

    static getDay(elt) {
        var runInfo = RunInfo.find(elt);        
        return RunInfo.Day.findGet(runInfo)
    }

    static setCurrentGold(elt, month) {
        var runInfo = RunInfo.find(elt);        
        var m = RunInfo.CurrentGold.find(runInfo)
        RunInfo.CurrentGold.set(m, month);
    }

    static getCurrentGold(elt) {
        var runInfo = RunInfo.find(elt);        
        return RunInfo.CurrentGold.findGet(runInfo)
    }
}
Utils.classMixin(RunInfo, AbstractDomController, {
    matcher: 'run-info',
    template: 'run_info',
    params: function(config) {
        return {};
    }
});