class ActionButton {

    static Mode = new ScopedAttr('mode', StringAttr);

    static OnClick(evt, handler) {
        var mode = ActionButton.Mode.get(handler);
        if (!!mode) {
            WoofRootController.dispatchNativeOn(handler, mode, {});
        }
    }

    static setMode(relativeTo, mode) {
        var self = ActionButton.find(relativeTo);
        ActionButton.Mode.set(self, mode);
    }
}
WoofRootController.register(ActionButton);
Utils.classMixin(ActionButton, AbstractDomController, {
    matcher: '[wt~="ActionButton"]'
})