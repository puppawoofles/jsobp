

class ShopDialog {

    static Done(event, handler) {
        DialogScreen.Resolve(handler);
    }

    static Text = new ScopedAttr('text', StringAttr);
    static ShopItemClick(event, handler) {
        var shopItem = WoofType.findUp(event.target, 'ShopItem');
        if (!ShopDialog.CanAfford.findGet(shopItem)) {
            var holder = ShopDialog.bfindInner(handler, '.quote_holder');
            ShopDialog.Text.set(holder, "You can't afford that!");
            setTimeout(function() {
                ShopDialog.Text.set(holder);
            }, 1500);
            return;
        }

        // Let's gooooooo.
        var price = ShopDialog.Price.findGet(shopItem);
        var item = Card.CardType.find(shopItem);
        ShopDialog.addItemToStorage(handler, item);
        shopItem.remove();
        RunInfo.spendGold(handler, price);
        ShopDialog.sortItems(handler);
        ShopDialog.refreshPrices(handler);
    }

    static Name = new ScopedAttr("name", StringAttr);
    static setup(self, params) {
        var merchant = params.merchant;
        var appearance = qs(merchant, '.appearance');
        if (appearance) {
            qs(self, '.appearance_holder').appendChild(appearance.cloneNode(true));
        }
        var name = ShopDialog.Name.findGet(merchant);
        if (name) {
            ShopDialog.Name.set(qs(self, '.name_holder'), name);
        }

        a(qs(merchant, 'inventory').children).forEach(function(item) {
            // TODO: Make this price configurable.
            ShopDialog.addShopItem(self, item, 30);
        });

        a(params.itemsHolder.children).forEach(function(item) {
            ShopDialog.addItemToStorage(self, item);
        });
        ShopDialog.sortItems(self);
        ShopDialog.refreshPrices(self);
    }

    static addItemToStorage(self, item) {
        var itemsHolder = ShopDialog.bfindInner(self, '.storage_holder');
        var card = Card.WrapInCard(item);
        // Strip off the card type.
        WoofType.remove(card, "Card");
        itemsHolder.appendChild(card);
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

    static Price = new ScopedAttr("price", IntAttr);
    static addShopItem(self, item, price) {
        var storage = qs(self, '.inventory_holder');

        var card = Card.WrapInCard(item);
        var shopItem = Templates.inflate("shop_item");
        qs(shopItem, '.card_holder').appendChild(card);
        ShopDialog.Price.set(qs(shopItem, '.price_holder'), price);
        storage.appendChild(shopItem);
    }

    static teardown(self, params) {
        // Move the merchant's inventory back to the merchant.
        var merchantInventory = qs(params.merchant, 'inventory');
        a(qs(self, '.inventory_holder').children).forEach(function(item) {
            item = Card.CardType.find(item);
            merchantInventory.appendChild(item);
        });

        // Move storage items back to storage.
        a(qs(self, '.storage_holder').children).forEach(function(item) {
            item = Card.CardType.find(item);
            RunInfo.addStorageItem(self, item);
        });
    }

    static CanAfford = new ScopedAttr("can-afford", BoolAttr);
    static refreshPrices(self) {
        var currentGold = RunInfo.getCurrentGold(self);
        ShopDialog.Price.findAll(self).forEach(function(price) {
            ShopDialog.CanAfford.set(
                WoofType.findUp(price, 'ShopItem'),
                currentGold >= ShopDialog.Price.get(price));
        });

    }
}
Utils.classMixin(ShopDialog, AbstractDomController, {
    matcher: ".shop_dialog",
    template: "shop_dialog",
    params: function(params) {
        return {};
    }
});
WoofRootController.register(ShopDialog);