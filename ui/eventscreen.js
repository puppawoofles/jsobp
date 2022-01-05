

class EventScreen {

}
WoofRootController.register(EventScreen);
Utils.classMixin(EventScreen, AbstractDomController, {
    matcher: '[wt~=EventScreen]',
    template: 'event_screen',
    params: function(config) {
        return {
            LABEL: config.label
        };
    },
    decorate: IdAttr.generate
});