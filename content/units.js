class Units {
    static __nameCounter = 0;

    static _front_row = ["F1", "F2", "F3"];
    static _middle_row = ["M1", "M2", "M3"];
    static _back_row = ["B1", "B2", "B3"];

    static _hero_emojis = ["🤩","😗","😀","😁","🤣","🙃","😉","😜","🤑","🤐","😑","😬","😴","🤮","😵","🤠","🤓","🧐","😱","🐱"];
    static _birthday_months = ["🔥","🌪️","💧","⛰️"];
    static _no_birthday_month = "";
    static _birthday_days = ["🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌕"];
    static _no_birthday_day = "";

    static UnitLabel = new ScopedAttr("unit-label", StringAttr);

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

    static _all_units = []

    static _unit_basic_attacks = ["strike", "throw", "shoot"];

    static _unit_skills = {
        "🔥": ["bleed", "sunder"],
        "🌪️": ["push", "wind-gust"],
        "💧": ["distract"],
        "⛰️": ["defend", "protect"]
    };

    static _generate_units() {
        if (Units._all_units.length > 0) {
            return;
        }

        for (var i = 0; i < Units._hero_emojis.length; i++) {
            for (var j = 0; j < Units._birthday_months.length; j++) {
                for (var k = 0; k < Units._birthday_days.length; k++) {
                    Units._all_units.push([Units._hero_emojis[i], Units._birthday_months[j], Units._birthday_days[k]]);            
                }       
            }    
        }
        Units._all_units.shuffle();
    }

    static _next_unit() {
        Units._generate_units();
        return Units._all_units.shift();
    }

    static _determine_wombo(month, day) {
        var returnMe = [month];
        var dayWombo = Units._day_wombo[day];
        if (dayWombo) {
            returnMe = returnMe.concat(dayWombo);
        }
        return returnMe;
    }

    static _starting_preparation = [
        "barricade",
        "throwingknife",
        "turtlePot",
        "cheetahPot",
        "minorDefensePot",
        "blinkCrystal", 
        "minorDamagePot",
        "fireBomb",
        "retreatCloak"
    ];

    static Name = new ScopedAttr("name", StringAttr);
    static sample_hero(rootElt) {
        var deets = Units._next_unit();
        var matcher = deets[0] + deets[1] + deets[2];
        var matched = Utils.bfind(rootElt, 'body', 'silly-unit[matcher="' + matcher + '"]');
        var name;
        if (!!matched) {
            name = Units.Name.get(matched);
        } else {
            name = "Unit-" + Units.__nameCounter++;
        }

        var unit = Unit.inflate({
            name: name,
            icon: deets[0],
            month: deets[1],
            day: deets[2],
            baseDamage: 8,
            baseDefense: 6,
            combo_self: [deets[1], deets[2]],
            wombo_combo: Units._determine_wombo(deets[1], deets[2]),
            hp: 40
        });

        // Weighted to 4 and 5, but 3 and 6 can happen.
        var volley_options = [3, 4, 4, 4, 5, 5, 5, 6];
        var script = Unit._findScript(unit);

        // Generate 2 abilities.
        var abilities = Units.generateAbilitySlots(2, volley_options);
        var skills = [
            randomValue(Units._unit_basic_attacks),
            randomValue(Units._unit_skills[deets[1]])
        ];
        skills.shuffle();
        for (var i = 0; i < abilities.length; i++) {
            if (skills[i]) {
                Ability.applySkill(rootElt, abilities[i], skills[i]);
            }
        }

        abilities.forEach(function(a) {
            script.appendChild(a);
        });

        // Add random inventory item.

        Unit.addToInventory(unit, Preparation.inflate(Preparation.findBlueprint(rootElt || document, randomValue(Units._starting_preparation))));

        TeamAttr.set(unit, Teams.Player);

        return unit;
    }

    static barricade(rootElt) {
        var unit = Unit.inflate({
            name: "Barricade",
            icon: "🧱",
            month: Units._no_birthday_day,
            day: Units._no_birthday_month,
            baseDamage: 0,
            baseDefense: 20,
            mass: 20,
            hp: 30
        });

        TeamAttr.set(unit, Teams.Neutral);
        Unit.Ephemeral.set(unit, true);
        Unit.Construct.set(unit, true);
        
        BaseStatus.ForbiddenStatus.set(unit, ["agility", "bleed"]);

        return unit;
    }

    static rat(rootElt) {
        var unit = Unit.inflate({
            name: "Rat",
            icon: "🐀",
            month: Units._no_birthday_day,
            day: Units._no_birthday_month,
            baseDamage: 2,
            baseDefense: 2,
            hp: 30
        });

        var script = Unit._findScript(unit);

        var firstAbility = Units.generateAbilitySlots(1, [3, 4, 5, 6], [Activations.front_row])[0];
        var secondAbility = Units.generateAbilitySlots(1, [3, 4, 5, 6].filter(function(a) {
            return a != Ability.volley(firstAbility);
        }), [Activations.rows(false, true, true)])[0];

        Ability.applySkill(rootElt, firstAbility, "strike");
        Ability.applySkill(rootElt, secondAbility, "scurry");

        script.appendChild(firstAbility);
        script.appendChild(secondAbility);

        Units.UnitLabel.set(unit, "rat");

        return unit;
    }
    

    static golem(rootElt) {
        var unit = Unit.inflate({
            name: "Golem",
            icon: "🗿",
            month: "⛰️",
            day: Units._no_birthday_month,
            baseDamage: 12,
            baseDefense: 12,
            hp: 60,
            combo_self: ["⛰️"],
            wombo_combo: ["⛰️"]
        });

        var script = Unit._findScript(unit);

        var firstAbility = Units.generateAbilitySlots(1, [1], [Activations.rows(true, true, true)])[0];
        var secondAbility = Units.generateAbilitySlots(1, [5, 6, 7], [Activations.rows(true, false, false)])[0];
        var thirdAbility = Units.generateAbilitySlots(1, [8], [Activations.rows(false, true, true)])[0];

        Ability.applySkill(rootElt, firstAbility, "defend");
        Ability.applySkill(rootElt, secondAbility, "strike");
        Ability.applySkill(rootElt, thirdAbility, "mindlessmarch");

        script.appendChild(firstAbility);
        script.appendChild(secondAbility);
        script.appendChild(thirdAbility);

        // Golems have no blood.  You're welcome, Jake.
        BaseStatus.ForbiddenStatus.set(unit, ["agility", "bleed"]);
        return unit;
    }


    static jimmyTheRatKing(rootElt) {
        var jimmy = Unit.inflate({
            name: "Jimmy the Rat King",
            icon: "🤴",
            month: "💀",
            day: Units._no_birthday_month,
            baseDamage: 8,
            baseDefense: 8,
            hp: 80,
            combo_self: ["💀"],
            wombo_combo: ["💀"]
        });
        var script = Unit._findScript(jimmy);

        var firstAbility = Units.generateAbilitySlots(1, [1])[0];
        var secondAbility = Units.generateAbilitySlots(1, [2, 3, 4])[0];
        var thirdAbility = Units.generateAbilitySlots(1, [5, 6, 7])[0];
        var fourthAbility = Units.generateAbilitySlots(1, [8])[0];

        Ability.applySkill(rootElt, firstAbility, "rat-redirect");
        Ability.applySkill(rootElt, secondAbility, "summon-rats");
        Ability.applySkill(rootElt, thirdAbility, "shoot");
        Ability.applySkill(rootElt, fourthAbility, "scurry");

        script.appendChild(firstAbility);
        script.appendChild(secondAbility);
        script.appendChild(thirdAbility);
        script.appendChild(fourthAbility);

        Units.UnitLabel.set(jimmy, "jimmy");

        return jimmy;
    }

    static generateAbilitySlots(count, volley_options) {
        var abilities = [];
        var abilities_by_volley = {};
        while (abilities.length < count) {
            var volley = randomValue(volley_options);
            if (!abilities_by_volley[volley]) {
                var ability = Ability.inflate({
                    volley: volley
                });
                // Generate an ID.
                IdAttr.generate(ability);
                abilities_by_volley[volley] = ability;
                abilities.push(ability);
            }
        }

        abilities.sort(function (a, b) {
            return Ability.volley(a) - Ability.volley(b);
        })

        return abilities;
    }
}
