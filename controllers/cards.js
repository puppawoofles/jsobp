
/** Generel purpose card handler.  One layer up from CardHud, one layer below CardRules. */
class Cards {
	
	static discardCards(cards, opt_parentElt) {
		if (cards.length == 0) return;
		var discard = Cards.discard(opt_parentElt || cards[0]);
		if (!discard) throw boom("Unable to find discard pile");
		cards.forEach(card => discard.appendChild(card));
		return true;
	}
	
	static drawInto(container, opt_config) {
		var draw = Cards.drawPile(container);
		if (!draw) throw boom("Unable to find draw pile");
		
		// TODO: This is where you would factor in the idea of top/middle/bottom.

		if (!draw.firstElementChild) return false;

		if (opt_config && opt_config.random) {
			var childIdx = Math.floor(Math.random() * draw.childElementCount);
			container.appendChild(draw.children[childIdx]);
		} else {
			container.appendChild(draw.firstElementChild);
		}
		return true;					
	}
	
	static hand(elt) {
		return Utils.bfind(elt,
				'body',
				'[wt~="Hand"]');
	}
	
	static discard(elt) {
		return Utils.bfind(elt,
				'body',
				'[wt~="Discard"]');
	}
	
	static drawPile(elt) {
		return Utils.bfind(elt,
				'body',
				'[wt~="DrawPile"]');
	}
	
	static shuffle(elt) {
		var discard = Cards.discard(elt);
		var draw = Cards.drawPile(elt);
		while (discard.firstElementChild) {
			draw.appendChild(discard.firstElementChild);
		}
	}	
}