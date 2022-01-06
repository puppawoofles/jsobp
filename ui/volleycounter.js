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

    static volleyCount(elt) {
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

        var stepButton = bf(handler, '.volley_tracker > .step_button');
        VolleyCounter.Enabled.set(stepButton);
    });

    static BeforeVolley = GameEffect.handle(function(handler, effect, params) {
        var counter = VolleyCounter.find(handler);
        var countUp = qs(counter, ".countup");

        var value = (VolleyCounter.VolleysOverMin.get(countUp) || 0) + 1;

        params.volleyCount = value;
        // Update params.
        GameEffect.setParams(effect, params);
        VolleyCounter.VolleysOverMin.set(countUp, value);
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
    });

    static SpeedOptions = new ScopedAttr('speed_options', ListAttr);
    static CurrentSpeed = new ScopedAttr('current_speed', IntAttr);
    static OnSpeedButtonClick(event, handler) {

        var options = VolleyCounter.SpeedOptions.find(handler);
        var dest = VolleyCounter.CurrentSpeed.find(handler);

        var values = VolleyCounter.SpeedOptions.get(options);
        values.push(values.shift()); // Move onto the next one.
        VolleyCounter.SpeedOptions.set(options, values);
        VolleyCounter.CurrentSpeed.set(dest, values[0]);
    }

    static Delays = new ScopedAttr('delays', ListAttr);
    static VolleySpeed = function(ui) {
        var self = bf(ui, VolleyCounter.CurrentSpeed.selector());
        var idx = parseInt(VolleyCounter.CurrentSpeed.get(self));
        var delay = VolleyCounter.Delays.get(ui)[idx];
        if (isNaN(delay)) return false;
        return delay;
    }

    static Options = new ScopedAttr('options', ListAttr);
    static CurrentOption = new ScopedAttr('current_option', StringAttr);
    static OnPlayPauseClick(event, handler) {

        var options = VolleyCounter.Options.find(handler);
        var dest = VolleyCounter.CurrentOption.find(handler);

        var values = VolleyCounter.Options.get(options);
        values.push(values.shift()); // Move onto the next one.
        VolleyCounter.Options.set(options, values);
        VolleyCounter.CurrentOption.set(dest, values[0]);

        if (!VolleyCounter.IsPaused(handler)) {
            var button = bf(handler, '.volley_tracker > .step_button');
            VolleyCounter.Enabled.set(button);
        }
    }

    static IsPaused(handler) {
        var elt = bf(handler, '.volley_tracker');
        var dest = VolleyCounter.CurrentOption.findGet(elt);
        return dest == 'pause';
    }

    static Enabled = new ScopedAttr('enabled', BoolAttr);
    static ShowStepButton(handler) {
        var button = bf(handler, '.volley_tracker > .step_button');
        VolleyCounter.Enabled.set(button, true);        
    }

    static OnStepClick(event, handler) {
        var button = bf(handler, '.volley_tracker > .step_button');
        VolleyCounter.Enabled.set(button);
    }

    

}
WoofRootController.register(VolleyCounter);
Utils.classMixin(VolleyCounter, AbstractDomController, {
    matcher: ".volley_tracker",
});