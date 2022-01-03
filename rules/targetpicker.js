
class TargetPicker {
    static TargetContext = new ScopedAttr('target-context', StringAttr);
    static Context = new ScopedAttr('context', StringAttr);
    static Ticket = new ScopedAttr('ticket', StringAttr);
    static Effect = new ScopedAttr('effect', StringAttr);

    static PickTarget = GameEffect.handle(function(handler, effect, params) {
        // This is when we would need to take tickets.
        // This ticket is for the target invocation.
        var ticket = PendingOpAttr.takeTicket(effect, 'PickTarget');

        var targetElts = params.targets.map(function(elt) {
            return Utils.bfind(handler, 'body', elt);
        });

        var priority = params.priority.map(function(elt) {
            return Utils.bfind(handler, 'body', elt);
        });

        Templates.inflateIn('target_context', handler, {
            CONTEXT: params.context,
            TICKET: ticket,
            EFFECT: IdAttr.get(effect)
        });

        TargetController.addTargets(MainScreenHandler.find(handler), targetElts, params.context, "TargetPicker.OnPickGameEffectTarget", priority);
    });

    static _resolveTarget(handler, context, result) {
        // First, grab all info we need to resolve the effect.
        var contextElt = Utils.bfind(handler, 'body', 'target-context[context="' + context + '"]')
        if (!contextElt) {
            return;
        }
        var ticket = TargetPicker.Ticket.get(contextElt);
        var effect = TargetPicker.Effect.get(contextElt);

        // Clear our targets now that we picked one.
        TargetController.clearTarget(handler, context);

        var effect = GameEffect.findById(contextElt, effect);

        // Set our results.
        contextElt.remove(); // Remove tis, since it's no longer needed.
        var results = GameEffect.createResults(effect, result, []);
        GameEffect.setResult(effect, results);
        PendingOpAttr.returnTicket(effect, ticket);
    }

    static OnPickGameEffectTarget(event, handler) {
        // First, grab all info we need to resolve the effect.
        var context = TargetPicker.TargetContext.findGet(event.target);
        var target = WoofType.findUp(event.target, 'Target');        
        TargetPicker._resolveTarget(handler, context, {
            target: WoofType.buildSelectorFor(target)
        });
    }

    static cancel(handler, context) {
        // Oh shit, target was cancelled here.  Oyoooo!
        TargetPicker._resolveTarget(handler, context, {
            target: null
        });
    }

    static standardPickTarget(relativeTo, context, targetFn, preferredFilter) {
        var mainScreen = MainScreenHandler.find(relativeTo);        
        var current = EffectQueue.findCurrentEvent(mainScreen);
        if (!current) {
            current = mainScreen; // We'll find out queue from this.
        }

        var targets = targetFn();
        if (preferredFilter)
        var preferred = !!preferredFilter ? targets.filter(preferredFilter) : [];
        targets = targets.map(WoofType.buildSelectorFor);
        preferred = preferred.map(WoofType.buildSelectorFor);

        return new Promise(function(resolve, reject) { 
            if (targets.length == 0) {
                // No targets.
                reject();
                return;
            }
            GameEffect.push(current, GameEffect.create("PickTarget", {
                targets: targets,
                priority: preferred,
                context: context
            })).then(function(result) {
                if (result.result.target) {
                    resolve(result.result.target);
                }
                reject();
            });
        });

    }

}
WoofRootController.register(TargetPicker);