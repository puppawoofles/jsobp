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
        var thisCoord = BigCoord.extract(block);

        // Sort blocks into canadidates by priority.
        var targetBlock = blocks.filter(function(a) {
            // Filter out same-team.
            return TeamAttr.get(a) != team;
        }).sort(function(a, b) {
            // Enemy teams are a higher priority than neutral teams.
            var aTeam = TeamAttr.get(a);
            var bTeam = TeamAttr.get(b);
            if (aTeam != bTeam) {
                var aTeamPriority = priorityTargetMap[team].includes(aTeam);
                var bTeamPriority = priorityTargetMap[team].includes(bTeam);
                if (aTeamPriority != bTeamPriority) {
                    if (aTeamPriority) return -1;
                    if (bTeamPriority) return 1;
                }
            }

            // Next up, proximity!!
            var aCoord = BigCoord.extract(a);
            var bCoord = BigCoord.extract(b);
            var aDiag = BigCoord.diagDistance(aCoord, thisCoord);
            var aDist = BigCoord.distance(aCoord, thisCoord);
            var bDiag = BigCoord.diagDistance(bCoord, thisCoord);
            var bDist = BigCoord.distance(bCoord, thisCoord);
            if (aDist != bDist) {
                // Ortho distance is the winner!
                return aDist - bDist;
            }
            // However, if they're equal, the LARGEST diag distance wins (straighter line, since equal ortho!)
            if (aDiag != bDiag) {
                return bDist - aDist;
            }

            // Next up, higher enemy counts.
            var aCount = priorityTargetMap[team].map(function(sTeam) {
                return Unit.findTeamInBlock(a, sTeam).length;
            }).merge(sumMerge);
            var bCount = priorityTargetMap[team].map(function(sTeam) {
                return Unit.findTeamInBlock(b, sTeam).length;
            }).merge(sumMerge);

            // Whichever one has more enemies is higher priority.
            if (aCount != bCount) {
                return bCount - aCount;
            }

            return 0;
        })[0];

        var delta = BigCoord.minus(BigCoord.extract(targetBlock), thisCoord);
        FacingAttr.set(block, BigCoord.directionsOf(delta)[0]);
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

    static GetEncounterResult(encounter) {
        var fns = EncounterRules.EndConditions.findGet(encounter);
        return fns.map(function(controller) {
            return WoofRootController.invokeController(controller, [encounter]);
        }).findFirst(function(result) {
            return !!result;
        });
    }

    static WinConditionFn = new ScopedAttr("win-condition-fn", FunctionAttr);
    static LoseConditionFn = new ScopedAttr("lose-condition-fn", FunctionAttr);
    static Battlefield = new ScopedAttr("battlefield", StringAttr);
    static EncounterFn = new ScopedAttr("encounter-fn", FunctionAttr);
    static EndConditions = new ScopedAttr("end-condition-fns", ListAttr);
    static MaxPlayerUnits = new ScopedAttr("max-player-units", IntAttr);

    /**
     * Populates the screen.
     * {
     *   encounter: fn for creating the battlefield.
     *   encounterBp: <encounter-blueprint>
     *   deck: The element that houses cards that are going into and leaving this combat.
     * }
     */
    static Encounter = GameEffect.handle(function(handler, effect, params) {

        // TODO: Try to get most of this screen management shit into the LaunchEncounter handler in GameRules
        var encounter = EncounterScreenHandler.inflate({});
        var parentScreen = params.container;
        Screen.showScreen(parentScreen, encounter);

        var defaultEncounter = Utils.bfind(handler, 'body', 'default-encounter');
        var endConditions = EncounterRules.EndConditions.findGet(defaultEncounter);
        var maxPlayerUnits = EncounterRules.MaxPlayerUnits.findGet(defaultEncounter);

        var battlefield = BattlefieldHandler.inflateIn(EncounterScreenHandler.findBattlefieldContainer(encounter));

        var encounterBp = params.encounterBp;

        var bfBp = Blueprint.find(encounterBp, 'battlefield');
        // Generate our battlefield.
        Battlefields.Generate(encounter, bfBp);
        // Spawn our enemies.
        var encounterBpElt = EncounterRules.EncounterFn.find(encounterBp);            

        EncounterRules.EncounterFn.findInvoke(encounterBpElt, encounter, encounterBpElt);

        // Update initial facing.
        EncounterRules.setDefaultFacing(encounter);

        // Find new end conditions.
        var newEndConditions = EncounterRules.EndConditions.findGet(encounterBp);
        endConditions.extend(newEndConditions);
        EncounterRules.EndConditions.set(encounter, endConditions);

        // Set max player unit count.
        maxPlayerUnits = EncounterRules.MaxPlayerUnits.findGet(encounterBp) || maxPlayerUnits;
        EncounterRules.MaxPlayerUnits.set(encounter, maxPlayerUnits);

        var teams = [Teams.Player, Teams.Enemy];
        InitiativeOrderAttr.put(encounter, teams);

        // TODO: Copy this deck over from somewher else.
        var cardHud = CardHud.find(encounter);
        CardHud.inflateIn(cardHud, []);

        var cards = Array.from(params.deck.children);

        // Extend with any encounter-specific bonus cards.
        cards.extend(qsa(encounterBp, 'bonus-cards').map(function(cardHolder) {
            return Blueprint.findAll(cardHolder, 'preparation').map(function(prep) {
                return Card.WrapInCard(Preparation.inflate(prep));
            }).extend(Blueprint.findAll(cardHolder, 'tactic').map(function(tactic) {
                return Card.WrapInCard(Tactic.inflate(tactic));
            })).map(function(card)  {
                Card.Ephemeral.set(card, true);
                return card;    
            });
        }).flat());

        // Put units at the top.
        cards.sort(function(a, b) {
            var aType = Card.CardType.findGet(a) == 'unit';
            var bType = Card.CardType.findGet(b) == 'unit';            
            if (aType == bType) {
                return 0;
            }
            if (aType) return -1;
            return 1;
        })
        var unitCount = cards.filter(function(card) {
            return Card.CardType.findGet(card) == 'unit';
        }).length;;

        CardHud.populateDrawPile(cardHud, cards);
        CardHud.setDrawCost(cardHud, 1);

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
            unitCount--;
            return GameEffect.push(effect, GameEffect.create("DrawCard", {
                from: unitCount >= 0 ? "top" : "random"
            }, handler)).then(drawFn);
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

                if (isElement(params.deck)) {
                    params.deck.appendChild(card);
                } else {
                    RunInfo.addToDeck(handler, card);
                }
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

    static DefaultWin(encounter) {
        if (qsa(encounter, "[team='enemy'][wt~='Unit'").length == 0) {
            return {
                success: true,
                result: "victory"
            };
        }
    }

    static DefaultWipe(encounter) {
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
            var blocks = CellBlock.findAll(battlefield);
            var toAdjust = [];

            for (var i = 0; i < blocks.length; i++) {
                var block = blocks[i];
                var inBlock = Unit.findAllInBlock(block);
                if (inBlock.length == 0) {
                    // Nobody in this one?  Leave it alone.
                    continue;
                }
                // Get the current team.
                var team = TeamAttr.get(block);

                // Get the current facing.
                var facing = CellBlock.findFacing(block);
                if (!facing) {
                    // No facing?  Needs to be adjusted.
                    toAdjust.push(block);
                    continue;
                }
                if (team == TeamAttr.get(facing)) {
                    // Currently facing allies.  Needs to be adjusted.
                    toAdjust.push(block);
                    continue;
                }
                var units = Unit.findAllInBlock(facing);
                if (units.length == 0) {
                    // Currently facing nobody.  Needs to be adjusted.
                    toAdjust.push(block);
                    continue;
                }
            }

            for (var i = 0; i < toAdjust.length; i++) {
                var block = toAdjust[i];
                var team = TeamAttr.get(block);
                var candidates = [FacingAttr.Up, FacingAttr.Down, FacingAttr.Left, FacingAttr.Right].map(function(dir) {
                    return [dir, CellBlock.findFacing(block, dir)];
                }).filter(function(b2) {
                    // Only ones that exist.
                    if (!b2[1]) {
                        return false;
                    }
                    // Only for ones that have a team.
                    if (!TeamAttr.has(b2[1])) {
                        return false;
                    }
                    // Only ones not for the same team.                        
                    if (TeamAttr.get(b2[1]) == team) {
                        return false;
                    }
                    return true;
                });
                if (candidates.length == 0) {
                    // No candidates?  No facing.
                    FacingAttr.set(block, FacingAttr.None);
                    continue;
                }
                candidates.sort(function(a, b) {
                    return Unit.findAllInBlock(b[1]).length - Unit.findAllInBlock(a[1]).length;
                });
                FacingAttr.set(block, candidates[0][0]);
            }
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
            if (current <= 1) {
                if (Unit.Used.get(ability) || Unit.Inactive.get(ability)) {
                    Ability.CurrentCooldown.findSetAll(ability, Ability.CooldownDuration.get(elt));
                    Unit.Used.set(ability, false);
                    toCheck.push([ability, elt]);
                }
            } else {
                Ability.CurrentCooldown.set(elt, Ability.CurrentCooldown.get(elt) - 1);
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

        var teamOrder = InitiativeOrderAttr.get(encounter);       
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