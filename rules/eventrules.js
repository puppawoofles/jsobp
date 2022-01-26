

class EventRules {

    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Event);

    static findDefs(elt) {

    }

    static Name = new ScopedAttr("name", StringAttr);
    static Namespace = new ScopedAttr("namespace", StringAttr);
    static Glob = new ScopedAttr("glob", BlobAttr);
    static Type = new ScopedAttr("type", StringAttr);
    static End = new ScopedAttr("end", BoolAttr);
    static NextState = new ScopedAttr('next-state', StringAttr);
    static EncounterFn = new ScopedAttr("encounter-fn", FunctionAttr);
    static Result = new ScopedAttr("result", StringAttr);
    static Label = new ScopedAttr("label", StringAttr);
    static Choice = new ScopedAttr("choice", StringAttr);
    static Victory = new ScopedAttr("victory", BoolAttr);
    static Globals = new ScopedAttr("global-keys", ListAttr);
    static Defs = new ScopedAttr("defs", BlobAttr);

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

        // First, we should set up our defs/variables.
        var defs = {};
        var globals = {};

        // Find the blueprint and see if it has a namespace, and if so, look it up or create it.
        var blueprintElt = qs(screen, 'blueprint');
        var defNamespace = EventRules.Namespace.get(blueprintElt) || null;
        var workspace = RunInfo.getWorkspace(handler);
        if (!!defNamespace) {
            var globalsElt = qs(workspace, 'event-state[namespace="' + defNamespace + '"]');
            if (!globalsElt) {
                globalsElt = Templates.inflateIn('event_global_state', workspace);
                EventRules.Namespace.copy(globalsElt, blueprintElt);
                EventRules.Glob.set(globalsElt, {});
            }
            globals = EventRules.Glob.get(globalsElt, {});
        }

        // Next up, find all top-level global defs off the blueprint and if they're not already defined, define them.
        var globs = DefHelper.processAll(qsa(blueprintElt, ':scope > def[global="true"]'), {});
        if (globs) {
            for (var [key, value] of Object.entries(globs)) {
                if (globals[key] === undefined) globals[key] = value;
            }    
        }

        // Lastly, populate our defs with our top-level non-globals and our globals.
        defs = Object.assign(defs, globals);
        DefHelper.processAll(qsa(blueprintElt, ':scope > def:not([global="true"])'), defs);

        EventRules.Globals.set(screen, Object.keys(globals));
        EventRules.Defs.set(screen, defs);

        var holder = qs(screen, WoofType.buildSelector("ScreenWrapper"));
        var currentState = start;

        var nextFn = function(end) {
            // First, clear out the old state.
            Utils.clearChildren(holder);

            if (!!end) {
                // Read our globals/defs and update our global map.
                if (!!defNamespace) {
                    var globKeys = EventRules.Globals.get(screen);
                    var defValues = EventRules.Defs.get(screen);
                    var globs = globKeys.map(function(key) { return defValues[key]; });
    
                    var globalsElt = qs(workspace, 'event-state[namespace="' + defNamespace + '"]');
                    EventRules.Glob.set(globalsElt, globs);
                }

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
                    deck: qs(screen, "deck"),
                    defs: defs
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
                EventRules._executeEventResult(screen, pointer, defs);
                

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


    static _executeEventResult(screen, resultElt, defs) {
        var commands = {
            "result": function(elt) {
                qs(screen, 'results').appendChild(elt.cloneNode(true));
            },
            "def": function(elt) {
                DefHelper.process(elt, defs);
            },
            "remove-item": function(elt) {
                // TODO: implement lol.
            }
        };
        DomScript.execute(resultElt, commands);
    }

    static Title = new ScopedAttr("title", StringAttr);
    static StandIns = new ScopedAttr('stand-ins', ListAttr);

    /**
     * {
     *   eventScreen: Element[wt=EventScreen],
     *   holder: Element[wt=ScreenWrapper]
     *   vignette: Element (state)
     * }
     */
    static Flag = new ScopedAttr("flag", StringAttr);
    static FilterFn = new ScopedAttr("filter-fn", FunctionAttr);
    static Choose = new ScopedAttr("choose", IntAttr);
    static Vignette = GameEffect.handle(function(handler, effect, params) {
        PendingOpAttr.storeTicketOn(params.eventScreen, effect, "EventRules.Vignette");

        // Inflate!
        var vignetteScreen = Templates.inflateIn('vignette_screen', params.holder, {});
        var state = params.vignette;

        // Get our defs.
        var defs = EventRules.Defs.findUp(vignetteScreen);
        defs = EventRules.Defs.get(defs);

        // Render choices.
        var workingChoices = [state];
        var noWorkDone = false;
        var filterFn = function(elt) {
            // If it has no flag set, keep it, but if it does, only keep if true.
            return (!EventRules.Flag.has(elt) || defs[EventRules.Flag.get(elt)] === true) &&
                (!EventRules.FilterFn.has(elt) || DefHelper.invoke(elt, EventRules.FilterFn, defs));
        };
        while (!noWorkDone) {
            noWorkDone = true;
            workingChoices = workingChoices.filter(filterFn).map(function(elt) {
                // Possibly expand.
                // Choices just get returned straight-up.
                if (elt.tagName.toLowerCase() == 'choice') return elt;
                noWorkDone = false;
                var choiceQuery = ':scope > choice, :scope > choice-group';
                if (!EventRules.Choose.has(elt)) return qsa(elt, choiceQuery);
                // This is specifically a choice-group, which has semantics around prioritization.
                var count = EventRules.Choose.get(elt);
                var toReturn = [];

                // We want to process our children for choices until we have enough choices.
                // First, our priority choices:
                var priority = qsa(elt, ':scope > choice[priority="true"]').filter(filterFn);
                while (priority.length > 0 && toReturn.length < count) {
                    // These go in order.
                    toReturn.push(priority.shift());
                }
                if (toReturn.length >= count) return toReturn;
                // Next up, our regular choices:
                var choices = qsa(elt, ':scope > choice:not([priority="true"]):not([fallback="true"])').filter(filterFn);
                while (choices.length > 0 && toReturn.length < count) {
                    toReturn.push(EventRules._rng.randomValueR(choices));
                }
                if (toReturn.length >= count) return toReturn;
                // Lastly, fallbacks.
                var fallbacks = qsa(elt, ':scope > choice[fallback="true"]').filter(filterFn);
                while (fallbacks.length > 0 && toReturn.length < count) {
                    // These go in order.
                    toReturn.push(fallbacks.shift());
                }
                return toReturn;
            }).flat();


        }

        var choices = workingChoices;
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