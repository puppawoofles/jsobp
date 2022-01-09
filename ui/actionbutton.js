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

    static PendingAction = new ScopedAttr('pending-action', StringAttr);
    static setPendingAction(relativeTo, action) {
        var self = ActionButton.find(relativeTo);
        var toReturn = ActionButton.PendingAction.get(self);
        ActionButton.PendingAction.set(self, action);
        return toReturn;
    }
    
    static clearPendingActionIf(relativeTo, action) {
        var self = ActionButton.find(relativeTo);
        if (ActionButton.PendingAction.get(self) == action) {
            ActionButton.PendingAction.set(self);
        }
    }

    static getPendingAction(relativeTo) {
        var self = ActionButton.find(relativeTo);
        return ActionButton.PendingAction.get(self);
    }
}
WoofRootController.register(ActionButton);
Utils.classMixin(ActionButton, AbstractDomController, {
    matcher: '[wt~="ActionButton"]'
})