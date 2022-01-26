
class CardRules {
    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Event, NC.Encounter, NC.Round);
    static CardTypeAttr = new ScopedAttr('card-type', StringAttr);
    static TargetFn = new ScopedAttr('target-fn', FunctionAttr);
    static InvokeFn = new ScopedAttr('invoke-fn', FunctionAttr);

    static OnDrawPileClick(event, handler) {        
        Logger.info("Draw pile click!");
        var hud = CardHud.find(handler);
        if (CardHud.Disabled.get(hud)) {
            // No dice, this is disabled.
            return;
        }
        var cost = CardHud.getDrawCost(hud);
        var currentGold = RunInfo.getCurrentGold(handler);
        if (cost > currentGold) {
            // No.  Maybe UI treatment.
            return;
        }

        RunInfo.setCurrentGold(handler, currentGold - cost);
        CardHud.setDrawCost(hud, Math.min(10, cost + 1));
        CardRules.drawCard(handler);
    }

    /**
     * {
     *   from: top | random | specific
     *   card: If specific, the card to draw.
     * }
     */
    static DrawCard = GameEffect.handle(function(handler, effect, params) {
        var cardHud = CardHud.find(handler);
        var handRules = HandRules.find(cardHud);
        var atMost = HandRules.AtMost.get(handRules);
        var from = params.from || "random";

        return Promise.resolve().then(function() {
            if (params.card) {
                CardHud.drawCard(cardHud, params.card);
            } else {
                if (!CardHud.drawCard(cardHud, from == 'random', CardRules._rng)) {
                    // Unable to draw.  That means we need to shuffle and try again.
                    return GameEffect.push(effect, GameEffect.create("ShuffleDiscard", {}, handler)).then(function() {
                        // Then try to draw again.
                        return GameEffect.createResults(effect, {
                            drawn: CardHud.drawCard(cardHud, from == 'random', CardRules._rng)
                        });                        
                    });
                }
            }
            return GameEffect.createResults(effect, {
                drawn: true
            });
        }).then(function(result) {
            // No draw?  No result.
            var delta = CardHud.handSize(cardHud) - atMost;
            if (!result.drawn || delta <= 0) return result;

            // We went over.  First, find the "oldest" cards.
            var toDiscard = [];
            var current = CardHud.firstCard(cardHud);
            while (delta-- > 0 && !!current) {
                toDiscard.push(current);
                current = current.nextSiblingElement;
            }

            if (toDiscard.length == 0) {
                // Bail early.
                return result;
            }

            return GameEffect.push(effect, GameEffect.create("DiscardCards", {
                cards: toDiscard
            }, handler)).then(function() {
                // Return the OG result.
                return result;
            });
        });
    });
    
    static drawCard(elt, params, effect) {
        if (!effect) {     
            var mainScreen = MainScreenHandler.find(elt);
            effect = EffectQueue.findCurrentQueue(mainScreen);
        }

        return GameEffect.push(effect, GameEffect.create("DrawCard", {}));
    }


    
    static RefillHand = GameEffect.handle(function(handler, effect, params) {
        var cardHud = CardHud.find(handler);
        var handRules = HandRules.find(cardHud);
        var atLeast = HandRules.AtLeast.get(handRules);

        // Otherwise, we want to draw until either it fails, or we have enough cards.
        var drawFn = function(result) {
            // If we failed to draw, bail out.
            if (!!result && !result.drawn) {
                return GameEffect.createResults(effect);
            }

            var missing = atLeast - CardHud.handSize(cardHud);
            if (missing <= 0) return GameEffect.createResults(effect);

            return GameEffect.push(effect, GameEffect.create("DrawCard", {}, handler)).then(drawFn);
        };

        return Promise.resolve().then(drawFn);
    });

    
    static refillHand(elt, params, effect) {
        if (!effect) {     
            var mainScreen = MainScreenHandler.find(elt);
            effect = EffectQueue.findCurrentQueue(mainScreen);
        }

        return GameEffect.push(effect, GameEffect.create("RefillHand", {}));
    }

    static maybeRefillHand(elt, params, effect) {
        var cardHud = CardHud.find(elt);
        var handRules = HandRules.find(cardHud);
        var atLeast = HandRules.AtLeast.get(handRules);
        var missing = atLeast - CardHud.handSize(cardHud);
        if (missing < 0) {
            return;
        }

        return CardRules.refillHand(elt, params, effect);
    }

    static DiscardSingleCard = GameEffect.handle(function(handler, effect, params) {
        var cardHud = CardHud.find(handler);
        var card = params.card;
        CardHud.discardCard(card);
        return GameEffect.createResults(effect);
    });

    static discardSingleCard(elt, params, effect) {
        if (!effect) {     
            var mainScreen = MainScreenHandler.find(elt);
            effect = EffectQueue.findCurrentQueue(mainScreen);
        }

        return GameEffect.push(effect, GameEffect.create("DiscardSingleCard", {
            card: params.card
        }));
    }
    
    static DiscardCards = GameEffect.handle(function(handler, effect, params) {
        var cardHud = CardHud.find(handler);
        var random = params.random;
        var cards = [];
        if (random) {            
            for (var i = 0; i < CardHud.handSize(cardHud); i++) {
                cards.push(i);
            }
            var hand = a(CardHud.hand(cardHud));
            cards = times(params.count).map(function() {
                return CardRules._rng.randomValueR(hand)
            }).filter(function(obj) {
                return !!obj;
            });
        } else {
            cards = params.cards;
        }

        var discardFn = function(result) {
            // Keep discarding until they're gone.
            if (cards.length > 0) {
                return GameEffect.push(effect, GameEffect.create('DiscardSingleCard', {
                    card: cards.shift()
                }, handler)).then(discardFn);
            }
            // And we're done.
            return GameEffect.createResults(effect);
        }
        return Promise.resolve().then(discardFn);
    });
    
    static discardCards(elt, params, effect) {
        if (!effect) {     
            var mainScreen = MainScreenHandler.find(elt);
            effect = EffectQueue.findCurrentQueue(mainScreen);
        }

        return GameEffect.push(effect, GameEffect.create("DiscardCards", {
            cards: params.cards
        }));
    }
    
    static ShuffleDiscard = GameEffect.handle(function(handler, effect, params) {
        var cardHud = CardHud.find(handler);
        CardHud.shuffle(cardHud);
        return GameEffect.createResults(effect);
    });

    static PlayCard = GameEffect.handle(function(handler, effect, params) {
        // TODO
        return GameEffect.createResults(effect);
    });

    static OnCardSelected(event, handler) {
        var card = Card.normalize(event.detail.node);
        var id = IdAttr.get(card);
        var selected = SelectedAttr.get(card);
        var root = BattlefieldHandler.findGridContainer(handler);
        if (selected) {
            // Unselect other cards.
            var previouslySelected = CardRules._unselectAllBut(id, handler);
            previouslySelected.forEach(function(oldCard) {
                TargetPicker.cancel(oldCard, IdAttr.get(oldCard));
            });

            var cardId = IdAttr.get(card);
            ActionButton.setPendingAction(handler, cardId);

            // Set up our next card.
            CardRules.TargetFn.findInvoke(card, card).then(function(target) {
                ActionButton.clearPendingActionIf(handler, cardId);
                return CardRules.InvokeFn.findInvoke(card, card, target);
            }, function() {
                ActionButton.clearPendingActionIf(handler, cardId);
                SelectedAttr.set(card, false);
                return false;
            }).then(function(discard) {
                if (discard) {
                    CardRules.discardCards(handler, {
                        cards: [card]
                    });
                } else {
                    SelectedAttr.set(card, false);
                }
            });
        } else {
            TargetPicker.cancel(card, id);
        }
    }

    static _unselectAllBut(id, handler) {
        var root = BattlefieldHandler.findGridContainer(handler);        
        var results = Array.from(Card.findAll(Cards.hand(handler))).filter(function(elt) {
            return IdAttr.get(elt) != id && SelectedAttr.get(elt);
        });
        results.forEach(function(elt) {
            SelectedAttr.toggle(elt);
        });
        return results;
    }

}
WoofRootController.register(CardRules);