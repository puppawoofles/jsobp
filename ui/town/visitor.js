
class Visitor {

    static AppearanceOptions = new ScopedAttr("appearance-options", ListAttr);

    static FromBlueprintWithParams(bp, params, rng) {
        var appearanceOptions = Visitor.AppearanceOptions.findGet(bp) || [];
        var appearance = params.appearance || null;
        if (!appearance && appearanceOptions.length > 0) {
            appearance = rng.randomValue(appearanceOptions);
        }
        if (!appearance) {
            appearance = '❓'; // Hardcoded. :(
        }

        var visitor = Visitor.inflate({
            name: params.name,
            appearance: appearance,
            month: params.month,
            day: params.day
        });

        var merchant = Blueprint.find(bp, 'merchant');
        if (merchant) {
            // This visitor is a merchant.  Neat!
            var preparations = Blueprint.findAll(merchant, 'preparation');
            var toFill = qs(visitor, '.shopping refill');
            preparations.forEach(function(prep) {
                toFill.appendChild(prep.cloneNode(true));
            });
        }

        return visitor;
    }

    static leaveTown(visitor) {
        // Clear their shopping inventory.
        Utils.clearChildren(qs(visitor, '.shopping inventory'));
    }

    static joinTown(visitor, rng) {
        // Populate their shopping inventory
        // Note: This is hard-coded to 3 for now.  Make it configurable!
        var itemsForSale = 3;
        var cardOptions = qsa(visitor, '.shopping refill preparation-blueprint');

        var inventory = qs(visitor, '.shopping inventory');
        times(itemsForSale).map(function() {            
            var bp = rng.randomValue(cardOptions);
            inventory.appendChild(Preparation.inflate(bp));
        });
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
})