class RoundPanel {
    static ForBlock = new ScopedAttr("for-block", StringAttr);
    static ForTeam = new ScopedAttr("for-team", StringAttr);
    static CurrentVolley = new ScopedAttr("current-volley", IntAttr);


    static volleysElt(parentElt) {
        return parentElt.querySelector(".volleys");
    }

    static _createBlockPanel(parent, label, team) {
        var panel = Templates.inflate("round_panel_group", {
            BLOCK_LABEL: label
        });
        var targetSubgroup = RoundPanel.ForTeam.find(parent, team);
        if (!targetSubgroup) {
            throw boom("Found team that is not otherwise specified", team);
        }
        // Figure out where it goes.
        for (var i = 0; i < targetSubgroup.childNodes.length; i++) {
            var node = targetSubgroup.childNodes[i];
            // Skip non-elements.
            if (!isElement(node)) continue;
            var nodeLabel = RoundPanel.ForBlock.get(node);
            if (label.localeCompare(nodeLabel) < 0) {
                targetSubgroup.insertBefore(panel, node);
                break;
            }
        }
        if (!panel.parentElement) {
            targetSubgroup.appendChild(panel);
        }
        return panel;
    }

    static OnUnitAdd(event, handler) {
        var roundPanel = RoundPanel.find(handler);
        var unit = event.detail.unit;
        var block = CellBlock.findByCoord(handler, BigCoord.extract(unit));
        var team = TeamAttr.get(block);

        var contents = roundPanel.querySelector(".contents [for-team='" + team + "']");
        var newRow = RoundPanelRow.forUnit(unit);
        contents.appendChild(newRow);

        var children = RoundPanelRow.findAll(contents);
        children.sort(function(a, b) {
            var aBlock = Unit.CellBlock.get(a);
            var bBlock = Unit.CellBlock.get(b);
            var aId = IdAttr.generate(a);
            var bId = IdAttr.generate(b);

            return aBlock.localeCompare(bBlock) || aId.localeCompare(bId);
        }).forEach(function(a) {
            // Rearrange them for maximum sorting fun.
            contents.appendChild(a);
        });
    }

    static OnUnitRemove(event, handler) {
        // Remove the row.
        var unit = event.detail.unit;
        var id = IdAttr.get(unit);
        var panel = RoundPanel.find(handler);
        var row = RoundPanelRow.findForUnit(panel, id);
        row.remove();
    }

    static OnUnitMove(event, handler) {
        var unit = event.detail.unit;
        var panel = RoundPanel.find(handler);
        var row = RoundPanelRow.findForUnit(panel, IdAttr.get(unit));
        RoundPanelRow.updateForUnit(row, unit);
    }
    
    static OnCellBlockFacingChange(event, handler) {
        var target = event.detail.node;
        var label = BigGridLabel.get(target);
        var facing = FacingAttr.get(target);
        var panel = RoundPanel.find(handler);
        var subPanel = RoundPanel.ForBlock.find(panel, label);
        if (!!subPanel) {
            FacingAttr.set(subPanel, facing);
            var unitBlobs = ForUnitAttr.findAll(subPanel);
            for (var i = 0; i < unitBlobs.length; i++) {
                var unit = Unit.findById(handler, ForUnitAttr.get(unitBlobs[i]));
                RoundPanelRow.updateForUnit(unitBlobs[i], unit);
            }
        }
    }

    static OnBeforeVolley = GameEffect.handle(function(handler, effect, params) {
        var volleyCount = params.volleyCount;
        var panel = RoundPanel.find(handler);

        RoundPanel.CurrentVolley.set(panel, volleyCount);
    });

    static OnAfterVolley = GameEffect.handle(function(handler, effect, params) {
        var panel = RoundPanel.find(handler);
        RoundPanel.CurrentVolley.set(panel);
    });

    static OnBeforeActivateGroup = GameEffect.handle(function(handler, effect, params) {
        var panel = RoundPanel.find(handler);
        params.blorbs.forEach(function(b) {
            var unit = Utils.bfind(handler, 'body', b.unit);
            var row = RoundPanelRow.findForUnit(panel, IdAttr.get(unit));
            row.classList.add("active");
        });
    });

    static OnAfterActivateGroup = GameEffect.handle(function(handler, effect, params) {
        var panel = RoundPanel.find(handler);
        params.blorbs.forEach(function(b) {
            var unit = Utils.bfind(handler, 'body', b.unit);
            if (!unit) return; // May have died!
            var row = RoundPanelRow.findForUnit(panel, IdAttr.get(unit));
            row.classList.remove("active");
        });
    });

    static Activated = new ScopedAttr('activated', BoolAttr);
    static OnBeforeRound = GameEffect.handle(function(handler, effect, params) {
        var panel = RoundPanel.find(handler);

        // Find all abilities.
        var rows = RoundPanelRow.ForAbility.findAll(panel);
        rows.forEach(function(row) {
            RoundPanel.Activated.set(row, false);
        });
    });

    static AfterUseAbility = GameEffect.handle(function(handler, effect, params) {
        var panel = RoundPanel.find(handler);
        for (var i = 0; i < params.components.length; i++) {
            var ability = Utils.bfind(effect, 'body', params.components[i].ability);
            var abilityId = IdAttr.get(ability);
            var row = RoundPanelRow.ForAbility.find(panel, abilityId);
            RoundPanel.Activated.set(row, true);
        }
    });

    static OnAbilityUpdated(event, handler) {
        var ability = Utils.bfind(handler, 'body', WoofType.buildSelectorFor(event.detail.ability));
        var unit = Unit.findUp(ability);
        var id = IdAttr.get(ability);
        var panel = RoundPanel.find(ability);
        var unitRow = RoundPanelRow.findForUnit(unit, IdAttr.get(unit));
        if (!unitRow) {
            // Skip doing anything if we don't know about this unit.
            return;
        }

        var volley = Ability.volley(ability);

        var abilityBox = RoundPanelRow.ForAbility.findDown(unitRow, id);
        var volleyBox = RoundPanelRow.VolleyCount.findDown(unitRow, volley);

        var needsSort = false;
        if (!!abilityBox && !!volleyBox && !abilityBox != volleyBox) {
            // Uh oh.
            RoundPanelRow.VolleyCount.copy(volleyBox, abilityBox);
            RoundPanelRow.VolleyCount.set(abilityBox, volley);
            needsSort = true;
        }

        RoundPanelRow.updateForAbility(abilityBox, ability, unit);
        
        if (needsSort) {
            // Rearrange them.
            var elt = abilityBox.parentElement;
            var children = RoundPanelRow.VolleyCount.findAll(elt);
            children.sort(function(a, b) {
                return RoundPanelRow.VolleyCount.get(a) - RoundPanelRow.VolleyCount.get(b);
            }).forEach(function(a) {
                elt.appendChild(a);
            });
        }
    }
}
WoofRootController.register(RoundPanel);
WoofRootController.addListeners('NewUnit', 'RemovedUnit', 'UnitMoved');
Utils.classMixin(RoundPanel, AbstractDomController, {
    matcher: ".round_panel",
    template: "round_panel",
    params: emptyObjectFn
});


class RoundPanelRow {
    static VolleyCount = new ScopedAttr("volley-count", IntAttr);
    static ForAbility = new ScopedAttr("for-ability", StringAttr);
    static EffectivePosition = new ScopedAttr("effective-position", StringAttr);
    static Inactive = new ScopedAttr("inactive", BoolAttr);
    static Temporary = new ScopedAttr("temporary", BoolAttr);
    static Delayed = new ScopedAttr("delayed", BoolAttr);
    static Hastened = new ScopedAttr("hastened", BoolAttr);

    static forUnit(unit) {
        var elt = RoundPanelRow.inflate({});

        // Copy over some stuff.
        TeamAttr.copy(elt, unit);
        ForUnitAttr.set(elt, IdAttr.get(unit));
        var appearance = unit.querySelector(".appearance").cloneNode(true);
        elt.querySelector(".round_panel_avatar").appendChild(appearance);
        var tile = Grid.getEffectiveTile(unit);
        RoundPanelRow.EffectivePosition.set(elt, tile);
        RoundPanelRow.updateForUnit(elt, unit);

        return elt;
    }

    static findForUnit(parent, unitId) {
        return ForUnitAttr.find(parent, unitId);
    }

    static updateForAbility(elt, ability, unit) {
        Utils.clearChildren(elt);
        var abilityElt = ability.cloneNode(true);
        Utils.moveChildren(abilityElt, elt);
        RoundPanelRow.Inactive.set(elt, !Ability.isActive(ability, unit));

        var comparativeDelay = Ability.VolleyCount.findGet(ability) - Ability.OgVolleyCount.findGet(ability);
        RoundPanelRow.Delayed.set(elt, comparativeDelay > 0);
        RoundPanelRow.Hastened.set(elt, comparativeDelay < 0);
    }

    static updateForUnit(elt, unit) {

        var tile = Grid.getEffectiveTile(unit);
        var block = CellBlock.findByLabel(unit, Unit.CellBlock.get(unit));
        FacingAttr.copy(elt, block);
        Unit.CellBlock.copy(elt, unit);
        RoundPanelRow.EffectivePosition.set(elt, tile);
        Unit.HoverOnUnit.set(elt, IdAttr.get(unit));
        HoverHelper.HoverHelp.set(elt, WoofType.buildSelectorFor(unit));

        var abilities = WoofType.queryAll(unit, "Ability");
        var abilitiesInvalidated = false;
        for (var i = 0; i < abilities.length; i++) {
            var ability = abilities[i];
            var volley = Ability.volley(ability);
            var abilityBox = RoundPanelRow.ForAbility.findDown(elt, IdAttr.get(ability));
            var volleyBox = RoundPanelRow.VolleyCount.findDown(elt, volley);
            if (abilityBox && abilityBox != volleyBox) {
                RoundPanelRow.VolleyCount.copy(volleyBox, abilityBox);
                RoundPanelRow.VolleyCount.set(abilityBox, volley)
                abilitiesInvalidated = true;
            }
            var box = abilityBox || volleyBox;

            RoundPanelRow.ForAbility.set(box, IdAttr.get(ability));
            RoundPanelRow.updateForAbility(box, ability, unit);
        }
        if (abilitiesInvalidated) {
            // Rearrange them.
            var children = RoundPanelRow.VolleyCount.findAll(elt);
            children.sort(function(a, b) {
                return RoundPanelRow.VolleyCount.get(a) - RoundPanelRow.VolleyCount.get(b);
            }).forEach(function(a) {
                elt.appendChild(a);
            });
        }
    }
}
Utils.classMixin(RoundPanelRow, AbstractDomController, {
    matcher: ".round_panel_row",
    template: "round_panel_row",
    params: emptyObjectFn
});
