class HoverHelper {
    static HoverHelp = new ScopedAttr('hover-help', StringAttr);
    static HoverActive = new ScopedAttr('hover-help-active', StringAttr);
    static HoverTimeout = new ScopedAttr('hover-timeout', IntAttr);

    static CurrentHover = new ScopedAttr("current-hover", StringAttr);

    static OnMouseOver(event, handler) {
        // This version works, but is slow.
        var help = HoverHelper.HoverHelp.findUp(event.target);
        var currentHover = HoverHelper.CurrentHover.get(handler);
        if (!help && !!currentHover) {
            // We're not hovering over something that needs a hand.
            // That means we should unhover the thing that's currently hovering.
            // Find the thing being hovered and unflag it as being hovered.
            HoverHelper.unhover(handler);
            return;
        }
        if (help) {
            var activeOnHelp = HoverHelper.HoverActive.get(help);
            if ((!activeOnHelp && !!currentHover) || (activeOnHelp != currentHover)) {
                // UNhover if we detect we're hovering over a new thing.
                HoverHelper.unhover(handler);
            }
            if (!activeOnHelp || activeOnHelp != currentHover) {
                // Same dealio!  Bail out.
                HoverHelper.setCurrentHover(handler, help);
            }
        }
    }

    static setCurrentHover(handler, toHover) {
        var id = Utils.UUID();
        // Set it on our handler for global tracking.
        HoverHelper.CurrentHover.set(handler, id);

        // Set it on our element for deduping.
        HoverHelper.HoverActive.set(toHover, id);

        var matcher = HoverHelper.HoverHelp.get(toHover);
        Array.from(Utils.bfindAll(handler, 'body', matcher)).forEach(function(elt) {
            elt.classList.add("remote_hover");            
        });
    }

    static unhover(handler, toUnhover) {
        var thing = Utils.bfind(handler, 'body', HoverHelper.HoverActive.buildSelector(toUnhover));
        if (thing) {
            HoverHelper.CurrentHover.set(handler); // Unset this one too.

            // Clean up our hover refs.
            HoverHelper.HoverActive.set(thing); // Unset it.
            var matcher = HoverHelper.HoverHelp.get(thing);
            Array.from(Utils.bfindAll(handler, 'body', matcher)).forEach(function(elt) {
                elt.classList.remove("remote_hover");            
            });
        }
    }

    static OnMouseOut(event, handler) {
        if (event.target == handler) {
            HoverHelper.unhover(handler);
        }
    }
}
WoofRootController.addListeners("mouseover", "mouseout");
WoofRootController.register(HoverHelper);