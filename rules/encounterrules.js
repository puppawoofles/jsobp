
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
    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Event, NC.Encounter);

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
        EncounterGen.gen(encounter, encounterBp, params.defs || {}, encounter);

        // Find our units.
        var unitsToDraw = CardHud.drawPileCards(encounter).filter(function(card) {
            return Card.CardType.findGet(card) === 'unit';
        });

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

    // Used for debugging.
    static Endless(conditionElt, encounter) {}

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

    /**
     * After volleys.
     */
     static TickCooldowns = GameEffect.handle(function(handler, effect, params) {
        var battlefield = BattlefieldHandler.find(handler);
        var slots = MoveSlot.findAll(battlefield);
        var toSort = [];
        slots.forEach(function(slot) {
            if (MoveSlot.Used.get(slot) || (MoveSlot.Inactive.get(slot) && MoveSlot.currentCooldown(slot) <= 1)) {
                // Reset cooldown.
                MoveSlot.resetCooldown(slot);
                MoveSlot.Used.set(slot, false);
                toSort.push(slot);
            } else {
                MoveSlot.tickCooldown(slot);
            }
        });
        
        IdAttr.unique(toSort.map(slot => Unit.findUp(slot))).forEach(u => Unit.sortBattleScript(u));
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

        // In a volley, in team order, we want to try to activate all units
        // who can go, in the largest groups we can (if there are any combos).

        // Find all units that haven't acted yet.
        return Promise.resolve().then(function() {
            if(params.volleyCount % 8 == 0) {
                return GameEffect.push(effect, GameEffect.create("DrawCard", {}), handler);
            }
        }).then(function() {
            // Find all units that have yet to act.
            var activateFn = function() {
                // First, refresh unit abilities.  This might be slow though. :(
                // TODO: Figure out if this is too inefficient.
                Unit.findAllWith(battlefield, Unit.Acted.buildAntiSelector(true)).forEach(function(unit) {
                    Move.findAll(unit).forEach(Move.isActive);
                });

                var cdReadyMap = MoveSlot.findAllUnitsWithReadySlot(battlefield).filter(u => !Unit.Acted.get(u)).groupBy(TeamAttr.get);

                // Next up, we want to find a group to activate based on the combos available to them.
                var toAct = null;
                teamOrder.findFirst(function(team) {
                    var units = cdReadyMap[team] || [];
                    if (units.length == 0) return false;

                    // Only keep units that have available targets for a move.
                    // TODO: This is where combos go!  For now, this is just acting once.
                    return !!units.findFirst(function(unit) {
                        var targets = MoveSlot.getReadyMovesWithTargets(unit);
                        if (targets.length == 0) return false;
                        // Pick the one at the top regardless for now.
                        // Who knows if this will ever change.
                        toAct = targets[0];
                        return true;
                    });
                });
                if (!toAct) {
                    // We found nobody that can act, so end of volley.
                    return GameEffect.createResults(effect);
                }

                // TODO: Choose targets more intelligently here somehow.
                // This should somehow be fueled by our strategy.  For now,
                // prioritize lowest current HP.
                var potentialTargets = toAct.targets.sort(function(a, b) {
                    return Unit.currentHP(a) - Unit.currentHP(b);
                });
                var users = toAct.usedBy.map(b => b.unit);
                var target;
                // Look for an ideal target (e.g. not bashing an untaunted barricade).
                var possibleTargets = potentialTargets.clone();
                while (!target && possibleTargets.length > 0) {
                    target = Move.resolveTarget(toAct.move, users, possibleTargets.shift(), true);
                }
                // Look for a backup target (e.g. bash a barricade if you must).
                possibleTargets = potentialTargets.clone();
                while (!target && possibleTargets.length > 0) {
                    target = Move.resolveTarget(toAct.move, users, possibleTargets.shift(), false);
                }

                return GameEffect.push(effect, GameEffect.create("UseMove", {
                    move: toAct.move,
                    usedBy: toAct.usedBy,
                    target: toAct.targets
                })).then(activateFn);
            };
            return Promise.resolve().then(activateFn);
        }).then(function(results) {
            // Reset state.
            Unit.Acted.findAll(battlefield, true).forEach(u => Unit.Acted.set(u, false));
            return results;
        });
    });

    static UseMove = GameEffect.handle(function(handler, effect, params) {
        return Move.invoke(params.move, params.usedBy, params.target[0]).then(function() {
            // Flag units as having used their things.
            params.usedBy.forEach(function(blob) {
                Unit.Acted.set(blob.unit, true);
                MoveSlot.Used.set(MoveSlot.findUp(blob.move), true);
                Move.refreshActive(blob.unit);
            });
            return GameEffect.createResults(effect);
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
}
WoofRootController.register(RoundRules);


class AbilityRules {

}
WoofRootController.register(AbilityRules);