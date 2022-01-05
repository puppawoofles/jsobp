
/**
 * A basic dialog screen class used to allow players to make choices on things.
 * 
 * This thing is basically a fancy wrapper around a promise.
 */
class DialogScreen {

    static _pendingScreens = {};

    static Show(elt, opt_controller, opt_params) {
        return new Promise(function(resolve, reject) {
            // This basically applies itself on top of the current screen.

            var screens = Utils.bfindAll(elt, "[wt~=MainScreen]", "[wt~=ScreenWrapper]");
            if (!screens) {
                screens = Utils.bfindAll(elt, '[wt~=MainScreen]', '[wt~=ScreenWrapper]');
            }
            if (!screens) throw boom("Unable to show a dialog, couldn't find a screen.");

            var screen = screens[screens.length - 1]; // Deepest screen
            var me = DialogScreen.inflateIn(screen);
            var id = IdAttr.generate(me);
            if (opt_controller) {
                var params = opt_params || {};
                var child = opt_controller.inflateIn(me, params);
                if (opt_controller.setup) opt_controller.setup(child, params);
            }
            DialogScreen._pendingScreens[id] = [resolve, reject, opt_controller];
        });
    }

    static Resolve(elt, value) {
        var me = DialogScreen.findUp(elt);
        var id = IdAttr.generate(me);
        var pending = DialogScreen._pendingScreens[id];        
        pending[0](value);
        delete DialogScreen._pendingScreens[id];
        if (pending[2] && pending[2].teardown) pending[2].teardown(me.children[0] || me);
        me.remove();
    }

    static Reject(elt, value) {
        var me = DialogScreen.findUp(elt);
        var id = IdAttr.generate(me);
        var pending = DialogScreen._pendingScreens[id];        
        pending[1](value);
        delete DialogScreen._pendingScreens[id];
        if (pending[2] && pending[2].teardown) pending[2].teardown(me.children[0] || me);
        me.remove();
    }
}
Utils.classMixin(DialogScreen, AbstractDomController, {
    template: 'modal_dialog',
    matcher: '.modal_dialog',
    config: function(config) {
        return {};
    }
});


class DialogTester {
    static Resolve(event, handler) {
        DialogScreen.Resolve(handler);
    }

    static Reject(event, handler) {
        DialogScreen.Reject(handler);
    }

    static setup(dialog) {
        Logger.info("Set stuff up!");
    }

    static teardown(dialog) {
        Logger.info("Clean up stuff!");
    }
}
Utils.classMixin(DialogTester, AbstractDomController, {
    template: 'dialog_tester',
    params: function(config) {
        return {};
    }
});
WoofRootController.register(DialogTester);

