
class RunBar {
    static Month = new ScopedAttr("month", StringAttr);
    static Day = new ScopedAttr("day", StringAttr);
    static CurrentGold = new ScopedAttr("current-gold", IntAttr);

    static refresh(barElt, infoElt) {
        var m = RunBar.Month.find(barElt);
        var d = RunBar.Day.find(barElt);
        var cg = RunBar.CurrentGold.find(barElt);

        RunBar.Month.set(m, RunInfo.getMonth(infoElt));
        RunBar.Day.set(d, RunInfo.getDay(infoElt));
        RunBar.CurrentGold.set(cg, RunInfo.getCurrentGold(infoElt));
    }
}
Utils.classMixin(RunBar, AbstractDomController, {
    matcher: 'div.run_bar',
    template: "run_bar",
    params: function() {
        return {};
    }
});