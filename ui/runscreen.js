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
    matcher: '.run_screen',
    params: function() {
        return {};
    },
    decorate: function(elt) {
        var infoPanel = qs(elt, "info");
        var runInfo = RunInfo.inflateIn(infoPanel, {});

        var runBarHolder = qs(elt, ".run_bar_container");
        var runBar = RunBar.inflateIn(runBarHolder, {});
        RunBar.refresh(runBar, runInfo);
    }
})