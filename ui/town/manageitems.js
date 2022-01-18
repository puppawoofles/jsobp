
class ManageItemsDialog {

    static Accept(event, handler) {
        DialogScreen.Resolve(handler);
    }

    static CardClicked(event, handler) {
        var clicked = Card.findUp(event.target);
        ManageItemsDialog.selectUnit(clicked);  
    }

    static EmptyAll(event, handler) {
        var selectedUnit = ManageItemsDialog.bfindInner(handler, '[wt~=Card][selected=true]');
        ManageItemsDialog.bfindAllInner(handler, '[wt~=Card] inventory').map(function(elt) { return a(elt.children) }).flat().forEach(function(item) {            
            ManageItemsDialog.addItemToStorage(handler, item);
        });
        ManageItemsDialog.sortItems(handler);
        ManageItemsDialog.selectUnit(selectedUnit);
    }

    static addItemToStorage(self, item) {
        var itemsHolder = ManageItemsDialog.bfindInner(self, '.storage_holder');
        var card = Card.WrapInCard(item);
        // Strip off the card type.
        WoofType.remove(card, "Card");
        itemsHolder.appendChild(card);
    }

    static ItemClicked(event, handler) {
        var selectedItem = WoofType.findUp(event.target, 'Item');
        var inventory = matchParent(selectedItem, 'inventory');
        var selectedUnit = ManageItemsDialog.bfindInner(handler, '[wt~=Card][selected=true]');

        if (!!inventory) {
            // We clicked an item in the inventory.  We want to add it back to our storage.
            // Set the selected item back to the original item.
            var itemsHolder = ManageItemsDialog.bfindInner(handler, '.storage_holder');
            selectedItem = qs(selectedUnit, WoofType.buildSelectorFor(selectedItem));            
            ManageItemsDialog.addItemToStorage(handler, selectedItem);
            ManageItemsDialog.sortItems(handler);
        } else {
            // We clicked an item in storage.  We want to try to add it to the unit.
            inventory = qs(selectedUnit, 'inventory');
            var maxItems = Unit.MaxItems.get(inventory);
            if (maxItems <= inventory.childElementCount) {
                Logger.game("Unit's inventory is full!");
                return;
            }
            var card = selectedItem.parentNode;        
            inventory.appendChild(selectedItem);
            card.remove();           
        }

        // Reset our selected item thingie.
        ManageItemsDialog.selectUnit(selectedUnit);
    }

    static selectUnit(selected) {
        var cards = ManageItemsDialog.bfindAllInner(selected, '.units_holder > .card');
        cards.forEach(function(card) {
            Card.setSelected(card, card === selected);
        });

        // Now we copy over the selected one.
        var exploded = selected.cloneNode(true);
        // Strip off the card wooftype.
        WoofType.remove(exploded, "Card");
        var holder = ManageItemsDialog.bfindInner(selected, '.unit_preview');
        Utils.clearChildren(holder);
        holder.appendChild(exploded);
    }

    static setup(self, params) {
        var unitsHolder = qs(self, '.units_holder');
        a(params.itemsHolder.children).forEach(function(item) {
            ManageItemsDialog.addItemToStorage(self, item);
        });
        ManageItemsDialog.sortItems(self);

        Utils.moveChildren(params.unitsHolder, unitsHolder);
        if (unitsHolder.firstElementChild) ManageItemsDialog.selectUnit(unitsHolder.firstElementChild);
    }

    static sortItems(self) {
        var itemsHolder = qs(self, '.storage_holder');
        var items = a(itemsHolder.children);
        items.sort(function(a, b) {
            var aName = Preparation.NameAttr.findGet(a) || 'unknown';
            var bName = Preparation.NameAttr.findGet(b) || 'unknown';
            if (aName < bName) return -1;
            if (bName < aName) return 1;
            return 0;
        }).forEach(function(item) {            
            itemsHolder.appendChild(item);
        });
    }

    static teardown(self, params) {
        var unitsHolder = qs(self, '.units_holder');
        var itemsHolder = qs(self, '.storage_holder');

        a(unitsHolder.children).forEach(function(card) {
            // Unselect.
            Card.setSelected(card, false);
        });
        Utils.moveChildren(unitsHolder, params.unitsHolder);
        a(itemsHolder.children).forEach(function(card) {
            params.itemsHolder.appendChild(card.firstElementChild);
        });
    }
}
Utils.classMixin(ManageItemsDialog, AbstractDomController, {
    matcher: ".manage_items",
    template: "manage_items_dialog",
    params: function(params) {
        return {};
    }
});
WoofRootController.register(ManageItemsDialog);