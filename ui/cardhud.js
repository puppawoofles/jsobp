
/** Handler for the card UI the player uses. */
class CardHud {

	static Cost = new ScopedAttr("cost", IntAttr);
	static Disabled = new ScopedAttr("disabled", BoolAttr);

	static populateDrawPile(parentElt, cards) {
		var hud = CardHud._findDeckContent(parentElt);
		cards.forEach(function(card) {
			hud.appendChild(card);
		})
	}

	static allCards(parentElt) {
		var hud = CardHud.find(parentElt);
		return Array.from(hud.querySelectorAll(WoofType.buildSelector("Card")));
	}

	static getDrawCost(parentElt) {
		var hud = CardHud.find(parentElt);
		return CardHud.Cost.get(hud.querySelector(WoofType.buildSelector("DrawPileUi"))) || 0;
	}
	
	static setDrawCost(parentElt, newCost) {
		var hud = CardHud.find(parentElt);
		return CardHud.Cost.set(hud.querySelector(WoofType.buildSelector("DrawPileUi")), newCost);
	}

	static unselectCards(parentElt) {
		var hud = CardHud._findHandContent(parentElt);
		var elts = SelectedAttr.findAll(hud, 'true');
		new Stream().forEach(elts, function(e) {
			SelectedAttr.false(e);
		});
	}

	static selectedCards(parentElt) {
		var hud = CardHud._findHandContent(parentElt);
		return SelectedAttr.findAll(hud, 'true');
	}

	static findCardById(parentElt, id) {
		var hud = CardHud.find(parentElt);
		return hud.querySelector('.hand [w-id="' + id + '"]');
	}
	
	static findSelectedCards(parentElt) {
		var hud = CardHud.find(parentElt);
		return hud.querySelectorAll('.hand .card[selected]');
	}
	
	static _findDeckContent(parentElt) {
		var root = CardHud.bfind(parentElt);
		if (!root) return null;
		return root.querySelector('.deck > .content');
	}
	
	static _findDiscardContent(parentElt) {
		var root = CardHud.bfind(parentElt);
		if (!root) return null;
		return root.querySelector('.discard > .content');		
	}
	
	static _findHandContent(parentElt) {
		var root = CardHud.bfind(parentElt);
		if (!root) return null;
		return root.querySelector('.hand > .content');		
	}
	
	static _findPurgatory(parentElt) {
		var root = CardHud.bfind(parentElt);
		if (!root) return null;
		return root.querySelector(WoofType.buildSelector("CardPurgatory"));		
	}
		
	static __resetSize(parentElt) {
		var children = parentElt.querySelector(".content");
		var size = parentElt.querySelector(".size");
		while ((!size || !children) && parentElt != parentElt.parentNode) {
			parentElt = parentElt.parentNode;
			children = parentElt.querySelector(".content");
			size = parentElt.querySelector(".size");
		}
		if (size.innerHTML == children.childElementCount) return null;
		var current = parseInt(size.innerHTML);		
		size.innerHTML = children.childElementCount;
		return {
			delta: children.childElementCount - current,
			oldSize: current,
			newSize: children.childElementCount
		};
	}
	
	static OnContentChange(event, handler) {
		var delta = CardHud.__resetSize(event.target);
		if (delta) {
			var target = WoofType.findUp(event.target, "CardSet");
			if (target) {
				WoofRootController.dispatchNativeOn(target, "SizeChange", delta);
			}			
		}
		if (event.type == "AddChild") {
			WoofRootController.dispatchNativeOn(event.detail.to, "AddCard", { card: event.detail.child });
		}
		if (event.type == "RemoveChild") {
			WoofRootController.dispatchNativeOn(event.detail.from, "RemoveCard", { card: event.detail.child });			
		}
		if (event.type == "MoveFrom") {
			WoofRootController.dispatchNativeOn(event.detail.from, "RemoveCard", { card: event.detail.child });						
		}
		if (event.type == "MoveTo") {
			WoofRootController.dispatchNativeOn(event.detail.to, "AddCard", { card: event.detail.child });						
		}
	}
	
	static OnCardSelect(event, handler) {
		var hud = CardHud.find(handler);
		if (CardHud.Disabled.get(hud)) {
			// Disabled!  Can't do shit.
			return;
		}
		var card = Card.normalize(event.target);
		if (!card) return;
		SelectedAttr.toggle(card);
		WoofRootController.dispatchNativeOn(CardHud._findHandContent(card), "SelectChange", {});
	}
	
	static setCardSelect(card, value) {
		SelectedAttr.set(card, value);
	}
	
	static drawCard(parentElt, random) {
		var deck = CardHud._findDeckContent(parentElt);
		var hand = CardHud._findHandContent(parentElt);
		if (!deck || !hand) throw boom("Unable to find card hud from", parentElt);
		
		if (!deck.firstElementChild) return false;
		
		if (!random) {
			hand.appendChild(deck.firstElementChild);
		} else {
			var childIdx = Math.floor(Math.random() * deck.childElementCount);
			hand.appendChild(deck.children[childIdx]);			
		}
		
		return true;
	}
	
	static firstCard(parentElt) {
		var hand = CardHud._findHandContent(parentElt);
		return hand.firstElementChild;
	}
	
	static discardCard(cardElt) {
		return CardHud.discardCards([cardElt]);
	}
	
	static discardCards(cardElts) {
		if (cardElts.length == 0) return;
		var discard;
		var idx = 0;
		while (!discard && idx < cardElts.length) {			
			discard = CardHud._findDiscardContent(cardElts[idx++]);
		}
		if (!discard) throw boom("Unable to find card hud from one of", cardElts);
		for (var card of cardElts) {
			discard.appendChild(card);
			SelectedAttr.set(card, false);
		}
	}
	
	static handSize(root) {
		var hand = CardHud._findHandContent(root);
		return hand.childElementCount;
	}
	
	static discardSize(root) {
		var hand = CardHud._findDiscardContent(root);
		return hand.childElementCount;
	}

	static shuffle(root) {
		var discard = CardHud._findDiscardContent(root);
		var draw = CardHud._findDeckContent(root);
		Utils.moveChildren(discard, draw);
	}
	
	static hand(root) {
		var hand = CardHud._findHandContent(root);
		return Array.from(hand.children)
				.filter(card => card.nodeType == Node.ELEMENT_NODE);
	}

	static addCardToPurgatory(root, card) {
		var purgatory = CardHud._findPurgatory(root);
		purgatory.appendChild(card);
	}
}
WoofRootController.register(CardHud);
WoofRootController.addListeners('SizeChange', 'SelectChange', 'AddCard', 'RemoveCard');
Utils.classMixin(CardHud, AbstractDomController, {
    matcher: "[wt~=CardHud]",
    template: "card_hud",
    params: emptyObjectFn,
    decorate: function(fragment, cards) {
        var deck = fragment.querySelector('.deck > .content');
		for (var card of cards) {
            var cardElt = Card.inflateIn(deck, Utils.UUID());
            cardElt.appendChild(card);
		}		
		
		CardHud.__resetSize(fragment.querySelector('.deck'));
		CardHud.__resetSize(fragment.querySelector('.discard'));		
    }
});


class HandRules {
	static AtLeast = new ScopedAttr("at-least", IntAttr);
	static AtMost = new ScopedAttr("at-most", IntAttr);

	static find(elt) {
		return Utils.bfind(elt, 'body', WoofType.buildSelector("HandRules"));
	}
}
