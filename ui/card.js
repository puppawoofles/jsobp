
class Card {
    static CardType = new ScopedAttr("card-type", StringAttr);
    static Selected = new ScopedAttr("selected", BoolAttr);

    // Properties for ownership.
    static ForUnit = new ScopedAttr('for-unit', StringAttr);
    static OwnerUnit = new ScopedAttr("owner-unit", StringAttr);
    static Ephemeral = new ScopedAttr("ephemeral", BoolAttr);

    static ToggleSelected(event, handler) {
        var card = Card.findUp(event.target);
        Card.Selected.toggle(card);
    }
    
    static WrapInCard(elt) {
        var card = Card.inflate(Utils.UUID());
        var forUnit = Card.ForUnit.findGet(elt);        
        if (forUnit) {
            Card.OwnerUnit.set(card, forUnit);
        }
        card.appendChild(elt);
        return card;
    }

}
WoofRootController.register(Card);
Utils.classMixin(Card, AbstractDomController, {
    matcher: "[wt~=Card]",
    template: "card",
    params: function(id) {
        return {
            ID: id
        }
    }
});

class Tactic {
    static NameAttr = new ScopedAttr('name', StringAttr);
    static CardIconAttr = new ScopedAttr('card-icon', StringAttr);
    static LabelAttr = new ScopedAttr('label', StringAttr);
    static ShortLabelAttr = new ScopedAttr('short-label', StringAttr);
    static TargetFnAttr = new ScopedAttr('target-fn', FunctionAttr);
    static InvokeFnAttr = new ScopedAttr('invoke-fn', FunctionAttr);

    static findBlueprint(baseElt, name) {
        return Utils.bfind(baseElt, 'body', 'tactic-blueprint[name="' + name + '"]');
    }    
}
Utils.classMixin(Tactic, AbstractDomController, {
    matcher: "[card-type='tactic']",
    template: "tactic",
    params: function(blueprint) {
        return {
            CARD_ICON: Tactic.CardIconAttr.get(blueprint),
            TACTIC_LABEL: Tactic.LabelAttr.get(blueprint),
            TACTIC_SHORTLABEL: Tactic.ShortLabelAttr.get(blueprint),
            TACTIC_DESCRIPTION: qs(blueprint, '.description').innerHTML,
            TARGET_FN: Tactic.TargetFnAttr.get(blueprint),
            INVOKE_FN: Tactic.InvokeFnAttr.get(blueprint)
        };
    }
});




class Preparation {
    static NameAttr = new ScopedAttr('name', StringAttr);
    static Appearance1 = new ScopedAttr('appearance_1', StringAttr);
    static Appearance2 = new ScopedAttr('appearance_2', StringAttr);
    static LabelAttr = new ScopedAttr('label', StringAttr);
    static ShortLabelAttr = new ScopedAttr('short-label', StringAttr);
    static TargetFnAttr = new ScopedAttr('target-fn', FunctionAttr);
    static InvokeFnAttr = new ScopedAttr('invoke-fn', FunctionAttr);
    static Cost = new ScopedAttr('cost', IntAttr);
    static Uses = new ScopedAttr('uses', IntAttr);
    static Used = new ScopedAttr('used', BoolAttr);
    static Exhaust = new ScopedAttr("exhaust", BoolAttr);

    static findBlueprint(baseElt, name) {
        return Utils.bfind(baseElt, 'body', 'preparation-blueprint[name="' + name + '"]');
    }

    static resetUses(elt) {
        var usesParent = Preparation.Uses.find(elt);
        Utils.clearChildren(usesParent);
        var maxUses = Preparation.Uses.get(usesParent);
        while (usesParent.children.length < maxUses) {
            var use = Templates.inflateIn("preparation_use", usesParent);
            Preparation.Used.set(use, false);
            Preparation.Exhaust.copy(use, usesParent);
        }
    }
}
Utils.classMixin(Preparation, AbstractDomController, {
    matcher: "[card-type='preparation']",
    template: "preparation",
    params: function(blueprint) {
        return {
            APPEARANCE_1: Preparation.Appearance1.findGet(blueprint),
            APPEARANCE_2: Preparation.Appearance2.findGet(blueprint) || '',
            LABEL: Preparation.LabelAttr.findGet(blueprint),
            APPEARANCE_CLASS: "",
            TARGET_FN: Preparation.TargetFnAttr.get(blueprint),
            INVOKE_FN: Preparation.InvokeFnAttr.get(blueprint),
            DESCRIPTION: qs(blueprint, '.description').innerHTML,
            COST: Preparation.Cost.findGet(blueprint),
            USES: Preparation.Uses.findGet(blueprint),
            EXHAUST: Preparation.Exhaust.findGet(blueprint)
        };
    },
    decorate: function(elt, bp) {
        Preparation.resetUses(elt);
    }
});