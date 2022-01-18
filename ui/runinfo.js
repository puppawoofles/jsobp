
class RunInfo {
    static Month = new ScopedAttr("month", StringAttr);
    static Day = new ScopedAttr("day", StringAttr);
    static CurrentGold = new ScopedAttr("current-gold", IntAttr);

    static __getThings(selector) {
        return function(elt) {
            var runInfo = RunInfo.find(elt);
            var thingsContainer = qs(runInfo, selector);
            return a(thingsContainer.children);
        }
    }

    static __getHolder(selector) {
        return function(elt) {
            var runInfo = RunInfo.find(elt);
            return qs(runInfo, selector);
        }
    }

    static __addThing(selector) {
        return function(elt, thing) {
            var runInfo = RunInfo.find(elt);
            var thingsContainer = qs(runInfo, selector);
            thingsContainer.appendChild(thing);
        }
    }

    static getStorageHolder = RunInfo.__getHolder("storage");
    static getStorageItems = RunInfo.__getThings("storage");
    static addStorageItem = RunInfo.__addThing("storage");
    static getVisitors = RunInfo.__getThings("visitors");
    static addVisitor = RunInfo.__addThing("visitors");
    static getDeckHolder = RunInfo.__getHolder("deck");
    static getDeck = RunInfo.__getThings("deck");
    static addToDeck = RunInfo.__addThing("deck");
    static getRumors = RunInfo.__getThings("rumors");
    static addRumor = RunInfo.__addThing("rumors");
    static getUnits = RunInfo.__getThings("units");
    static addUnit = RunInfo.__addThing("units");
    static getUnitHolder = RunInfo.__getHolder("units");

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

    static addGold(elt, amount) {
        var currentGold = RunInfo.getCurrentGold(elt);
        RunInfo.setCurrentGold(elt, currentGold + amount);
    }

    static hasEnoughGold(elt, amount) {
        return RunInfo.getCurrentGold(elt) >= amount;
    }

    static spendGold(elt, amount) {
        var currentGold = RunInfo.getCurrentGold(elt);
        RunInfo.setCurrentGold(elt, Math.max(0, currentGold - amount));
    }
}
Utils.classMixin(RunInfo, AbstractDomController, {
    matcher: 'run-info',
    template: 'run_info',
    params: function(config) {
        return {};
    }
});