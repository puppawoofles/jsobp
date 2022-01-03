class TutorialHelper {
    static ScreenLabel = new ScopedAttr("screen-label", StringAttr);
    static Compendium = new ScopedAttr("compendium", StringAttr);
    static TutorialLabel = new ScopedAttr("tutorial-label", StringAttr);

    static OnScreenChange(event, handler) {
        var debugScreenLabel = handler.querySelector(".debug_panel " + TutorialHelper.ScreenLabel.buildSelector());
        var debugScreenCompendium = handler.querySelector(".debug_panel " + TutorialHelper.Compendium.buildSelector());
        var screens = Array.from(handler.querySelectorAll(WoofType.buildSelector("Screen")));
        var title = '';
        var titleSet = false;
        while (screens.length > 0) {
            var screen = screens.shift();
            // Update our title.
            if (TutorialHelper.ScreenLabel.has(screen)) {
                var label = TutorialHelper.ScreenLabel.get(screen);
                if (titleSet) {
                    title += " > ";
                }
                title += label;
                titleSet = true;
            }
            // Update our tutorial.  We use our "last" one because that's the most specific one.
            if (TutorialHelper.TutorialLabel.has(screen)) {
                TutorialHelper.Compendium.set(debugScreenCompendium, TutorialHelper.TutorialLabel.get(screen));
            }
        }
        if (title.length > 0) {
            TutorialHelper.ScreenLabel.set(debugScreenLabel, title);
        }
    }
}
WoofRootController.register(TutorialHelper);