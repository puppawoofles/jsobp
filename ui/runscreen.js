class RunScreen {
    static OnRunInfoChange(event, handler) {
        var runInfo = RunInfo.find(event.target);
        var runBar = RunBar.find(handler);
        RunBar.refresh(runBar, runInfo);
    }
}
WoofRootController.register(RunScreen);
Utils.classMixin(RunScreen, AbstractDomController, {
    template: 'run_screen',
    params: function() {
        return {};
    },
    decorate: function(elt) {
        var infoPanel = elt.querySelector("info");
        var runInfo = RunInfo.inflateIn(infoPanel, {});

        var runBarHolder = elt.querySelector(".run_bar_container");
        var runBar = RunBar.inflateIn(runBarHolder, {});
        RunBar.refresh(runBar, runInfo);

        // This is where we probably should do the town screen.
        var screenHolder = elt.querySelector(".body_container");
        TownScreen.inflateIn(screenHolder, {});
    }
})