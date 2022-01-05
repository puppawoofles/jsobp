class Screen {

    static hideScreen(elt) {
        var holder = Utils.bfind(elt, 'body', '[wt~="ScreenHolder"]')
        var wrapper = WoofType.findUp(elt.parentNode, "ScreenWrapper");
        if (!wrapper) wrapper = WoofType.find(elt, "ScreenWrapper");
        var screen = WoofType.find(wrapper, "Screen");
        if (screen) {
            holder.appendChild(screen);
        }
        return screen;
    }

    static showScreen(elt, matcher) {
        var foundScreen = matcher;
        if (!(foundScreen instanceof HTMLElement)) {
            foundScreen = Utils.bfind(elt, 'body', '[wt~="ScreenHolder"] > ' + matcher)
        }

        var wrapper = WoofType.findUp(elt, "ScreenWrapper");
        if (!wrapper) wrapper = WoofType.find(elt, "ScreenWrapper");
        var currentScreen = null;
        if (foundScreen) {
            var screenToHide = WoofType.findDown(wrapper, 'Screen');
            if (screenToHide) currentScreen = Screen.hideScreen(WoofType.findDown(wrapper, 'Screen'));
            wrapper.appendChild(foundScreen);
        }
        WoofRootController.dispatchNativeOn(wrapper, "ScreenChange", {});
        return currentScreen;
    }
}
WoofRootController.addListener("ScreenChange");