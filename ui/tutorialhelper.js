class TutorialHelper {
    static ScreenLabel = new ScopedAttr("screen-label", StringAttr);
    static Compendium = new ScopedAttr("compendium", StringAttr);
    static TutorialLabel = new ScopedAttr("tutorial-label", StringAttr);

    static OnScreenChange(event, handler) {
        var debugScreenLabel = qs(handler, ".debug_panel " + TutorialHelper.ScreenLabel.buildSelector());
        var debugScreenCompendium = qs(handler, ".debug_panel " + TutorialHelper.Compendium.buildSelector());
        var screens = qsa(handler, WoofType.buildSelector("Screen"));
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
                var currentNav = InfoPanel.currentNav(screen);
                var newTutorialNav = TutorialHelper.TutorialLabel.get(screen);
                TutorialHelper.Compendium.set(debugScreenCompendium, newTutorialNav);

                if (currentNav.startsWith("tutorial") && currentNav != newTutorialNav) {
                    // Attempt to auto-navigate                    
            		Utils.setFragment(newTutorialNav);
                }
            }
        }
        if (title.length > 0) {
            TutorialHelper.ScreenLabel.set(debugScreenLabel, title);
        }
    }
}
WoofRootController.register(TutorialHelper);