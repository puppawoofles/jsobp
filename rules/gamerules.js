class GameRules {
    static RunTicket = new ScopedAttr("run-ticket", StringAttr);
    static RunEffect = new ScopedAttr("run-effect", StringAttr);

    static NewRun = GameEffect.handle(function(handler, effect, params) {
        Logger.info("Got a request for a run!");
        var runScreen = RunScreen.inflate();
    
        // Put up the run screen.
        Screen.showScreen(handler, runScreen);

        // Next up, generate the starter deck.
        var starterDeck = [
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Units.sample_hero(handler),
            Tactic.inflate(Tactic.findBlueprint(handler, "retreat")),
            Tactic.inflate(Tactic.findBlueprint(handler, "reposition")),
            Tactic.inflate(Tactic.findBlueprint(handler, "pivot")),
            Tactic.inflate(Tactic.findBlueprint(handler, "taunt-enemy")),
            Tactic.inflate(Tactic.findBlueprint(handler, "taunt-ally")),
            Preparation.inflate(Preparation.findBlueprint(handler, "barricade"))
        ];
        starterDeck.forEach(function(content) {
            var card = Card.inflate(Utils.UUID());
            card.appendChild(content);
            RunInfo.addToDeck(runScreen,card);
        });
        RunInfo.setCurrentGold(handler, params.startingGold);

        // Seed our starter rumors.

        Blueprint.findAll(Utils.bfind(effect, 'body', 'starting-rumors'), 'assignment').forEach(function(rumor) {
            RunInfo.addRumor(runScreen, Rumor.FromAssignmentBlueprint(rumor))
        });

        var act = 1;
        var day = 1;
        var maxDay = 8;

        var dayFn = function() {
            if (act > 1) {
                // Run over!
                return GameEffect.createResults(effect);
            }

            return GameEffect.push(effect, GameEffect.create("NewDay", {
                act: act,
                day: day
            })).then(function() {
                day++;
                if (day > maxDay) {
                    act++;
                    day = 1;
                }
            }).then(dayFn);
        };

        return Promise.resolve().then(dayFn);
        
    });


    /**
     * {
     *   act: int,
     *   day: int
     * }
     */

    static acts = ["⛰️", "🔥","🌪️","💧"];
    static days = ["🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌕"];
     static EncounterFn = new ScopedAttr("encounter-fn", FunctionAttr);
     static InvokeFn = new ScopedAttr("assignment-invoke-fn", FunctionAttr);
     static NewDay = GameEffect.handle(function(handler, effect, params) {
        var runScreen = RunScreen.find(handler);
        var container = qs(runScreen, WoofType.buildSelector("ScreenWrapper"));

        RunInfo.setMonth(effect, GameRules.acts[params.act - 1]);
        RunInfo.setDay(effect, GameRules.days[params.day - 1]);

        var townScreen = TownScreen.bfind(handler, 'body');
        if (!townScreen) {
            townScreen = TownScreen.inflate(container, {});
            var currentSCreen = qs(runScreen, '[wt~=ScreenWrapper] [wt~=Screen]');
            Screen.showScreen(currentSCreen, townScreen);
        } else {
            container.appendChild(townScreen);
        }
        var ticket = PendingOpAttr.storeTicketOn(runScreen, effect, "NewDay");

        // Before we clear rumors, we should find the ones with ignore results and process those.
        TownScreen.getRumors(townScreen).forEach(function(rumor) {
            GameRules.ProcessResults(rumor, { ignored: true });
        });

        TownScreen.clearRumors(townScreen);
        TownScreen.clearAssignments(townScreen);

        var doingNothing = Assignment.FromBlueprint(townScreen, 'hangingout');
        Assignment.tag(doingNothing, "idle");
        TownScreen.addAssignment(townScreen, doingNothing);
        // Put all of our units in the doing-nothing assignment.
        Assignment.AssignCards(doingNothing, RunInfo.getDeck(townScreen).filter(function(card) {
            return Card.CardType.findGet(card) == 'unit';
        }));

        // Populate rumors.
        var rumors = RunInfo.getRumors(effect);
        rumors.forEach(function(rumor) {
            TownScreen.addRumor(townScreen, rumor);
        });

        return null;
    });

    static ProcessResults(thingWithResults, params) {
       qsa(thingWithResults, 'result').forEach(function(result) {
            if (GameRules.ResultPredicate(result, params)) {
                GameRules.HandleResult(thingWithResults, result);
            }
        });
    }

    static ResultPredicate(result, params) {
        // Check simple constraints.
        var toCheck = {
            'ignored': GameRules.Ignored,
            'victory': GameRules.Victory
        };

        for (var [param, attr] of Object.entries(toCheck)) {
            // We want to return no match if:
            // - The attr specifies a value missing from the params
            if (attr.has(result) && params[param] === undefined) {
                return false;
            }
            // - The attr specifies a value that doesn't match the params.
            if (attr.has(result) && (attr.get(result) != params[param])) {
                return false;
            }        
        }

        return true;
    }


    static Type = new ScopedAttr("type", StringAttr);
    static Fn = new ScopedAttr('fn', FunctionAttr);
    static HandleResult(relativeTo, result) {
        var handlers = bfa(relativeTo, 'result-handler').toObject(function(obj) {
            return GameRules.Type.get(obj).toLowerCase();
        }, function(toObj) {
            return GameRules.Fn.bind(toObj);
        });

        a(result.children).forEach(function(inner) {
            var tagName = inner.tagName.toLowerCase();
            if (!handlers[tagName]) {
                Logger.err("Don't know how to handle result type", tagName);
                return;
            }
            handlers[tagName](relativeTo, inner);
        });
    }

    static ExpandResult(relativeTo, resultElt) {
        return [];
    }

    static Amount = new ScopedAttr("amount", IntAttr);
    static AmountFn = new ScopedAttr("amount-fn", FunctionAttr);

    static AddGoldResult(relativeTo, resultElt) {
        var amount = GameRules.AmountFn.has(resultElt) ?
                GameRules.AmountFn.invoke(resultElt, relativeTo, resultElt) :
                GameRules.Amount.get(resultElt);
        RunInfo.addGold(relativeTo, amount);
    }

    static AddRumorResult(relativeTo, resultElt) {
        var rumor = Blueprint.find(resultElt, "assignment");
        RunInfo.addRumor(relativeTo, Rumor.FromAssignmentBlueprint(rumor));
    }

    static HealUnitsResult(relativeTo, resultElt) {
        var amount = GameRules.Amount.has(resultElt) ?
                GameRules.Amount.get(resultElt) :   
                GameRules.AmountFn.invoke(resultElt, relativeTo, resultElt);

        Unit.findAll(relativeTo).forEach(function(unit) {
            Unit.heal(unit, amount);
        });        
    }

    /**
     * {
     * 
     * }
     */
     static Victory = new ScopedAttr("victory", BoolAttr);
     static Ignored = new ScopedAttr("ignored", BoolAttr);
     static Blueprint = new ScopedAttr("blueprint", StringAttr);
     static ExecuteDay = GameEffect.handle(function(handler, effect, params) {
        var townScreen = TownScreen.bfind(handler, 'body');
        var assignmentHolder = WoofType.find(townScreen, "AssignmentHolder");
        var defaultAssignment = Utils.bfind(effect, 'body', 'default-assignment');
        var bps = WoofType.findAll(assignmentHolder, 'AssignmentBP');

        var invokeFns = bps.map(function(bp) {
            return {
                elt: WoofType.findUp(bp, 'Assignment'),
                invokeFn: GameRules.InvokeFn.findDown(bp) || defaultAssignment
            }
        });

        var dayFn = function() {
            if (invokeFns.length == 0) {
                // We've invoked everything.

                // Let's move our units back to the deck.
                qsa(townScreen, "[wt~=Card]").forEach(function(card) {
                    RunInfo.addToDeck(townScreen, card);
                });

                return GameEffect.createResults(effect);
            }
            
            var t = invokeFns.shift();
            return GameRules.InvokeFn.invoke(t.invokeFn, t.elt).then(function(result) {
                GameRules.ProcessResults(t.elt, result);
            }).then(dayFn);
        };

        return Promise.resolve().then(dayFn);
    });

    static Embark(handler, encounters) {
        var runScreen = RunScreen.bfind(handler, 'body');
        var effect = PendingOpAttr.getPendingEffect(runScreen);

        GameEffect.push(effect, GameEffect.create("ExecuteDay", {
            encounters: encounters
        })).then(function() {
            PendingOpAttr.returnTicketOn(runScreen);
            GameEffect.setResult(effect, GameEffect.createResults(effect));
        });
    }

    static LaunchEffect(assignment) {
        var assignmentBp = WoofType.findDown(assignment, 'AssignmentBP');
        var queue = EffectQueue.currentQueue(assignmentBp);        
        var townScreen = TownScreen.find(assignmentBp);

        // Basic option: We just do the thing.
        var units = Assignment.GetAssignedCards(assignment);
        return Promise.resolve().then(function() {
            return GameRules.EncounterFn.findInvoke(assignmentBp, assignmentBp, queue, townScreen, units);
        });
    }

    /**
     * Launches an event based on an element that has an EncounterFn property and a .units holder for wt~=Card elements.
     */
    static Event = new ScopedAttr("event", StringAttr);
    static Label = new ScopedAttr("label", StringAttr);
    static LaunchEvent(assignment) {
        var assignmentBp = WoofType.findDown(assignment, 'AssignmentBP');
        var queue = EffectQueue.currentQueue(assignmentBp);        
        var townScreen = TownScreen.find(assignmentBp);

        // This event assumes that it's already rendered and good to go.
        var blueprint = Blueprint.find(assignmentBp, 'event');
        var eventScreen = EventScreen.inflate({
            label: GameRules.Label.findGet(assignmentBp)
        });

        // Find our results holder.

        // Copy blueprint in.
        Utils.moveChildren(blueprint.cloneNode(true), qs(eventScreen, "blueprint"));

        // Move units in.
        var unitHolder = qs(eventScreen, 'units');
        Assignment.GetAssignedCards(assignment).forEach(function(unit) {
            unitHolder.appendChild(unit);
        });
        // Update the deck.
        var deckHolder = qs(eventScreen, 'deck');
        RunInfo.getDeck(townScreen).forEach(function(card) {
            deckHolder.appendChild(card);
        });

        Screen.showScreen(townScreen, eventScreen);

        return GameEffect.push(queue, GameEffect.create("Event", {
            eventScreen: eventScreen
        })).then(function(result) {
            // Do cleanup here.

            // First: Move the deck back.
            Array.from(deckHolder.children).forEach(function(c) {
                RunInfo.addToDeck(townScreen, c);
            });

            // Then move the units back.
            Assignment.AssignCards(assignment, a(unitHolder.children));

            // Lastly, process our new results.
            var results = qsa(eventScreen, 'results > result');
            Assignment.AddResults(assignment, results);

            // Now destroy the event screen;
            Screen.showScreen(eventScreen, townScreen);
            eventScreen.remove();

            return {
                victory: result.result.victory
            };
        });
    }
}
WoofRootController.register(GameRules);