class VolleyCounter {
    static MinimumVolleys = new ScopedAttr('minimum-volleys', IntAttr);
    static VolleysLeft = new ScopedAttr('volleys-left', IntAttr);
    static VolleysOverMin = new ScopedAttr('volleys-over-min', IntAttr);

    static minVolleysLeft(elt) {
        var counter = VolleyCounter.find(elt);
        var countDown = counter.querySelector(".countdown");
        return VolleyCounter.VolleysLeft.get(countDown) || 0;
    }

    static volleysOverMin(elt) {
        var counter = VolleyCounter.find(elt);
        var countUp = counter.querySelector(".countup");
        return VolleyCounter.VolleysOverMin.get(countUp) || 0;
    }

    static AfterPlayRound = GameEffect.handle(function(handler) {
        // We want to reset.
        var counter = VolleyCounter.find(handler);
        var countDown = counter.querySelector(".countdown");
        VolleyCounter.VolleysLeft.set(countDown, VolleyCounter.MinimumVolleys.get(countDown));

        var countUp = counter.querySelector(".countup");
        VolleyCounter.VolleysOverMin.set(countUp);
    });

    static AfterVolley = GameEffect.handle(function(handler) {
        // Do some counting.
        var counter = VolleyCounter.find(handler);
        var countDown = counter.querySelector(".countdown");
        var volleysLeft = VolleyCounter.VolleysLeft.get(countDown);
        if (!!volleysLeft) {
            if (volleysLeft == 1) {
                VolleyCounter.VolleysLeft.set(countDown);
            } else {
                VolleyCounter.VolleysLeft.set(countDown, volleysLeft - 1);
            }
            return;
        }

        var countUp = counter.querySelector(".countup");
        var newVolleys = VolleyCounter.VolleysOverMin.get(countUp);
        if (!newVolleys) {
            newVolleys = 1;
        } else {
            newVolleys += 1;
        }
        VolleyCounter.VolleysOverMin.set(countUp, newVolleys);
    });

}
WoofRootController.register(VolleyCounter);
Utils.classMixin(VolleyCounter, AbstractDomController, {
    matcher: ".volley_tracker",
});