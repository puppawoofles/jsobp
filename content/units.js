
class Allegiance {

    static allies(unitA, unitB) {
        return TeamAttr.get(unitA) == TeamAttr.get(unitB);
    }

    static opposed(unitA, unitB) {
        var team = TeamAttr.get(unitA);
        return Teams.opposed(team).includes(TeamAttr.get(unitB));
    }

}


class DamageTypes {
    static MELEE = '⚔️';
    static THROWN = '⚾';
    static RANGED = '🏹';
    static MAGIC = '☄️';

    static COLLISION = '💥';

}

class PlayerUnits {
    static _generateNames(elt) {
        var workspace = Workspace.find();
        // We've got names already.
        if (qs(workspace, 'name-option')) return;
        
        fa('name-option').forEach(h => workspace.appendChild(h.cloneNode()));
    }

    static Alias = new ScopedAttr("alias", StringAttr);
    static Value = new ScopedAttr("value", StringAttr);
    static Values = new ScopedAttr("values", ListAttr);
    static Data = new ScopedAttr("data", BlobAttr);
    static _generateDemographics(elt) {
        var workspace = Workspace.find();
        if (qs(workspace, 'player-demographic')) return;

        var axes = fa('player-demographics > def');
        var template = f('player-demographics > template[name="demographic"]');

        var results = [{}]
        var workingSet = [];
        axes.forEach(function(axis) {
            var alias = PlayerUnits.Alias.get(axis);
            PlayerUnits.Values.get(axis).forEach(function(value) {
                results.forEach(function(existing) {
                    var thing = {};
                    thing[alias] = value;
                    workingSet.push(Object.assign(thing, existing));
                });
            });

            results = workingSet;
            workingSet = [];
        });

        results.forEach(function(result) {
            var obj = Templates.inflateIn(template, workspace, {})
            PlayerUnits.Data.set(obj, result);
        });
    }

    static TakeName(unit, elt, rng) {
        var workspace = Workspace.find();
        PlayerUnits._generateNames(elt);
        var options = qsa(workspace, 'name-option');
        var option = rng.randomValue(options);
        option.remove();

        return PlayerUnits.Value.get(option);
    }

    static TakeDemographic(unit, elt, rng) {
        var workspace = Workspace.find();
        PlayerUnits._generateDemographics(elt);
        var options = qsa(workspace, 'player-demographic');
        var option = rng.randomValue(options);
        // No longer an option.
        option.remove();

        return PlayerUnits.Data.get(option);
    }

    static ApplyDemographic(unit, elt, demographic) {
        Unit.Month.findSetAll(unit, demographic.month);
        Unit.Day.findSetAll(unit, demographic.day);
        Unit.Appearance.findSetAll(unit, demographic.appearance);
    }

    static MonthFromDemographic(unit, elt, demographic) {
        return demographic.month;
    }

    static DemographicString(unit, elt) {
        return Unit.Appearance.findGet(unit) + Unit.Month.findGet(unit) + Unit.Day.findGet(unit);
    }

    
    static _day_wombo = {
        "🌕": ["🌔", "🌕", "🌖"],
        "🌖": ["🌕", "🌖", "🌗"],
        "🌗": ["🌖", "🌗", "🌘"],
        "🌘": ["🌗", "🌘", "🌑"],
        "🌑": ["🌘", "🌑", "🌒"],
        "🌒": ["🌑", "🌒", "🌓"],
        "🌓": ["🌒", "🌓", "🌔"],
        "🌔": ["🌓", "🌔", "🌕"]
    };
    static ApplyLegacyCombo(unit, elt) {
        var month = Unit.Month.findGet(unit);
        var day = Unit.Day.findGet(unit);

        var comboOthers = PlayerUnits._day_wombo[day].clone();
        comboOthers.push(month);

        var comboSelf = [month, day];

        Unit.ComboSelf.set(unit, comboSelf);
        Unit.ComboWith.set(unit, comboOthers);
        Mana.Attr.set(unit, month);
    }

}
WoofRootController.register(PlayerUnits);



class Units {
    /** TODO: Rewrite this eventually. */
    static randomVisitor(rootElt) {
        var demo = PlayerUnits.TakeDemographic(null, rootElt, UnitGen._rng);
        demo.name = PlayerUnits.TakeName(null, rootElt, UnitGen._rng);
        return demo;
    }
}
WoofRootController.register(Units);
