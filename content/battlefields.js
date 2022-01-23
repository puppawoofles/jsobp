class Battlefields {

    static _rng = ASRNG.newRng(NC.Seed, true, NC.Day, NC.Event, NC.Encounter);

    static BattlefieldFn = new ScopedAttr('battlefield-fn', FunctionAttr);
    static Generate(encounter, bp) {
        Battlefields.BattlefieldFn.findInvoke(bp, encounter, bp);
    }

    static Fn = new ScopedAttr('fn', FunctionAttr);
    static Labels = new ScopedAttr('labels', ListAttr);
    static LabelFilter = new ScopedAttr('label-set-modifier', FunctionAttr);
    static Property = new ScopedAttr('property', StringAttr);
    static Value = new ScopedAttr('value', StringAttr);

    static Standard(battlefield, bp) {
        var generate = qs(bp, 'generate');
        Battlefields.Fn.invoke(generate, battlefield, generate);

        var blocks = CellBlock.findAll(battlefield).toObject(function(block) {
            return BigGridLabel.get(block);
        });

        qsa(bp, 'modify').forEach(function(modifier) {
            var labels = Battlefields.Labels.get(modifier);
            if (Battlefields.LabelFilter.has(modifier)) {
                labels = Battlefields.LabelFilter.invoke(modifier, modifier, labels);
            }
            labels.forEach(function(label) {
                var block = blocks[label];
                block.setAttribute(Battlefields.Property.get(modifier), Battlefields.Value.get(modifier));
            });
        });
    }

    /** Generate functions */
    static Width = new ScopedAttr('width', IntAttr);
    static Height = new ScopedAttr('height', IntAttr);
    static generateRect(battlefield, generateElt) {
        var width = Battlefields.Width.get(generateElt);
        var height = Battlefields.Height.get(generateElt);
        // And go.
        GridGenerator.generate(BattlefieldHandler.findGridContainer(battlefield), width, height);
    }

    /** Label Set modifier functions */

    static SubsetSize = new ScopedAttr('subset-size', IntAttr);
    static labelSetModifierRandomSubset(modifierElt, labels) {
        var subsetSize = Battlefields.SubsetSize.get(modifierElt);
        var labelClone = Array.from(labels);
        return times(Math.min(subsetSize, labelClone.length)).map(function() {
            return Battlefields._rng.randomValueR(labelClone);
        });
    }
}
WoofRootController.register(Battlefields);