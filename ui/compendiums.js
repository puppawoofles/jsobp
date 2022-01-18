class Compendiums {

    static __renderDefault(parent, infoPanel) {
        Utils.moveChildren(infoPanel.cloneNode(true), parent);
    }

    static __findOrDefault(parent, infoPanel, selector, cloneFound) {
        var toReturn;
        try {
            toReturn = bf(parent, selector);
        } catch (e) { /* Swallow */ }

        if (!toReturn) {
            Compendiums.__renderDefault(parent, infoPanel);
        }
        if (toReturn && cloneFound) {
            toReturn = toReturn.cloneNode(true);
            IdAttr.eraseRecursive(toReturn);
        }
        return toReturn;
    }

    static RenderUnit(parent, infoPanel, path, hash) {
        var unit = Compendiums.__findOrDefault(parent, infoPanel, hash, true);
        if (!unit) return;
        var content = Templates.inflate(qs(infoPanel, 'template'));
        qs(content, '.unit_container').appendChild(unit);
        parent.appendChild(content);
    }

    static RenderPreparation(parent, infoPanel, path, hash) {
        var thing = Compendiums.__findOrDefault(parent, infoPanel, hash, true);
        if (!thing) return;
        var content = Templates.inflate(qs(infoPanel, 'template'));
        qs(content, '.compendium_view').appendChild(thing);
        parent.appendChild(content);
    }

    static RenderAssignment(parent, infoPanel, path, hash) {
        var thing = Compendiums.__findOrDefault(parent, infoPanel, hash, true);
        if (!thing) return;
        var content = Templates.inflate(qs(infoPanel, 'template'));
        qs(content, '.compendium_view').appendChild(thing);
        parent.appendChild(content);
    }


}
WoofRootController.register(Compendiums);