class UnitSelect {
    static MinimumUnits = new ScopedAttr("minimum_units", IntAttr);
    static MaximumUnits = new ScopedAttr("maximum_units", IntAttr);
    static setup(me, params) {
        var deck = params.deck;
        var optionHolder = me.querySelector(".option_holder");
        deck.forEach(function(card) {
            // Clone these into the appropriate holders.
            optionHolder.appendChild(card.cloneNode(true));
        });
        UnitSelect.refreshAcceptButton(me);
    }

    static Accept(event, handler) {
        var holder = handler.querySelector(".selected_holder");
        var units = Array.from(holder.children).map(function(card) {
            return WoofType.buildSelectorFor(card);
        });
        DialogScreen.Resolve(handler, units);
    }

    static Cancel(event, handler) {
        DialogScreen.Reject(handler);
    }

    static Disabled = new ScopedAttr("disabled", BoolAttr);
    static OnSelected(event, handler) {
        var card = event.detail.node;
        var destination;
        if (Card.Selected.get(card)) {
            // Move it into the selected holder.
            destination = handler.querySelector(".selected_holder");
        } else {
            // Move it into the option holder.
            destination = handler.querySelector(".option_holder");
        }
        destination.appendChild(card);

        // Refresh our accept/cancel buttons.
        UnitSelect.refreshAcceptButton(handler);
    }

    static refreshAcceptButton(handler) {
        var selectedHolder = handler.querySelector(".selected_holder");
        var numCards = selectedHolder.children.length;

        var minCards = UnitSelect.MinimumUnits.get(handler);
        var maxCards = UnitSelect.MaximumUnits.get(handler);
        var acceptButton = WoofType.find(handler, "Accept");
        UnitSelect.Disabled.set(acceptButton, !(numCards >= minCards && numCards <= maxCards), true);
    }

    static OnHover(event, handler) {
        var card = Card.findUp(event.target);
        var preview = handler.querySelector(".unit_preview");
        Utils.clearChildren(preview);
        var clone = card.cloneNode(true);
        WoofType.remove(clone, "Card");
        preview.appendChild(clone);
    }
}
Utils.classMixin(UnitSelect, AbstractDomController, {
    matcher: '.unit_select',
    template: 'unit_select_screen',
    params: function(params) {
        return {
            MINIMUM_UNITS: params.minUnits,
            MAXIMUM_UNITS: params.maxUnits,
            EXTRA_CLASSES: params.extraClasses
        }
    }
});
WoofRootController.register(UnitSelect);