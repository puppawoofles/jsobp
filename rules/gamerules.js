class GameRules {
    static RunTicket = new ScopedAttr("run-ticket", StringAttr);
    static RunEffect = new ScopedAttr("run-effect", StringAttr);

    static Count = new ScopedAttr("count", IntAttr);

    static NewRun = GameEffect.handle(function(handler, effect, params) {
        Logger.info("Got a request for a run, seed: ", params.seed);
        var runScreen = RunScreen.inflate();
    
        // Put up the run screen.
        Screen.showScreen(handler, runScreen);
        NoiseCounters.setCounter('seed', params.seed);

        var setupRNG = new SRNG(NC.Seed, true);

        // Next up, generate the starter deck.
        var starterDeck = [
            Tactic.inflate(Tactic.findBlueprint(handler, "retreat")),
            Tactic.inflate(Tactic.findBlueprint(handler, "reposition")),
            Tactic.inflate(Tactic.findBlueprint(handler, "pivot")),
            Tactic.inflate(Tactic.findBlueprint(handler, "taunt-enemy")),
            Tactic.inflate(Tactic.findBlueprint(handler, "taunt-ally")),
            Tactic.inflate(Tactic.findBlueprint(handler, "go-faster")),
            Tactic.inflate(Tactic.findBlueprint(handler, "go-slower"))
        ];
        starterDeck.forEach(function(content) {
            RunInfo.addToDeck(runScreen, content);
        });

        var starterUnits = [
            UnitGenerator.generate("player_unit"),
            UnitGenerator.generate("player_unit"),
            UnitGenerator.generate("player_unit"),
            UnitGenerator.generate("player_unit"),
            UnitGenerator.generate("player_unit"),
            UnitGenerator.generate("player_unit"),
            UnitGenerator.generate("player_unit"),
            UnitGenerator.generate("player_unit"),
            UnitGenerator.generate("player_unit"),
            UnitGenerator.generate("player_unit")
        ];
        starterUnits.forEach(function(content) {
            var card = Card.inflate(Utils.UUID());
            card.appendChild(content);
            RunInfo.addUnit(runScreen,card);
        });

        RunInfo.setCurrentGold(handler, params.startingGold);        

        // Seed our starter rumors.
        Blueprint.findAll(Utils.bfind(effect, 'body', 'starting-rumors'), 'assignment').forEach(function(rumor) {
            RunInfo.addRumor(runScreen, Rumor.FromAssignmentBlueprint(rumor))
        });

        // Generate our visitors.
        Blueprint.findAll(Utils.bfind(effect, 'body', 'starting-visitors'), 'visitor').forEach(function(bp) {
            RunInfo.addVisitor(runScreen, Visitor.FromBlueprintWithParams(bp, Units.randomVisitor(effect), Units._rng));
        });

        // Give ourselves some starting items.
        Utils.bfindAll(effect, 'body', 'starting-preparation').forEach(function(startingPreparation) {
            var count = GameRules.Count.get(startingPreparation);
            var preparations = Blueprint.findAll(startingPreparation, 'preparation');
            times(count).forEach(function() {
                RunInfo.addStorageItem(effect, Preparation.inflate(setupRNG.randomValue(preparations)));
            });    
        });

        var act = 1;
        var day = 1;
        var maxDay = 8;

        var dayFn = function() {
            if (act > 4) {
                // Run over!
                return GameEffect.createResults(effect);
            }

            return GameEffect.push(effect, GameEffect.create("NewDay", {
                act: act,
                day: day
            }, handler)).then(function() {
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

    static Frequency = new ScopedAttr("frequency", IntAttr);

    static _dayRng = ASRNG.newRng(NC.Seed, true, NC.Day);

    static acts = ["⛰️", "🔥","🌪️","💧"];
    static days = ["🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌕"];
    static EncounterFn = new ScopedAttr("encounter-fn", FunctionAttr);
    static InvokeFn = new ScopedAttr("assignment-invoke-fn", FunctionAttr);
    static NewDay = GameEffect.handle(function(handler, effect, params) {
         // Set our noise counters for dat sweet sweet RNGsus
        NoiseCounters.setCounter(NC.Day, ((params.act|0) << 4) + params.day);
        NoiseCounters.setCounter(NC.Unit, 0);
        NoiseCounters.setCounter(NC.Event, 0);

        var RNG = GameRules._dayRng;

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

        // Populate our rest-up assignment.
        TownScreen.addAssignment(townScreen, Assignment.FromBlueprint(townScreen, 'hangingout'));

        // Populate rumors.
        // (At some point this will come from NPCs.)
        var rumors = RunInfo.getRumors(effect);
        rumors.forEach(function(rumor) {
            TownScreen.addAssignment(townScreen, Assignment.FromRumor(rumor));
            rumor.remove();
        });

        // Populate visitors, but only one or two!
        var visitorDistribution = [0, 1, 1, 1, 1, 2, 2];
        var visitorCount = RNG.randomValueR(visitorDistribution);
        var visitorOptions = RunInfo.getVisitors(townScreen);
        var newVisitors = times(visitorCount).map(function() {
            var visitorsByWeight = visitorOptions.toObject(function(v, i) {
                return i;
            }, function(v, i) {
                return GameRules.Frequency.findGet(v) || 0;
            });

            return RNG.randomValueR(visitorOptions, visitorsByWeight);
        }).filter(function(elt) { return !!elt; });

        // Now that we know what visitors we're getting, return our old ones.
        TownScreen.getVisitors(townScreen).forEach(function(visitor) {
            Visitor.leaveTown(visitor, RNG);
            RunInfo.addVisitor(effect, visitor);
        });

        visitorOptions.forEach(function(visitor) {
            Visitor.skipTown(visitor, RNG);
        });

        newVisitors.forEach(function(visitor) {
            Visitor.joinTown(visitor, RNG);
            TownScreen.addVisitor(townScreen, visitor);            
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
     *      encounters: [Assignment elt]
     * }
     */
     static Victory = new ScopedAttr("victory", BoolAttr);
     static Ignored = new ScopedAttr("ignored", BoolAttr);
     static Blueprint = new ScopedAttr("blueprint", StringAttr);
     static ExecuteDay = GameEffect.handle(function(handler, effect, params) {
        var encounters = params.encounters;
        var toRun = encounters.clone();

        var dayFn = function() {
            if (toRun.length == 0) {
                // End the day.  Good job!
                return GameEffect.createResults(effect);
            }

            var toInvoke = toRun.shift();
            TownScreen.Selected.set(toInvoke, true);

            if (Assignment.GetAssignedCards(toInvoke).length == 0) {
                // This one is ignored.  TODO: Add custom ignore functions.
                GameRules.ProcessResults(toInvoke, {
                    ignored: true
                });
                TownScreen.Selected.set(toInvoke, false);
                return Promise.resolve().then(dayFn);
            }

            var invokeFn = GameRules.InvokeFn.findDown(toInvoke);
            if (!invokeFn) {
                // Look up our default.
                var base = Utils.bfind(handler, 'body', 'default-assignment');
                invokeFn = GameRules.InvokeFn.findDown(base);
            }
            return GameRules.InvokeFn.invoke(invokeFn, toInvoke).then(function(result) {
                GameRules.ProcessResults(toInvoke, result);
                TownScreen.Selected.set(toInvoke, false);
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
            GameEffect.setResult(effect);

            // Now that we're done executing our day, we should move all our shit back.
            encounters.forEach(function(assignment) {
                // Move units back to where they belong.
                Assignment.GetAssignedCards(assignment).forEach(function(card) {
                    RunInfo.addUnit(handler, card);
                });

                if (Assignment.IsResolved(assignment)) {
                    assignment.remove();
                };
            });
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
    static Name = new ScopedAttr("name", StringAttr);
    static Namespace = new ScopedAttr("namespace", StringAttr);
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
        var blueprintHolder = qs(eventScreen, 'blueprint');
        Utils.moveChildren(blueprint.cloneNode(true), blueprintHolder);
        // Normalize the blueprint.
        Blueprint.normalizeAll(townScreen, blueprintHolder, 'encounter');
        // Copy the name, if there is one.
        if (GameRules.Name.has(blueprint)) {
            GameRules.Namespace.set(blueprintHolder, GameRules.Name.get(blueprint));
        }


        // Move units in.
        var unitHolder = qs(eventScreen, 'units');
        Assignment.GetAssignedCards(assignment).forEach(function(unit) {
            unitHolder.appendChild(unit);
        });

        // Update the deck by cloning copies in.
        var deckHolder = qs(eventScreen, 'deck');
        RunInfo.getDeck(townScreen).forEach(function(card) {
            deckHolder.appendChild(Card.WrapInCard(card.cloneNode(true)));
        });

        Screen.showScreen(townScreen, eventScreen);

        return GameEffect.push(queue, GameEffect.create("Event", {
            eventScreen: eventScreen
        })).then(function(result) {
            // Then move the units back.
            a(unitHolder.children).forEach(function(unit) {
                Assignment.AddUnit(assignment, unit);
            });

            // Lastly, process our new results.
            var results = qsa(eventScreen, 'results > result');
            Assignment.AddResults(assignment, results);

            // Now destroy the event screen;
            Screen.showScreen(eventScreen, townScreen);
            eventScreen.remove();

            return {
                victory: result.victory
            };
        });
    }
}
WoofRootController.register(GameRules);