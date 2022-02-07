

class EncounterGenerator {

    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Event, NC.Encounter);

    static Count = new ScopedAttr("count", IntAttr);
    static Name = new ScopedAttr("name", StringAttr);
    static Location = new ScopedAttr("location", ListAttr);
    static LocationFn = new ScopedAttr("location-fn", FunctionAttr);
    static PreferredSpawn = new ScopedAttr("preferred-spawn", ListAttr);
    static generate(encounter, encounterBp, defs) {
        // Find our defaults first.
        var defaultEncounter = Utils.bfind(encounter, 'body', 'default-encounter');

        var bfBp = Blueprint.find(encounterBp, 'battlefield');
        // Generate our battlefield.
        Battlefields.Generate(encounter, bfBp);

        // Either call our custom function or spawn according to our blueprint.
        var encounterBpElt = EncounterRules.EncounterFn.findDown(encounterBp);
        if (encounterBpElt) {
            EncounterRules.EncounterFn.findInvoke(encounterBpElt, encounter, encounterBpElt);
        } else {

            // Okay, here's where it gets John Madden.
            // Place all of our units, being sure to filter as needed.
            qsa(encounterBp, ':scope > place-units').filter(DefHelper.filterFor(defs)).forEach(function(placeUnitsElt) {
                EncounterGenerator.placeUnits(placeUnitsElt, encounter, defs);
            });            
        }

        // First, let's look for end-condition elements.
        var endConditions = qsa(encounterBp, 'end-condition');
        if (endConditions.length == 0) {
            endConditions = qsa(defaultEncounter, 'end-condition');
        }
        var container = WoofType.findDown(encounter, 'EndConditions');
        endConditions.forEach(elt => container.appendChild(elt.cloneNode(true)));


        // Next up, we look for things in our blueprint, and if they're not there, we copy them over from the default.
        // Add our end conditions.
        /*
        var endConditionElt = EncounterRules.EndConditions.find(encounterBp);
        if (!endConditionElt) {
            endConditionElt = EncounterRules.EndConditions.find(defaultEncounter);
            encounterBp.appendChild(endConditionElt.cloneNode(true));
        }
        */

        var maxPlayerUnitElt = EncounterRules.MaxPlayerUnits.findDown(encounterBp);
        if (!maxPlayerUnitElt) {
            maxPlayerUnitElt = EncounterRules.MaxPlayerUnits.findDown(defaultEncounter);
            encounterBp.appendChild(maxPlayerUnitElt.cloneNode(true));
        }

        var initOrderElt = EncounterRules.InitiativeOrder.find(encounterBp);
        if (!initOrderElt) {
            initOrderElt = EncounterRules.InitiativeOrder.find(defaultEncounter);
            encounterBp.appendChild(initOrderElt.cloneNode(true));
        }

        /** Set up the additional deck stuff here */
        qsa(encounterBp, 'bonus-cards').filter(DefHelper.filterFor(defs)).forEach(function(blob) {
            var cards = Blueprint.findAll(blob, 'preparation').map(function(p) {
                return Preparation.inflate(p);
            }).extend(Blueprint.findAll(blob, 'tactic').map(function(t) {
                return Tactic.inflate(t);
            }));
            cards = cards.map(function(c) {
                c = Card.WrapInCard(c);
                Card.Ephemeral.set(c, true);
                return c;
            });
            CardHud.populateDrawPile(encounter, cards);
        });
    }

    static placeUnits(placeUnitsElt, encounter, opt_defs) {
        var defs = opt_defs || {};

        var options = qsa(placeUnitsElt, 'from-unit-gen').filter(DefHelper.filterFor(defs));
        if (options.length == 0) return;
        var toGen = [];

        // Decide which ones.
        if (!EncounterGenerator.Count.has(placeUnitsElt)) {
            toGen = options;
        } else {
            var count = EncounterGenerator.Count.get(placeUnitsElt);
            while (toGen.length < count) {
                toGen.push(EncounterGenerator._rng.randomValue(options));
            }
        }

        // Actually do unit gen here.
        var candidateLocations = [];
        if (EncounterGenerator.LocationFn.has(placeUnitsElt)) {
            candidateLocations = EncounterGenerator.LocationFn.invoke(placeUnitsElt, encounter, placeUnitsElt);
        } else {
            candidateLocations = EncounterGenerator.LocationsByLabel(encounter, placeUnitsElt);
        }
        candidateLocations = candidateLocations.filter(function(cell) {
            return !BattlefieldHandler.unitAt(encounter, UberCoord.extract(cell));
        });

        toGen.forEach(function(genMe) {
            if (candidateLocations.length == 0) return;
            var unit = UnitGenerator.generate(EncounterGenerator.Name.get(genMe));
            var preferredSpawn = (EncounterGenerator.PreferredSpawn.get(unit) || []);
            var spawnLocation = null;
            if (preferredSpawn.length > 0) {
                var primoSpawn = candidateLocations.filter(function(cell) {
                    var effective = Grid.getEffectiveTile(cell);
                    return preferredSpawn.includes(effective);
                });
                if (primoSpawn.length > 0) {
                    spawnLocation = EncounterGenerator._rng.randomValueR(primoSpawn);
                    candidateLocations.splice(candidateLocations.indexOf(location), 1);
                }
            }
            if (spawnLocation == null) {
                spawnLocation = EncounterGenerator._rng.randomValueR(candidateLocations);
            }
            var uberCoord = UberCoord.extract(spawnLocation);
            BattlefieldHandler.addUnitTo(encounter, unit, UberCoord.big(uberCoord), UberCoord.small(uberCoord));            
        });
    }

    // General Helpers
    static LocationsByLabel(encounter, placeUnitsElt) {
        return EncounterGenerator.Location.get(placeUnitsElt).flatMap(function(label) {
            var byContext = Grid.expandContextualLabel(encounter, label);
            if (byContext !== null) {
                return byContext;
            }
            return [CellBlock.findByLabel(encounter, label)].flatMap(block => Cell.findAllInBlock(block));  
        });
    }

    static Teams = new ScopedAttr("teams", ListAttr);
    static LocationsByTeam(encounter, placeUnitsElt) {
        return EncounterGenerator.Teams.get(placeUnitsElt).flatMap(team => CellBlock.findAllByTeam(encounter, team))
                .filter(block => !DisabledAttr.get(block))
                .flatMap(block => Cell.findAllInBlock(block));

    }
}
WoofRootController.register(EncounterGenerator);



class ActionMode {
    static Disabled = '';
    static Go = "go";
    static GiveUp = "giveup";
    static Cancel = "cancel";
    static Stop = "stop";
    static Pending = "pending";
}
WoofRootController.addListeners(Utils.constantValues(ActionMode));

class EncounterRules {

    static setDefaultFacingOnBlock(block, opt_allBlocks) {        
        var blocks = opt_allBlocks;
        if (!blocks) {
            blocks = CellBlock.findAll(BattlefieldHandler.find(block)).filter(function(block) {
                return !DisabledAttr.get(block);
            });
        }
        var priorityTargetMap = Teams.allTeams().expandToObject(Teams.opposed);
        var team = TeamAttr.get(block);
        if (!team) throw boom("All non-disabled blocks should have a team.");
        var opposed = Teams.opposed(team);
        var thisCoord = BigCoord.extract(block);

        // For each block, we prioritize the nearest block that has enemies in it,
        // unless it's already pointing at an adjacent block with enemies in it.
        var facing = FacingAttr.get(block);
        var coord = BigCoord.extract(block);
        if (!!facing && facing != FacingAttr.None) {
            // We already have a facing.  Let's make sure we don't need to update it and if we
            // do, update it.
            var target = CellBlock.findFacing(block, facing);
            // Quick check: See if we're pointing at enemies.
            if (!!target) {
                // If our target block has enemies in it, we're already pointed in a helpful direction.
                if (opposed.flatMap(t => Unit.findTeamInBlock(target, t)).length > 0) {
                    return;
                }

                // If we don't have any enemies, do any others immediately us have enemies?  If so, prioritise that one.
                var newTarget = FacingAttr.allDirections().map(dir => CellBlock.findFacing(block, dir)).filter(block => !!block).filter(function(b) {
                    // Only blocks that have enemies in them.
                    return opposed.flatMap(t => Unit.findTeamInBlock(b, t)).length > 0;
                }).sort(function(a, b) {
                    return opposed.flatMap(t => Unit.findTeamInBlock(a, t)).length - opposed.flatMap(t => Unit.findTeamInBlock(b, t)).length;
                })[0];
                if (newTarget) {
                    var direction = FacingAttr.fromTo(coord, BigCoord.extract(newTarget));

                    // We found our new target.
                    FacingAttr.set(block, direction);
                    return;
                }
                if (opposed.includes(TeamAttr.get(target))) {
                    // Already pointing towards a baddie.  Good enough to skip.
                    return;
                }
            }
        }

        // We are not facing a direction, or we need to change direction.
        // We will basically find the set of closest enemy blocks, then prioritize
        // them by whichever has the most enemies, and point that way (ish).
        var newTarget = blocks.filter(b => Teams.opposed(team).includes(TeamAttr.get(b)))
                .sort(function(a, b) {
                    var aD = BigCoord.distance(coord, BigCoord.extract(a));
                    var bD = BigCoord.distance(coord, BigCoord.extract(a));
                    if (aD != bD) {
                        // Prioritize closest enemy-aligned block.
                        return aD - bD;
                    }
                    // For equal distances, prioritize the one with the most enemies.
                    var aC = opposed.flatMap(t => Unit.findTeamInBlock(a, t)).length;
                    var bC = opposed.flatMap(t => Unit.findTeamInBlock(b, t)).length;
                    return bC - aC;
                })[0];
        if (!newTarget && facing == FacingAttr.None) {
            // We should definitely pick something, so by default we point to a block.
            newTarget = FacingAttr.allDirections().map(dir => CellBlock.findFacing(block, dir)).filter(block => !!block)[0];
        }        
        // We need to clamp this direction.        
        var direction = FacingAttr.fromToWithEstimate(coord, BigCoord.extract(newTarget));
        FacingAttr.set(block, direction);

    }

    // Sets the default facing direction of a block if it's not already set.
    static setDefaultFacing(encounter) {
        var blocks = CellBlock.findAll(encounter).filter(function(block) {
            return !DisabledAttr.get(block);
        });
        blocks.forEach(function(block) {
            // Skip if it's already set.
            if (FacingAttr.get(block)) return;
            EncounterRules.setDefaultFacingOnBlock(block, blocks);
        });
    }

    static EndFn = new ScopedAttr("end-fn", FunctionAttr);
    static GetEncounterResult(encounter) {
        var endConditionContainer = WoofType.find(encounter, 'EndConditions');
        var conditionElts = EncounterRules.EndFn.findAll(endConditionContainer);
        return conditionElts.map(function(elt) {
            return EncounterRules.EndFn.invoke(elt, elt, encounter);
        }).findFirst(function(result) {
            return !!result;
        });
    }

    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Event, NC.Encounter);
    static Battlefield = new ScopedAttr("battlefield", StringAttr);
    static EncounterFn = new ScopedAttr("encounter-fn", FunctionAttr);
    static EndConditions = new ScopedAttr("end-condition-fns", ListAttr);
    static MaxPlayerUnits = new ScopedAttr("max-player-units", IntAttr);
    static InitiativeOrder = new ScopedAttr('initiative-order', ListAttr);
    static For = new ScopedAttr('for', StringAttr);

    /**
     * Populates the screen.
     * {
     *   encounter: fn for creating the battlefield.
     *   encounterBp: <encounter-blueprint>
     *   deck: The element that houses cards that are going into and leaving this combat.
     *   defs: Object blob representing our parent defs. Used to plumb to the generator.
     * }
     */
    static Encounter = GameEffect.handle(function(handler, effect, params) {

        // TODO: Try to get most of this screen management shit into the LaunchEncounter handler in GameRules
        var encounter = EncounterScreenHandler.inflate({});
        var parentScreen = params.container;
        Screen.showScreen(parentScreen, encounter);

        // Copy over our blueprint.
        var bpHolder = WoofType.findDown(encounter, "EncounterBP");
        var encounterBp = params.encounterBp.cloneNode(true);
        bpHolder.appendChild(encounterBp)

        // Inflate child widgets.
        var battlefield = BattlefieldHandler.inflateIn(EncounterScreenHandler.findBattlefieldContainer(encounter));
        var cardHud = CardHud.find(encounter);
        CardHud.inflateIn(cardHud, []);
        CardHud.setDrawCost(cardHud, 1);

        var cards = Array.from(params.deck.children);
        CardHud.populateDrawPile(cardHud, cards);

        // Generate the encounter according to the blueprint.
        EncounterGenerator.generate(encounter, encounterBp, params.defs || {});

        // Install our combat script, if we have one.
        var combatScript = qs(encounterBp, 'combat-script');
        if (combatScript) {
            var handlerSet = Templates.inflate('handler-set');
            EncounterRules.For.set(handlerSet, WoofType.buildSelectorFor(encounter));
            Utils.moveChildren(combatScript.cloneNode(true), handlerSet);
            var container = EffectQueue.getHandlerContainer(encounter);
            container.appendChild(handlerSet);
        }

        // Update initial facing.
        EncounterRules.setDefaultFacing(encounter);

        // Find our units.
        var unitsToDraw = CardHud.drawPileCards(encounter).filter(function(card) {
            return Card.CardType.findGet(card) === 'unit';
        });

        // Next up, try to determine the overall facing.
        var blocks = CellBlock.findAllByTeam(battlefield, Teams.Player);
        var direction = FacingAttr.get(blocks[0]);
        FacingAttr.set(encounter, direction);

        CellBlock.findAll(encounter).forEach(Grid.ResetEffectivePositions);

        // Next up, we want to draw our first 5 cards.
        var toDraw = 6;
        var drawFn = function(result) {
            if (toDraw < 1) {
                return;
            }
            toDraw--;
            if (unitsToDraw.length > 0) {
                return GameEffect.push(effect, GameEffect.create("DrawCard", {
                    card: EncounterRules._rng.randomValueR(unitsToDraw)
                })).then(drawFn);
            }
            return GameEffect.push(effect, GameEffect.create("DrawCard", {
                from: 'random'
            })).then(drawFn);
        };

        // Next up, we want to loop until our end condition is met.
        var roundCounter = 1;
        var checkFn = function(result) {
            if (result && result.giveUp) {
                // Womp womp.  Do something here.
                return {
                    win: false,
                    result: "giveUp"
                };
            }
            var result = EncounterRules.GetEncounterResult(encounter);
            if (result) {
                return result;
            }

            return GameEffect.push(effect, GameEffect.create("Round", {
                round: roundCounter++
            }, handler)).then(checkFn);
        };

        return Promise.resolve(drawFn()).then(checkFn).then(function(winOrLoss) {
            // Disable the action button.
            ActionButton.setMode(handler, ActionMode.Disabled);

            // Get rid of any combat script we might have.
            var container = EffectQueue.getHandlerContainer(encounter);
            var script = EncounterRules.For.find(container, WoofType.buildSelectorFor(encounter));
            if (script) script.remove();

            // Cleanup here.  First, retreat all our units.
            var units = Array.from(Unit.findAllByTeam(battlefield, Teams.Player));

            // Cleanup here.  We want to return our cards.
            var cards = CardHud.allCards(cardHud);
            units.forEach(function(unit) {
                if (Unit.Ephemeral.get(unit)) return; // Skip ephemeral units.

                Unit.retreat(unit);
                BattlefieldHandler.resetUnit(unit);        
                var card = Card.inflate(Utils.UUID());
                card.appendChild(unit);
                cards.push(card);
            });

            // Clean up our preparations.
            cards.forEach(function(card) {
                if (Preparation.findDown(card)) {
                    Preparation.resetUses(card);
                }

                params.deck.appendChild(card);
            });

            return GameEffect.createResults(effect, winOrLoss);            
        });
    });

    static EndOfEncounterBanner(handler, effect, params, result) {        
        switch (result.result) {
            case "victory":
                return "You win!";
            case "wipe":
                return "No-one returned...";
            case "giveUp":
                return "Retreat!"
        }
        // Fallback.
        return result.result.win ? "Victory!" : "Defeat!";
    }

    static DefaultWin(conditionElt, encounter) {
        if (qsa(encounter, "[team='enemy'][wt~='Unit'").length == 0) {
            return {
                success: true,
                result: "victory"
            };
        }
    }

    static DefaultWipe(conditionElt, encounter) {
        var battlefield = BattlefieldHandler.find(encounter);
        var playerUnits = qsa(battlefield, "[team='player'][wt~='Unit']:not([ephemeral='true'])");
        if (playerUnits.length > 0) return;
        if (qsa(encounter, ".card > .battlefield_unit").length == 0) {
            return {
                success: false,
                result: "wipe"
            };
        }
    }

    static Round = GameEffect.handle(function(handler, effect, params) {
        // We wait for the player to click buttons here.
        var encounter = EncounterScreenHandler.find(handler);

        return Promise.resolve().then(function() {
            // Write down our ticket info, basically.
            PendingOpAttr.storeTicketOn(encounter, effect);
            EncounterRules._adjustActionButton(handler);
            DisabledAttr.false(CardHud.find(handler));            
        });
    });

    static RoundCount(handler, effect, params) {
        return params.round;
    } 
    
    static _findPlayerUnits(handler) {
        var battlefield = BattlefieldHandler.find(handler);
        return Unit.findAll(battlefield).filter(function(unit) {
            return TeamAttr.get(unit) == Teams.Player;
        });
    }

    static _adjustActionButton(handler) {
        var encounter = EncounterScreenHandler.find(handler);
        var goodGuys = EncounterRules._findPlayerUnits(encounter);
        if (goodGuys.length == 0) {
            // Give up button.
            ActionButton.setMode(handler, ActionMode.GiveUp);
        } else {
            // Go button.
            ActionButton.setMode(handler, ActionMode.Go);
        }
    }

    static OnUnitsChanged(evt, handler) {
        var encounter = EncounterScreenHandler.find(handler);
        if (!EncounterRules.IsGo.get(encounter)) {
            EncounterRules._adjustActionButton(handler);
        }
    }

    static OnActionButtonPendingAction(evt, handler) {
        var existing = evt.detail.oldValue;
        var updated = evt.detail.newValue;

        if (existing) {
            TargetPicker.cancel(handler, existing);
        }

        if (!updated) {
            EncounterRules._adjustActionButton(handler);
        } else {
            ActionButton.setMode(handler, ActionMode.Cancel);
        }    
    }

    static OnGiveUp(evt, handler) {
        var encounter = EncounterScreenHandler.find(handler);
        var effect = PendingOpAttr.getPendingEffect(encounter);
        GameEffect.setResult(effect, {
            giveUp: true
        });
        PendingOpAttr.returnTicketOn(encounter);
    }

    static IsGo = new ScopedAttr("is-go", BoolAttr);
    static OnGo(evt, handler) {
        // We want to start the round.
        // UI Bookkeeping.
        CardHud.unselectCards(handler);
        DisabledAttr.true(CardHud.find(handler));
        ActionButton.setMode(handler, ActionMode.Stop);

        // Game effect queue:
        var encounter = EncounterScreenHandler.find(handler);
        var effect = PendingOpAttr.getPendingEffect(encounter);

        EncounterRules.IsGo.set(encounter, true);
        GameEffect.push(effect, GameEffect.create("PlayRound", {
            minimumVolleys: 8
        })).then(function() {
            GameEffect.setResult(effect);
            EncounterRules.IsGo.set(encounter, false);
            PendingOpAttr.returnTicketOn(encounter);
        });
    }

    static IsStop = new ScopedAttr("is-stop", BoolAttr);
    static OnStop(evt, handler) {
        // We requested a pause.
        var encounter = EncounterScreenHandler.find(handler);
        EncounterRules.IsStop.set(encounter, true);
        var actionButton = ActionButton.find(handler)
        ActionButton.setMode(actionButton, ActionMode.Pending);
        var minVolleysLeft = VolleyCounter.minVolleysLeft(handler); 
        if (minVolleysLeft == 0 && !!PendingOpAttr.getPendingEffect(actionButton)) {
            PendingOpAttr.returnTicketOn(ActionButton.find(handler));
        }
    }

    static PendingAction = new ScopedAttr('pending-action', StringAttr);
    static OnGhostUnitClick(event, handler) {
        var battlefield = BattlefieldHandler.find(handler);
        var unit = Unit.findUp(event.target);
        // If this is an active target, we don't want to prioritize this thingie.
        if (WoofType.has(unit, "Target")) return;

        var id = IdAttr.generate(unit) + "ghostmove";
        var existing = ActionButton.setPendingAction(battlefield, id);
        if (existing) {
            TargetPicker.cancel(battlefield, existing);
        }
        ActionButton.setMode(handler, ActionMode.Cancel);

        CardHud.unselectCards(handler);

        var unitPrefs = Unit.getPreferredLocations(unit);
        var root = BattlefieldHandler.findGridContainer(battlefield);

        // TODO: This is copy/pasted between here and UnitRules.  Figure out a better
        // home for some of this logic.
        return TargetPicker.standardPickTarget(battlefield, id,
                function() {
                    // Check total player capacity first.
                    var blocks = CellBlock.findAllByTeam(root, Teams.Player).filter(function(block) {
                        // Filter out blocks that can't hold all these limes.
                        if (!EncounterRules.MaxPlayerUnits.has(block)) return true;
                        return Unit.findTeamInBlock(block, Teams.Player).map(Unit.capacitySize).merge(sumMerge) < EncounterRules.MaxPlayerUnits.get(block);
                    });

                    // For each of these blocks, return cells that are actually empty.
                    return blocks.map(Cell.findAllInBlock).flat().filter(function(cell) {
                        var coord = UberCoord.extract(cell);
                        return !BattlefieldHandler.unitAt(battlefield, coord);
                    }).extend([unit]);
                },
                function(elt) {
                    return WoofType.has(elt, 'Cell') && unitPrefs.contains(Grid.getEffectiveTile(elt));
                }).then(function(target) {
                    if (target) {
                        if (target == unit) {
                            WoofType.remove(unit, "GhostUnit");
                        } else {
                            SmallCoord.write(unit, SmallCoord.extract(target));
                        }
                    }
                    ActionButton.clearPendingActionIf(battlefield, id);        
                });
    }

    static CheckAndTriggerEnd(elt) {
        var encounter = EncounterScreenHandler.find(elt);
        var result = EncounterRules.GetEncounterResult(encounter);
        if (result) {
            // Neat!  We want to call it here.  End the round!
            var effect = PendingOpAttr.getPendingEffect(encounter);            
            GameEffect.setResult(effect);
            PendingOpAttr.returnTicketOn(encounter);
        }
    }

    static BlockAfterVolleyIfPaused = GameEffect.handle(function(handler, effect, params) {
        var encounter = EncounterScreenHandler.find(handler);
        var paused = VolleyCounter.IsPaused(encounter);

        // Don't bother pausing if we have no good guys left.s
        var goodGuys = EncounterRules._findPlayerUnits(encounter);
        if (goodGuys.length == 0) {
            return;
        }

        if (paused) {
            // We are paused, so we want to block.
            var actionButton = ActionButton.find(handler);
            PendingOpAttr.storeTicketOn(actionButton, effect, "PauseBlock");            
            VolleyCounter.ShowStepButton(handler);
        }
    });

    static OnStep(event, handler) {
        var actionButton = ActionButton.find(handler);
        PendingOpAttr.returnTicketOn(actionButton);
    }

    static OnResume(event, handler) {        
        var encounter = EncounterScreenHandler.find(handler);
        var actionButton = ActionButton.find(encounter);
        var paused = VolleyCounter.IsPaused(encounter);
        if (!paused && !!PendingOpAttr.getPendingEffect(actionButton)) {
            PendingOpAttr.returnTicketOn(actionButton);
        }
    }

    static RemoveStopBeforeRound = GameEffect.handle(function(handler, effect, params) {
        var encounter = EncounterScreenHandler.find(handler);
        EncounterRules.IsStop.set(encounter); 
    });

    static OnCancel(evt, handler) {
        // Unselect cards.
        CardHud.unselectCards(handler);

        // Clear any other action.
        var pending = ActionButton.getPendingAction(handler);
        if (pending) {
            TargetPicker.cancel(handler, pending);
            ActionButton.setPendingAction(handler);
        }
        EncounterRules._adjustActionButton(handler);
    }
}
WoofRootController.register(EncounterRules);
WoofRootController.addListeners('NewUnit');

class RoundRules {

    /**
     * Handler for a new round game effect.  Basically we have volleys until:
     * - The minimum number of volleys has occurred
     * - AND
     * - The player has hit pause
     * - OR
     * - The end-of-combat condition has occurred.
     * {
     *   minimumVolleys: int - The minimum number of volleys before the player can pause.
     * }
     */
    static PlayRound = GameEffect.handle(function(handler, effect, params) {
        var encounter = EncounterScreenHandler.find(handler);

        var battlefield = BattlefieldHandler.find(effect);
        var roundPanel = RoundPanel.find(handler);
        var results = [];

        var baseFn = function() {
            // Clean up ghost units.
            WoofType.findAll(battlefield, "GhostUnit").forEach(function(unit) {
                WoofType.remove(unit, "GhostUnit");
            })

            // Short-circuit if the combat is over.
            var result = EncounterRules.GetEncounterResult(encounter);
            if (result) {
                return GameEffect.createResults(effect);                
            }

            var minVolleysLeft = VolleyCounter.minVolleysLeft(handler);            
            var goodGuys = EncounterRules._findPlayerUnits(encounter);
            if (goodGuys.length == 0) {
                return GameEffect.createResults(effect);                    
            }

            if (minVolleysLeft <= 0 && EncounterRules.IsStop.get(encounter)) {
                return GameEffect.createResults(effect);
            }

            return Promise.resolve().then(function() {
                return GameEffect.push(effect, GameEffect.create("Volley", {
                    volleyCount: null
                }, handler)).then(baseFn);    
            });
        };

        return Promise.resolve().then(baseFn);
    });


    static _findActiveAbilitiesInBlock = function(block, team) {

        var battlefield = BattlefieldHandler.find(block);
        var bigCoord = BigCoord.selector(BigCoord.extract(block));
        var abilitySelector = Ability.CurrentCooldown.selector(1);
        var teamSelector = TeamAttr.buildSelector(team);

        return qsa(battlefield, teamSelector + bigCoord + " .ability" + abilitySelector).map(function(elt) {
            return Ability.find(elt);
        }).filter(function(a) {
            return Ability.shouldTriggerSkill(a, Unit.findUp(a));
        });
    }

    static updateBlockFacing(battlefield) {
        // Adjust overall unit facing.
        var blocks = CellBlock.findAll(battlefield).filter(block => !DisabledAttr.get(block));
        var toAdjust = [];

        blocks.forEach(block => {
            EncounterRules.setDefaultFacingOnBlock(block, blocks);
        });
    }

    /**
     * After volleys.
     */
     static TickCooldowns = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var cooldowns = Ability.CooldownDuration.findAll(battlefield);
        var toCheck = [];
        cooldowns.forEach(function(elt) {
            var ability = Ability.findUp(elt);
            var current = Ability.CurrentCooldown.get(elt);
            if (Unit.Used.get(ability) || (Unit.Inactive.get(ability) && current <= 1)) {
                Ability.CurrentCooldown.findSetAll(ability, Ability.CooldownDuration.get(elt));
                Unit.Used.set(ability, false);
                toCheck.push([ability, elt]);
            } else {
                if (Ability.CurrentCooldown.get(elt) > 1) {
                    Ability.CurrentCooldown.set(elt, Ability.CurrentCooldown.get(elt) - 1);
                }
            }
        });

        // For any that got tweaked, let's reset.
        toCheck.forEach(function(a) {
            var unit = Unit.findUp(a[0]);

            Ability.findAll(unit).sort(function(a, b) {
                return (Ability.CurrentCooldown.findGet(a) - Ability.CurrentCooldown.findGet(b)) || (Ability.VolleyCount.findGet(a) - Ability.VolleyCount.findGet(b));
            }).forEach(function(a) {
                a.parentNode.appendChild(a);
            });
        });
    });

    /**
     * {
     * 
     * }
     */
    static Volley = GameEffect.handle(function(handler, effect, params) {

        var encounter = EncounterScreenHandler.find(handler);
        var battlefield = BattlefieldHandler.find(handler);

        var teamOrder = EncounterRules.InitiativeOrder.findGet(encounter); 
        var blocks = Array.from(CellBlock.findAll(battlefield)).sort(function(a, b) {
            if (!!DisabledAttr.get(a) !== !!DisabledAttr.get(b)) {
                if (DisabledAttr.get(a)) return 1;
                return -1;
            }

            var aTeam = TeamAttr.get(a);
            var bTeam = TeamAttr.get(b);
            var aDisabled = DisabledAttr.get(a) ? 1 : -1;
            var bDisabled = DisabledAttr.get(b) ? 1 : -1;
            return (teamOrder.indexOf(aTeam) - teamOrder.indexOf(bTeam)) || // Team order is most important.
                    (aDisabled - bDisabled) || // Disabled blocks usually go last.
                    (BigXAttr.get(a) - BigXAttr.get(b)) || (BigYAttr.get(a) - BigYAttr.get(b)); // Position is tiebreaker.
        });

        // Just run through them in this order.
        var activations = teamOrder.map(function(team) {
            return blocks.map(function(block) {
                return {
                    team: team,
                    block: block
                };
            });
        }).flat();
    
        return Promise.resolve().then(function() {
            // First, update which way units are facing so we don't waste volleys.
            RoundRules.updateBlockFacing(battlefield);
        }).then(function() {
            // Draw cards, if relevant;
            if(params.volleyCount % 8 == 0) {
                return GameEffect.push(effect, GameEffect.create("DrawCard", {}), handler);
            }
        }).then(function() {
            // Run through actions or whatever.
            var baseFn = function(success) {
                var activation = null;
                while (activation == null && activations.length > 0) {
                    var candidate = activations.shift();
                    var activeAbilities = RoundRules._findActiveAbilitiesInBlock(candidate.block, candidate.team);
                    if (activeAbilities.length == 0) continue;
                    activation = {
                        team: candidate.team,
                        block: candidate.block,
                        abilities: activeAbilities
                    };
                }
                if (!activation) {
                    // Terminate: Nobody needs to act!
                    return;
                }

                return GameEffect.push(effect, GameEffect.create("BlockActivation", {
                    abilities: activation.abilities
                }, handler)).then(baseFn.bind(this, true), baseFn.bind(this, false));
            };

            return Promise.resolve(baseFn()).then(function() {
                return GameEffect.createResults(effect);
            });
        }).then(function(results) {
            // Update this after the volley as well so when players start a round, their
            // unit is pointing in a non-stupid direction.
            RoundRules.updateBlockFacing(battlefield);
            return results;
        });  
    });


    /**
     * Purpose: For a given block of units' active abilities, arrange them into
     * combo groups and invoke ActivateGroup.
     * {
     *   abilities: [ability refs that have the potential to combo together]
     * }
     */
    static BlockActivation = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var foundUnits = {};
        var activations = params.abilities.map(function(ability) {
            var unit = Unit.findUp(ability);
            var unitId = IdAttr.generate(unit);
            // Ensure each unit only acts once per activation.
            if (foundUnits[unitId]) return null;
            foundUnits[unitId] = true;
            return {
                ability: ability,
                unit: unit
            };
        }).filter(function(a) {
            return !!a;
        });

        var unitsToAct = Array.from(activations);

        var applyFn = function() {
            if (unitsToAct.length == 0) {
                // No units?  Bail out.
                return;
            }

            // Figure out the largest group that can combo within our
            // set.
            var largestGroup = [];
            unitsToAct.forEach(function(blorb) {
                var current = [blorb];
                var remaining = Array.from(activations).filter(function(b) {
                    return b != blorb;
                });
                var invalidated = [blorb];
                while (invalidated.length > 0) {
                    var checking = invalidated.shift();
                    for (var i = 0; i < remaining.length;) {
                        var b = remaining[i];
                        if (Unit.comboWith(checking.unit, b.unit)) {
                            current.push(b);
                            invalidated.push(b);
                            remaining.splice(i, 1);
                        } else {
                            i++;
                        }
                    }
                }
                if (current.length > largestGroup.length) {
                    largestGroup = current;
                }
            });

            // Remove these from our set of units to act.
            largestGroup.forEach(function(b) {
                unitsToAct.splice(unitsToAct.indexOf(b), 1);
            });


            return GameEffect.push(effect, GameEffect.create("ActivateGroup", {
                blorbs: largestGroup
            }, handler)).then(applyFn);
        };

        return Promise.resolve(applyFn()).then(function() {
            return GameEffect.createResults(effect);
        });
    });


    /**
     * Purpose: For a given group of comboing units, invokes the necessary
     * UseAbility events.
     * {
     *      blorbs: [{
     *         ability: ability ref,
     *         unit: unit ref
     *      }]
     * }
     */
    static ManaFn = new ScopedAttr('mana-fn', FunctionAttr);
    static ActivateGroup = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(effect);
        // Normalize our blorbs back to elements.
        var blorbs = params.blorbs;
        var toActivate = Array.from(blorbs);
        var activatedUnits = [];

        var applyFn = function() {
            if (toActivate.length == 0) {
                return;
            }

            var next = toActivate.shift();
            if (!Unit.onField(next.unit)) {
                // Skip this unit if they're no longer relevant.
                return applyFn();
            }
            var mana = Mana.noMana();

            var comboUnits = blorbs.filter(function(blorb) {                
                return blorb !== next && Unit.onField(blorb.unit);
            });

            blorbs.forEach(function(blorb) {
                // No benefit from the combo if the ability can't!
                if (!Ability.ReceivesCombo.get(next.ability)) return;
                if (blorb === next) return;
                if (!Unit.onField(blorb.unit)) return;
                if (!Ability.GivesCombo.get(blorb.ability)) return;
                // TODO: Check if abilities can combo.
                // We skip the unit check here because we want to allow "bridge" units
                // that allow a larger group to combo.
                var abilityMana = RoundRules.ManaFn.find(blorb.ability);
                var unitMana = RoundRules.ManaFn.find(blorb.unit);
                if (abilityMana) {
                    mana = Mana.plus(mana, RoundRules.ManaFn.invoke(abilityMana, blorb.unit, blorb.ability));
                } else if (unitMana) {
                    mana = Mana.plus(mana, RoundRules.ManaFn.invoke(unitMana, blorb.unit, blorb.ability));
                }
            });
            
            return GameEffect.push(effect, GameEffect.create("UseAbility", {
                ability: next.ability,
                unit: next.unit,
                comboUnits: comboUnits,
                components: [{
                    unit: next.unit,
                    ability: next.ability
                }],
                mana: mana
            }, handler)).then(applyFn);
        };

        return Promise.resolve(applyFn()).then(function() {
            // Check for deaths.
            var deadFn = function() {
                var deadUnits = qsa(battlefield, "progress.hp_bar[value='0']");
                if (deadUnits.length == 0) {
                    return GameEffect.createResults(effect);
                }
    
                return GameEffect.push(effect, GameEffect.create("UnitDeath", {
                    unit: Unit.findUp(deadUnits[0])
                }, handler)).then(deadFn.bind(this, true), deadFn.bind(this, false));
            };
            return deadFn(true);
        }).then(function() {
            return GameEffect.createResults(effect, {
                activatedUnits: activatedUnits
            });
        });

    });

    static ActivateGroupHasCombo(handler, effect, params) {
        return params.blorbs.length > 1;
    }

    static ActivateGroupUnits(handler, effect, params) {
        return params.blorbs.filter(function(blorb) {
            return !!blorb.unit;
        }).map(function(blorb) {
            return blorb.unit;
        })
    }

    static ActivateGroupBanner(handler, effect, params) {
        // Normalize our blorbs back to elements.
        var banner = Templates.inflate('combo_banner');
        params.blorbs.forEach(function(b) {
            if (!!b.unit) {
                banner.appendChild(Unit.cloneAppearance(b.unit));
                banner.appendChild(effect.ownerDocument.createTextNode(Ability.Label.findGet(b.ability)));
            }
        });
        return banner;
    } 

}
WoofRootController.register(RoundRules);


class AbilityRules {

}
WoofRootController.register(AbilityRules);