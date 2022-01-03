class BigXAttr {}
Utils.classMixin(BigXAttr, IntAttr, "beeg-x");
class BigYAttr {}
Utils.classMixin(BigYAttr, IntAttr, "beeg-y");
class BigGridLabel{}
Utils.classMixin(BigGridLabel, StringAttr, 'beeg-label');
class SmallXAttr {}
Utils.classMixin(SmallXAttr, IntAttr, "smol-x");
class SmallYAttr {}
Utils.classMixin(SmallYAttr, IntAttr, "smol-y");
class SmallGridLabel{}
Utils.classMixin(SmallGridLabel, StringAttr, 'smol-label');
class FacingAttr {
    static Left = "left";
    static Right = "right";
    static Up = "up";
    static Down = "down";
    static None = "none";

    static fromTo(fromCoords, toCoords) {
        var x = fromCoords[0] - toCoords[0];
        var y = fromCoords[1] - toCoords[1];
        if (x == 0) {
            if (y == 1) {
                return FacingAttr.Up;
            }
            if (y == -1) {
                return FacingAttr.Down;
            }
        }
        if (y == 0) {
            if (x == 1) {
                return FacingAttr.Left;
            }
            if (x == -1) {
                return FacingAttr.Right;
            }
        }
        return FacingAttr.None;
    }

    static opposite(base) {
        switch (base) {
            case FacingAttr.Left:
                return FacingAttr.Right;
            case FacingAttr.Right:
                return FacingAttr.Left;
            case FacingAttr.Up:
                return FacingAttr.Down;
            case FacingAttr.Down:
                return FacingAttr.Up;
        }
        return FacingAttr.None;
    }

    static unitDelta(direction) {
        switch (direction) {
            case FacingAttr.Left:
                return [-1, 0];
            case FacingAttr.Right:
                return [1, 0];
            case FacingAttr.Up:
                return [0, -1];
            case FacingAttr.Down:
                return [0, 1];
        }
        return [0, 0];
    }
}
Utils.classMixin(FacingAttr, StringAttr, "facing");


class Grid {
    static CloseCombat = "CC"; // Special "active-in" value for enemies inside the same block.
    static _setup = [
        ["F1", "F2", "F3"],
        ["M1", "M2", "M3"],
        ["B1", "B2", "B3"],
    ];

    static _effective = {
        "F1": [0,0],
        "F2": [1,0],
        "F3": [2,0],
        "M1": [0,1],
        "M2": [1,1],
        "M3": [2,1],
        "B1": [0,2],
        "B2": [1,2],
        "B3": [2,2]
    }

    static getEffectiveTile(unit) {
        var coord = SmallCoord.extract(unit);
        var facing = Grid.getFacing(unit);
        switch (facing) {
            case FacingAttr.Left:
                return Grid._setup[SmallCoord.x(coord)][2 - SmallCoord.y(coord)];
            case FacingAttr.Right:
                return Grid._setup[2 - SmallCoord.x(coord)][SmallCoord.y(coord)];
            case FacingAttr.Up:
                return Grid._setup[SmallCoord.y(coord)][SmallCoord.x(coord)];
            case FacingAttr.Down:
                return Grid._setup[2 - SmallCoord.y(coord)][2 - SmallCoord.x(coord)];
        }
        return "None";
    }

    static getSmallCoordFor(effective, facing) {
        return SmallCoord.rotate(Grid._effective[effective], facing);
    }

    static fromEffectiveToReal(block, positions) {
        var facing = Grid.getFacing(block);
        return positions.map(function(label) {
            return SmallCoord.rotate(Grid._effective[label], facing);
        });
    }

    static getBlockIn(from, facing) {
        var grid = WoofType.find(from, "Grid");
        var currentCoord = BigCoord.extract(from);
        switch (facing) {
            case FacingAttr.Left:
                currentCoord[0] -= 1;
                break;
            case FacingAttr.Right:
                currentCoord[0] += 1;
                break;
            case FacingAttr.Up:
                currentCoord[1] -= 1;
                break;
            case FacingAttr.Down:
                currentCoord[1] += 1;
                break;
        }

        return CellBlock.findByCoord(grid, currentCoord) || null;

    }

    static getTargetBlock(unit) {
        var grid = WoofType.find(unit, "Grid");
        var currentCoord = BigCoord.extract(unit);
        var bigCell = CellBlock.findByCoord(grid, currentCoord);
        var facing = FacingAttr.get(bigCell) || FacingAttr.None;
        return Grid.getBlockIn(bigCell, facing);
    }

    static getFacing(unit) {
        if (FacingAttr.has(unit)) {
            return FacingAttr.get(unit);
        }
        var bigCell = CellBlock.findByContent(unit);
        return FacingAttr.get(bigCell) || FacingAttr.None;
    }

    static EffectivePosition = new ScopedAttr("effective-position", StringAttr);
    static OnCellBlockFacingChange(event, handler) {
        Grid.ResetEffectivePositions(event.target);
    }

    static ResetEffectivePositions(block) {
        var cells = Cell.findAllInBlock(block);
        cells.forEach(function(cell) {
            Grid.EffectivePosition.set(cell, Grid.getEffectiveTile(cell));
        });
    }
}
WoofRootController.register(Grid);

class UberCoord {
    static small(value) {
        return SmallCoord.from(value[1][0], value[1][1]);
    }
    
    static big(value) {
        return BigCoord.from(value[0][0], value[0][1]);
    }
    
    static from(big, small) {
        return [big, small];
    }

    static extract(thing) {
        return UberCoord.from(BigCoord.extract(thing), SmallCoord.extract(thing));
    }

    static selector(uberCoord) {
        return BigCoord.selector(UberCoord.big(uberCoord)) + SmallCoord.selector(UberCoord.small(uberCoord));
    }

    static toString(uberCoord) {
        var big = UberCoord.big(uberCoord);
        var small = UberCoord.small(uberCoord);
        return '[' + big[0] + ',' + big[1] + '][' + small[0] + ',' + small[1] + ']';
    }
}

class BaseCoord {
    static extract(config, cell) {
        return [
            config.x.get(cell), config.y.get(cell)
        ]
    }

    static equals(config, a, b) {
        return a[0] == b[0] && a[1] == b[1];
    }

    static write(config, elt, coords) {
        config.x.set(elt, coords[0]);
        config.y.set(elt, coords[1]);
    }

    static from(config, x, y) {
        return [x, y];
    }

    static selector(config, coords) {
        return config.x.selector(coords[0]) + config.y.selector(coords[1]);
    }

    static minus(config, a, b) {
        return [
            a[0] - b[0],
            a[1] - b[1]
        ];
    }

    static plus(config, a, b) {
        return [
            a[0] + b[0],
            a[1] + b[1]
        ];
    }

    static plusDirection(config, a, direction) {
        return BaseCoord.plus(config, a, FacingAttr.unitDelta(direction));
    }

    static distance(config, a, b) {
        return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    }

    static diagDistance(config, a, b) {
        return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    }

    static clone(config, coord) {
        return [
            coord[0], coord[1]
        ];
    }
}

class BigCoord {
    static extract(cell) {
        var x = BigXAttr.get(cell);
        var y = BigYAttr.get(cell);
        if (isNaN(x) || isNaN(y)) {
            // This might be a cell.
            var realElt = BigXAttr.findUp(cell);
            x = BigXAttr.get(realElt);
            y = BigYAttr.get(realElt);
        }
        return [x, y];
    }

    static equals(a, b) {
        return a[0] == b[0] && a[1] == b[1];
    }

    static write(elt, coords) {
        BigXAttr.set(elt, coords[0]);
        BigYAttr.set(elt, coords[1]);
    }

    static from(x, y) {
        return [x, y];
    }

    static selector(coords) {
        if (isElement(coords)) {
            coords = BigCoord.extract(coords);
        }
        return BigXAttr.selector(coords[0]) + BigYAttr.selector(coords[1]);
    }
}
Utils.classMixin(BigCoord, BaseCoord, {
    x: BigXAttr,
    y: BigYAttr
})

class SmallCoord {    
    static extract(cell) {
        return [
            SmallXAttr.get(cell), SmallYAttr.get(cell)
        ]
    }

    static distance(a, b) {
        return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    }

    static write(elt, coords) {
        SmallXAttr.set(elt, coords[0]);
        SmallYAttr.set(elt, coords[1]);
    }

    static from(x, y) {
        return [x, y];
    }

    static selector(coords) {
        return SmallXAttr.selector(coords[0]) + SmallYAttr.selector(coords[1]);
    }

    static label(coords) {
        return 'a'.getCharCode
    }

    static x(coord) {
        return coord[0];
    }

    static y(coord) {
        return coord[1];
    }

    static rotate(coord, facing) {
        switch (facing) {
            case FacingAttr.Up:
                return coord;
            case FacingAttr.Down:
                return [2 - coord[0], 2 - coord[1]];
            case FacingAttr.Right:
                return [2 - coord[1], coord[0]];
            case FacingAttr.Left:
                return [coord[1], 2 - coord[0]];
        }
        return coord;
    }

    // This goes to [EffectiveColumn, EffectiveRow]!!
    static normalize(coord, facing) {
        switch(facing) {
            // 0,0 => 0,0 | 1,0 => 1,0 | 2,0 => 2,0
            // 0,1 => 0,1 | 1,1 => 1,1 | 2,1 => 2,1
            // 0,2 => 0,2 | 1,2 => 1,2 | 2,2 => 2,2
            case FacingAttr.Up:
                return coord;
            // 0,0 => 2,2 | 1,0 => 1,2 | 2,0 => 0,2
            // 0,1 => 2,1 | 1,1 => 1,1 | 2,1 => 0,1
            // 0,2 => 2,0 | 1,2 => 1,0 | 2,2 => 0,0
            case FacingAttr.Down:
                return [2 - coord[0], 2 - coord[1]];
            // 0,0 => 0,2 | 1,0 => 0,1 | 2,0 => 0,0
            // 0,1 => 1,2 | 1,1 => 1,1 | 2,1 => 1,0
            // 0,2 => 2,2 | 1,2 => 2,1 | 2,2 => 2,0
            case FacingAttr.Right:
                return [coord[1], 2 - coord[0]];
            // 0,0 => 2,0 | 1,0 => 2,1 | 2,0 => 2,2
            // 0,1 => 1,0 | 1,1 => 1,1 | 2,1 => 1,2
            // 0,2 => 0,0 | 1,2 => 0,1 | 2,2 => 0,2
            case FacingAttr.Left:
                return [2 - coord[1], coord[0]];
        }
        return coord;
    }

    static mirror(coord) {
        return [coord[0], 2 - coord[1]];
    }
}
Utils.classMixin(SmallCoord, BaseCoord, {
    x: SmallXAttr,
    y: SmallYAttr
})

class GridGenerator {
    static generate(elt, x, y) {
        
        // Macro Grid
        var macroRowLabelCode = "A".charCodeAt(0);
        for (var i = 0; i < y; i++) {
            var macroRow = Templates.inflateIn("beegrow", elt);
            for (var j = 0; j < x; j++) {
                CellBlock.inflateIn(macroRow, j, i, String.fromCharCode(macroRowLabelCode) + (j + 1));
            }
            macroRowLabelCode += 1;
        }
    }
}


class CellBlock {

    static findByContent(content) {
        var bigCoord = BigCoord.extract(content);
        if (isNaN(bigCoord[0]) || isNaN(bigCoord[1])) {
            // Likely a cell.  Look up!
            return CellBlock.findUp(content);
        } else {
            return Utils.bfind(content, 'html', CellBlock.coordSelector(bigCoord));
        }
    }

    static findAllByTeam(elt, team) {
        return elt.querySelectorAll("[wt~='CellBlock'][team='" + team + "']");
    }

    static findByRef(elt, otherElt) {
        return CellBlock.findByCoord(elt, BigCoord.extract(otherElt));
    }

    static findByCoord(elt, coords) {
        return elt.querySelector(CellBlock.coordSelector(coords));
    }

    static findByLabel(elt, label) {
        return Utils.bfind(elt, "[wt~=Battlefield]", "[wt~='CellBlock'][beeg-label='" + label + "']");
    }

    static labelSelector(label) {
        return "[wt~='CellBlock'][beeg-label='" + label + "']";
    }

    static coordSelector(coords) {
        return "[wt~='CellBlock'][beeg-x='" + coords[0] + "'][beeg-y='" + coords[1] + "']";
    }

    static findEnabled(elt) {
        return elt.querySelectorAll("");
    }

    static findFacing(block, opt_direction) {
        var facing = opt_direction || FacingAttr.get(block);
        var bigCoord = BigCoord.extract(block);
        switch (facing) {
            case FacingAttr.Up:
                bigCoord[1] -= 1;
                break;
            case FacingAttr.Down:
                bigCoord[1] += 1;
                break;
            case FacingAttr.Left:
                bigCoord[0] -= 1;
                break;
            case FacingAttr.Right:
                bigCoord[0] += 1;
                break;
            default:
                return null;
        }
        return CellBlock.findByCoord(WoofType.find(block, "Grid"), bigCoord);
    }

}
Utils.classMixin(CellBlock, AbstractDomController, {
    matcher: "[wt~='CellBlock']",
    template: "beegcell",
    params: function(x, y, label) {
        return {
            "X-LU": x,
            "Y-LU": y,
            "LAY-BOH": label
        }
    },
    decorate: function(fragment, x, y, label) {
        // Micro Grid
        var microRowLabelCode = "A".charCodeAt(0);
        for (var k = 0; k < 3; k++) {
            var microRow = Templates.inflateIn("smolrow", fragment);
            for (var l = 0; l < 3; l++) {
                Cell.inflateIn(microRow, l, k, String.fromCharCode(microRowLabelCode) + (l + 1));        
            }
            microRowLabelCode += 1;
        }
    }
});



class Cell {
    static findAllInBlock(block) {
        return Array.from(block.querySelectorAll("[wt~='Cell']"));
    }


    static findByCoord(elt, coords) {
        return elt.querySelector("[wt~='Cell'][smol-x='" + coords[0] + "'][smol-y='" + coords[1] + "']");
    }

    static findByLabel(elt, label) {
        return elt.querySelector("[wt~='Cell'][smol-label='" + label + "']")
    }

    static uberCoord(cell) {
        var block = CellBlock.findUp(cell);
        return UberCoord.from(BigCoord.extract(block), SmallCoord.extract(cell));
    }
    
}
Utils.classMixin(Cell, AbstractDomController, {
    matcher: "[wt~='Cell']",
    template: "smolcell",
    params: function(x, y, label) {
        return {
            "X-LU": x,
            "Y-LU": y,
            "LAY-BOH": label
        }
    }
});