class VolleyCounter {
    static MinimumVolleys = new ScopedAttr('minimum-volleys', IntAttr);
    static VolleysLeft = new ScopedAttr('volleys-left', IntAttr);
    static VolleysOverMin = new ScopedAttr('volleys-over-min', IntAttr);
    static VolleyDelay = new ScopedAttr('volley-time-delay', IntAttr);
    static Delay = new ScopedAttr('delay', IntAttr);

    static minVolleysLeft(elt) {
        var counter = VolleyCounter.find(elt);
        var countDown = qs(counter, ".countdown");
        return VolleyCounter.VolleysLeft.get(countDown) || 0;
    }

    static volleysOverMin(elt) {
        var counter = VolleyCounter.find(elt);
        var countUp = qs(counter, ".countup");
        return VolleyCounter.VolleysOverMin.get(countUp) || 0;
    }

    static AfterPlayRound = GameEffect.handle(function(handler) {
        // We want to reset.
        var counter = VolleyCounter.find(handler);
        var countDown = qs(counter, ".countdown");
        VolleyCounter.VolleysLeft.set(countDown, VolleyCounter.MinimumVolleys.get(countDown));

        var countUp = qs(counter, ".countup");
        VolleyCounter.VolleysOverMin.set(countUp);
    });

    static AfterVolley = GameEffect.handle(function(handler) {
        // Do some counting.
        var counter = VolleyCounter.find(handler);
        var countDown = qs(counter, ".countdown");
        var volleysLeft = VolleyCounter.VolleysLeft.get(countDown);
        if (!!volleysLeft) {
            if (volleysLeft == 1) {
                VolleyCounter.VolleysLeft.set(countDown);
            } else {
                VolleyCounter.VolleysLeft.set(countDown, volleysLeft - 1);
            }
            return;
        }

        var countUp = qs(counter, ".countup");
        var newVolleys = VolleyCounter.VolleysOverMin.get(countUp);
        if (!newVolleys) {
            newVolleys = 1;
        } else {
            newVolleys += 1;
        }
        VolleyCounter.VolleysOverMin.set(countUp, newVolleys);
    });

    static VolleySpeed = function(ui) {
        var volleyCounter = VolleyCounter.bfind(ui, 'body');
        var delay = VolleyCounter.Delay.get(ui);
        var mult = VolleyCounter.VolleyDelay.findGet(volleyCounter);
        var total = delay * mult;
        if (isNaN(total)) return false;
        return total;
    }

}
WoofRootController.register(VolleyCounter);
Utils.classMixin(VolleyCounter, AbstractDomController, {
    matcher: ".volley_tracker",
});