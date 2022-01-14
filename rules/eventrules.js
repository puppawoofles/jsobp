

class EventRules {

    static Name = new ScopedAttr("name", StringAttr);
    static Type = new ScopedAttr("type", StringAttr);
    static End = new ScopedAttr("end", BoolAttr);
    static NextState = new ScopedAttr('next-state', StringAttr);
    static EncounterFn = new ScopedAttr("encounter-fn", FunctionAttr);
    static Result = new ScopedAttr("result", StringAttr);
    static Label = new ScopedAttr("label", StringAttr);
    static Choice = new ScopedAttr("choice", StringAttr);
    static Victory = new ScopedAttr("victory", BoolAttr);

    /**
     * {
     *   eventScreen: element (units should already be populated in this!);
     * }
     */
    static Event = GameEffect.handle(function(handler, effect, params) {
        // This should already be rendered for us.
        var screen = params.eventScreen;
        var start = qs(screen, 'state[start=true]');
        if (!start) {
            Logger.err("Missing start state in event!");
            return GameEffect.createResults(effect, {victory:false});            
        }

        var holder = qs(screen, WoofType.buildSelector("ScreenWrapper"));
        var currentState = start;

        var nextFn = function(end) {
            // First, clear out the old state.
            Utils.clearChildren(holder);

            if (!!end) {
                return GameEffect.createResults(effect, end);
            }

            // Next, render our upcoming state.
            var stateType = EventRules.Type.get(currentState);
            var promise = Promise.resolve();

            if (stateType == 'vignette') {
                promise = GameEffect.push(effect, GameEffect.create("Vignette", {
                    eventScreen: screen,
                    holder: holder,
                    vignette: currentState
                }, handler)).then(function(result) {
                    return result.result; // Normalize!
                });
            } else if (stateType == 'encounter') {
                // Move all units into the deck.
                var deckHolder = qs(screen, 'deck');
                Utils.moveChildren(qs(screen, 'units'), deckHolder);

                // Make cards out of their inventories and into the main deck.
                qsa(deckHolder, 'inventory [card-type]').forEach(function(item) {
                    var unit = Unit.findUp(item);
                    Card.ForUnit.set(item, IdAttr.generate(unit));
                    var card = Card.WrapInCard(item);
                    deckHolder.appendChild(card);
                });

                var bp = Blueprint.find(currentState, 'encounter');

                promise = GameEffect.push(effect, GameEffect.create("Encounter", {
                    // TODO: configure this in a sane way. :(
                    container: holder,
                    encounterBp: bp,
                    deck: qs(screen, "deck")
                }, handler)).then(function(result) {
                    // Clean up after the encounter.  Sort cards back into inventories and units back into their holder.
                    qsa(screen, '[wt~=Card]').forEach(function(card) {
                        if (Card.Ephemeral.get(card)) {
                            // Ephemeral cards gots to go.
                            card.remove();
                            return;
                        }

                        if (Card.CardType.findGet(card) == 'unit') {
                            qs(screen, 'units').appendChild(card);
                            return;
                        }
                        // Move non-units back into unit inventories, if relevant.
                        var forUnit = Card.ForUnit.findGet(card);
                        if (forUnit) {
                            var inventory = bf(screen, '.battlefield_unit[w-id="' + forUnit + '"] inventory');
                            if (inventory) {
                                inventory.appendChild(Card.CardType.find(card));
                            }
                            card.remove();
                        }
                    });

                    // Oh baby, such many results.
                    return result.result;
                });
            } else {
                Logger.err("Unknown state type on state", stateType, EventRules.Name.get(currentState));
                return GameEffect.createResults(effect);
            }
            return promise.then(function(result) {
                // Handle the result.
                // First, find the choice that matches the given result.
                var pointer = qs(currentState, "event-result" + EventRules.Choice.buildSelector(result));
                if (!pointer) {
                    Logger.error("Unable to find the listed result, defaulting to first", result);
                    pointer = qs(screen, "event-result");
                }
                // First, we want to look for any results, like gold or rumors or whatever.
                Array.from(pointer.children).forEach(function(thingie) {
                    qs(screen, 'results').appendChild(thingie.cloneNode(true));
                });

                // Second, check if we have a next state.
                if (EventRules.NextState.has(pointer)) {
                    currentState = qs(screen, 'state[name="' + EventRules.NextState.get(pointer) + '"]');
                } else {
                    // Assuming end state.
                    currentState = null;
                    return {
                        victory: !!EventRules.Victory.findGet(pointer)
                    };
                }
            }).then(nextFn);
        };
        
        return Promise.resolve().then(nextFn);
    });

    static Title = new ScopedAttr("title", StringAttr);
    static StandIns = new ScopedAttr('stand-ins', ListAttr);

    /**
     * {
     *   eventScreen: Element[wt=EventScreen],
     *   holder: Element[wt=ScreenWrapper]
     *   vignette: Element (state)
     * }
     */
    static Vignette = GameEffect.handle(function(handler, effect, params) {
        PendingOpAttr.storeTicketOn(params.eventScreen, effect, "EventRules.Vignette");

        // Inflate!
        var vignetteScreen = Templates.inflateIn('vignette_screen', params.holder, {});
        var state = params.vignette;

        // Render choices.
        var choices = qsa(state, 'choice');
        var choiceHolder = qs(vignetteScreen, '.choices');
        choices.forEach(function(choice) {
            Templates.inflateIn('vignette_choice', choiceHolder, {
                CHOICE_ID: EventRules.Result.get(choice),
                LABEL: EventRules.Label.get(choice)
            });
        });

        // Move units.
        var unitHolder = qs(vignetteScreen, '.units');
        var units = qsa(params.eventScreen, 'units > *');
        units.forEach(function(unit) {
            unitHolder.appendChild(unit);
        });

        // Render title.
        if (EventRules.Title.has(state)) {
            EventRules.Title.copy(vignetteScreen, state);
        }

        // Render flavor.
        var flavorElt = qs(state, 'flavor');
        units.shuffle();
        var counter = 0;
        var standIns = (EventRules.StandIns.get(flavorElt) || []).toObject(function(a) { return a; }, function(key) {
            var unit = units[counter++];
            counter = counter % units.length;
            return Unit.getName(unit);
        });
        var html = flavorElt.innerHTML;
		var html2 = html;
		for (var [k, v] of Object.entries(standIns)) {
			html2 = html.replace(new RegExp(k, 'g'), v);			
			html = html2;
		}
        qs(vignetteScreen, '.flavor').innerHTML = html;
    });

    static PickChoice(event, handler) {
        // Should be easy: Set the choice, return the ticket.
        var button = event.target;
        var choice = EventRules.Choice.get(button);
        var eventScreen = WoofType.findUp(handler, "EventScreen");

        var effect = PendingOpAttr.getPendingEffect(eventScreen);

        // Clean up the vignette: Move units back out.
        Utils.moveChildren(qs(eventScreen, "[wt~=VignetteScreen] .units"), qs(eventScreen, 'units'));

        GameEffect.setResult(effect, { result: choice});
        PendingOpAttr.returnTicketOn(eventScreen);
    }
}
WoofRootController.register(EventRules);