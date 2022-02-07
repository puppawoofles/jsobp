
class Visitor {

    static Name = new ScopedAttr("name", StringAttr);
    static AppearanceOptions = new ScopedAttr("appearance-options", ListAttr);
    static ValueStr = new ScopedAttr("value", StringAttr);
    static ExtraClasses = new ScopedAttr("extra-classes", ListAttr);

    static FromBlueprintWithParams(bp, params, rng) {
        var appearanceOptions = Visitor.AppearanceOptions.findGet(bp) || [];
        var appearance = params.appearance || null;

        var name = params.name;
        var nameOptions = qsa(bp, 'name-opt');
        if (nameOptions.length > 0) {
            nameOptions = rng.randomValue(nameOptions);
            name = Visitor.ValueStr.get(nameOptions);
        }
        if (!appearance && appearanceOptions.length > 0) {
            appearance = rng.randomValue(appearanceOptions);
        }
        if (!appearance) {
            appearance = '❓'; // Hardcoded. :(
        }

        var visitor = Visitor.inflate({
            name: name,
            appearance: appearance,
            month: params.month,
            day: params.day
        });

        // Copy our blueprint in.
        qs(visitor, 'info[wt~=VisitorBP]').appendChild(bp.cloneNode(true));

        if (Visitor.ExtraClasses.find(bp)) {
            (Visitor.ExtraClasses.findGet(bp) || []).forEach(function(clazz) {
                visitor.classList.add(clazz);
            });
        }

        var merchant = Blueprint.find(bp, 'merchant');
        if (merchant) {
            // This visitor is a merchant.  Neat!
            var preparations = Blueprint.findAll(merchant, 'preparation');
            var toFill = qs(visitor, '.shopping refill');
            preparations.forEach(function(prep) {
                toFill.appendChild(prep.cloneNode(true));
            });

            // Copy the blueprint over.
            qs(visitor, '.shopping [wt~=BP]').appendChild(merchant.cloneNode(true));
        }

        return visitor;
    }
    static OnJoinFn = new ScopedAttr("on-join-fn", FunctionAttr);
    static OnSkipFn = new ScopedAttr("on-skip-fn", FunctionAttr);

    static leaveTown(visitor, rng) {
        // Clear their shopping inventory.
        Utils.clearChildren(qs(visitor, '.shopping inventory'));
    }

    static skipTown(visitor, rng) {
        var skipFnElt = Visitor.OnSkipFn.findDown(visitor);
        if (skipFnElt) {
            Visitor.OnSkipFn.invoke(skipFnElt, visitor);
        }
    }

    static ItemsForSale = new ScopedAttr("items-for-sale", IntAttr);
    static joinTown(visitor, rng) {
        // Populate their shopping inventory
        // Note: This is hard-coded to 3 for now.  Make it configurable!

        var itemsForSale = Visitor.ItemsForSale.findGet(visitor);
        var cardOptions = qsa(visitor, '.shopping refill preparation-blueprint');

        if (cardOptions.length > 0) {
            var inventory = qs(visitor, '.shopping inventory');
            times(itemsForSale).map(function() {            
                var bp = rng.randomValue(cardOptions);
                inventory.appendChild(Preparation.inflate(bp));
            });    
        }

        var joinFnElt = Visitor.OnJoinFn.findDown(visitor);
        if (joinFnElt) {
            Visitor.OnJoinFn.invoke(joinFnElt, visitor);
        }
    }

    static RemoveFromInventory(visitor, sold) {
        var name = Visitor.Name.findGet(sold);
        if (!name) return;
        
        qs(visitor, 'refill [name="' + name + '"]').remove();
    }
}
Utils.classMixin(Visitor, AbstractDomController, {
    matcher: "[wt~=Visitor]",
    template: "town_visitor",
    params: function(config) {
        return {
            NAME: config.name,
            AVATAR: config.appearance,
            MONTH: config.month,
            DAY: config.day
        };
    }
});
WoofRootController.register(Visitor);