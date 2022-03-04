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

class Direction {
    static Left = "left";
    static Right = "right";
    static Up = "up";
    static Down = "down";
    // Special case only here for making it easy to find all of these.
    static None = "local";
    
    static allDirections() {
        return [Direction.Left, Direction.Right, Direction.Up, Direction.Down];
    }

    static coordDelta(direction) {
        switch (direction) {
            case Direction.Left:
                return [-1, 0];
            case Direction.Right:
                return [1, 0];
            case Direction.Up:
                return [0, -1];
            case Direction.Down:
                return [0, 1];
            case Direction.None:
                return [0, 0];
        }
        throw boom("Unknown direction for delta-ing", direction);
    }
}

class EffectivePosition {    
    // These are facing up.
    static _coordToEffective = [
        ["F1", "F2", "F3"],
        ["M1", "M2", "M3"],
        ["B1", "B2", "B3"]];

    static _effectiveToCoord = {
        "F1": { "up": [0,0], "down": [2,2], "left": [0,2], "right": [2,0] },
        "F2": { "up": [1,0], "down": [1,2], "left": [0,1], "right": [2,1] },
        "F3": { "up": [2,0], "down": [0,2], "left": [0,0], "right": [2,2] },
        "M1": { "up": [0,1], "down": [2,1], "left": [1,2], "right": [1,0] },
        "M2": { "up": [1,1], "down": [1,1], "left": [1,1], "right": [1,1] },
        "M3": { "up": [2,1], "down": [0,1], "left": [1,0], "right": [1,2] },
        "B1": { "up": [0,2], "down": [2,0], "left": [2,2], "right": [0,0] },
        "B2": { "up": [1,2], "down": [1,0], "left": [2,1], "right": [0,1] },
        "B3": { "up": [2,2], "down": [0,0], "left": [2,0], "right": [0,2] }
    };

    /** For a given contextual direction ("F1"), expand to all the contextual versions ("left-F1", etc) */
    static expandToContextual(norm) {
        if (!Array.isArray(norm)) norm = [norm];
        return norm.map(function(n) {
            return Direction.allDirections().map(function(dir) {
                return EffectivePosition.normToContextual(dir, n)
            });
        }).flat();
    }

    /** For a given normal coordinate [0,0] and a direction, expand to the base contextual version (e.g. if up, "F1" */
    static normFromCoord(direction, coord) {
        switch (direction) {
            case Direction.Left:
                return EffectivePosition._coordToEffective[SmallCoord.x(coord)][2 - SmallCoord.y(coord)];
            case Direction.Right:
                return EffectivePosition._coordToEffective[2 - SmallCoord.x(coord)][SmallCoord.y(coord)];
            case Direction.Up:
                return EffectivePosition._coordToEffective[SmallCoord.y(coord)][SmallCoord.x(coord)];
            case Direction.Down:
                return EffectivePosition._coordToEffective[2 - SmallCoord.y(coord)][2 - SmallCoord.x(coord)];
        }
        throw boom("Unknown direction", direction);
    }

    /** From a coord [0,0], expand to the contextual coord ("up-F1") */
    static contextualFromCoord(direction, coord) {
        return EffectivePosition.normToContextual(direction,
                EffectivePosition.normFromCoord(direction, coord));
    }
    
    /** From a normal position ("F1"), make it contextual ("up-F1") */
    static normToContextual(direction, norm) {
        return direction + "-" + norm;
    }
    
    /**
     * From a normal position + dir ("F1", "up"), get the coord ([0,0]).
     * From a context position ("up-F1"), get the coord ([0,0])
     */
    static toCoord(effective, opt_direction) {      
        // If it's a contextual direction, parse it.
        if (effective.indexOf('-') > 0) {
            // We need to parse this.
            effective = effective.split('-');
            opt_direction = opt_direction || effective[0];
            effective = effective[1];
        }
        var returnMe = EffectivePosition._effectiveToCoord[effective][opt_direction];
        if (!returnMe) throw boom("Unknown direction", effective, opt_direction);
        return returnMe;
    }

    /**
     * From a coord ([0,0]), get all the effective positions it could be as a { direction: pos } map.
     */
    static directionMapFor(coord) {
        return Direction.allDirections().toObject(function(dir) {
            return dir;
        }, function(dir) {
            return EffectivePosition.normFromCoord(dir, coord)
        });
    }
}


class FacingAttr {
    static Left = "left";
    static Right = "right";
    static Up = "up";
    static Down = "down";
    static None = "none";

    static allDirections() {
        return [FacingAttr.Left, FacingAttr.Right, FacingAttr.Up, FacingAttr.Down];
    }

    static fromUnit(c) {

        if (c[0] == 0) {
            if (c[1] < 0) {
                return FacingAttr.Up;
            }
            if (c[1] > 0) {
                return FacingAttr.Down;
            }
        } else if (c[1] == 0) {
            if (c[0] < 0) {
                return FacingAttr.Left;
            }
            if (c[0] > 0) {
                return FacingAttr.Right;
            }
        }
        return FacingAttr.None;
    }

    static fromToWithEstimate(fromCoords, toCoords) {
        var delta = BaseCoord.minus({}, toCoords, fromCoords);
        var xDir = FacingAttr.fromUnit([Math.sign(delta[0]), 0]);
        var yDir = FacingAttr.fromUnit([0, Math.sign(delta[1])]);
        // Weird case 1: We are not pointing anywhere (from == to)
        if (xDir === FacingAttr.None && yDir === FacingAttr.None) return FacingAttr.None;
        // Weird case 2: Diagonal.  Favor X because computer screens are usually wider.
        if (Math.abs(delta[0]) === Math.abs(delta[1])) return xDir;
        if (Math.abs(delta[0]) > Math.abs(delta[1])) {
            return xDir;
        }
        return yDir;        
    }

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
    static SafeDistance = "AA"; // Special "active-in" value for nobody nearby.

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

    static getEffectiveTile(unit, opt_direction) {
        var coord = SmallCoord.extract(unit);
        var facing = opt_direction || Grid.getFacing(unit);
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

    static fromEffectiveToReal(block, positions, opt_facing) {
        var facing = opt_facing || Grid.getFacing(block);
        return positions.filter(function(label) {
            return Grid._effective[label] !== undefined;
        }).map(function(label) {
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

    static contextualLabelFor(thingElt, effective, opt_directionHint) {
        var screen = WoofType.findUp(thingElt, "Screen");
        var uberCoord = UberCoord.extract(thingElt);
        var block = CellBlock.findByCoord(screen, UberCoord.big(uberCoord));
        var cell = Cell.findByCoord(block, UberCoord.small(uberCoord));

        var smallCoord = SmallCoord.extract(thingElt);
        var cell = Cell.findByCoord(screen, smallCoord);
        var blockLabel = BigGridLabel.get(block);
        var cellLabel;
        if (effective) {
            // Effective position.
            var direction = opt_directionHint || Grid.getFacing(thingElt);
            cellLabel = Grid.getEffectiveTile(thingElt, direction);
        } else {
            // Literal position.
            cellLabel = SmallGridLabel.get(cell);
        }

        return (effective ? "E." : "L.") + blockLabel + "." + cellLabel;
    }

    static __expandLiteral = {
        'A': ['A1', 'A2', 'A3'],
        'B': ['B1', 'B2', 'B3'],
        'C': ['C1', 'C2', 'C3'],
        '1': ['A1', 'B1', 'C1'],
        '2': ['A2', 'B2', 'C2'],
        '3': ['A3', 'B3', 'C3']
    };

    static __expandEffective = {
        'F': ['F1', 'F2', 'F3'],
        'M': ['M1', 'M2', 'M3'],
        'B': ['B1', 'B2', 'B3'],
        '1': ['F1', 'M1', 'B1'],
        '2': ['F2', 'M2', 'B2'],
        '3': ['F3', 'M3', 'B3']
    };

    static expandContextualLabel(relativeTo, label, opt_directionHint) {
        var screen = WoofType.findUp(relativeTo, "Screen");
        var parts = label.split('.');
        if (parts.length != 3) return null; // Not a contextual label.
        // Parse part 1.
        var effective = parts[0] === 'E';
        // Resolve part 2;
        var blockOptions = parts[1].split(',');
        if (blockOptions.length == 1 && blockOptions[0] === "") {
            // No options?  Assume everything is fair game.
            blockOptions = CellBlock.findAll(screen).filter(block => !DisabledAttr.get(block));
        } else {
            blockOptions = blockOptions.map(label => CellBlock.findByLabel(screen, label));
        }

        var cellOptions = parts[2].split(',')
        if (cellOptions.length == 1 && cellOptions[0] === "") {
            // No options?  Assume everything is fair game again!
            cellOptions = effective ? ['F1', 'F2', 'F3', 'M1', 'M2', 'M3', 'B1', 'B2', 'B3'] : ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
        }
        cellOptions = cellOptions.flatMap(function(opt) {
            return (effective ? Grid.__expandEffective : Grid.__expandLiteral)[opt] || [opt];
        });

        return blockOptions.flatMap(block => {
            if (effective) {
                return Grid.fromEffectiveToReal(block, cellOptions, opt_directionHint || Grid.getFacing(block));
            }
            return cellOptions.map(label => Cell.findByLabel(block, label));
        });
    }

    static uberLabelFor(cell) {
        var cellLabel = SmallGridLabel.get(cell);
        var blockLabel = BigGridLabel.get(BigGridLabel.findUp(cell));
        return blockLabel + '.' + cellLabel;
    }

    static isUberLabel(label) {
        return label.indexOf('.') > 0;
    }

    static fromUberLabel(elt, label) {
        var labelParts = label.split('.');
        var block = CellBlock.findByLabel(elt, labelParts[0]);
        var cell = Cell.findByLabel(block, labelParts[1]);
        return cell;
    }

    static adjacentCells(cell) {
       var norm = NormCoord.extract(cell);
       var battlefield = matchParent(cell, WoofType.buildSelector("Battlefield"));

       return Direction.allDirections().map(function(dir) {
           var newCoord = NormCoord.plus(norm, Direction.coordDelta(dir));
           var uber = UberCoord.fromNorm(newCoord);    
           var block = CellBlock.findByCoord(battlefield, UberCoord.big(uber));
           if (!block) return null;
           return Cell.findByCoord(block, UberCoord.small(uber));
       }).filter(e => !!e);
    }

    static __memoize(coordFn) {
        var obj = {};
        return function(coord) {
            if (obj[coord[0]] === undefined || obj[coord[0]][coord[1]] === undefined) {
                var result = coordFn(coord);
                if (obj[coord[0]] === undefined) {
                    obj[coord[0]] = {};
                }
                obj[coord[0]][coord[1]] = result;
            }
            return obj[coord[0]][coord[1]];
        };
    }

    static pathTo(start, dest, okayFn, tileMultFn) {
        // Returns a path from the start to the dest while avoiding any locations in the avoid set.
        // Note: start and dest must be normUnits.
        var workQueue = [];
        var candidates = [];
        okayFn = Grid.__memoize(okayFn);
        tileMultFn = Grid.__memoize(tileMultFn);
        var maxDistance = NormCoord.distance(start, dest) * 2;
        var scoreFn = function(item) { return item.score; };
        var scoreCalc = function(previous, current) {
            var newScore = 0;
            var distance = NormCoord.minus(dest, current.coord);
            // Distance is the basis.
            newScore += Math.sqrt((distance[0] * distance[0]) + (distance[1] * distance[1]));
            if (previous.direction == current.direction) {
                // Minimize directional changes.
                newScore = newScore / 2;
            }
            // Add additional score here.
            newScore = newScore * tileMultFn(current.coord);
            // Append to previous because the score is the total path.
            return previous.score + newScore;
        }

        workQueue.push({
            score: 0,
            coord: start,
            direction: FacingAttr.None,
            path: [start],
            distance: 0
        });

        while (workQueue.length > 0) {
            var current = workQueue.shift();
            if (NormCoord.equals(current.coord, dest)) {
                candidates.priorityInsert(current, scoreFn);
                // Breakout heuristic: If we find several paths, that's good enough.
                if (candidates.length >= Math.max(1, Math.floor(maxDistance / 3))) {
                    break;
                }
            }
            // Early determination: We can't actually get there.
            var flatDistance = NormCoord.distance(current.coord, dest) + current.distance;
            if (flatDistance > maxDistance) continue;

            [FacingAttr.Up, FacingAttr.Left, FacingAttr.Down, FacingAttr.Right].map(function(dir) {
                return {
                    coord: FacingAttr.unitDelta(dir),
                    direction: dir 
                };
            }).map(function(delta) {
                return {
                    coord: NormCoord.plus(delta.coord, current.coord),
                    direction: delta.direction
                };
            }).filter(cand => {
                // Destination is always allowed.
                if (NormCoord.equals(cand.coord, dest)) return true;
                return okayFn(cand.coord);
            }).filter(function(cand) {
                // Filter out cycles.
                return !current.path.findFirst(function(item) {
                    return NormCoord.equals(cand.coord, item);
                });
            }).map(function(cand) {
                return {
                    score: scoreCalc(current, cand),
                    coord: cand.coord,
                    direction: cand.direction,
                    path: current.path.concat([cand.coord]),
                    distance: current.distance + 1
                }
            }).forEach(cand => workQueue.priorityInsert(cand, scoreFn));
        }

        if (candidates.length == 0) return null;
        // Optimal path (ish)!
        return candidates[0].path;
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
        if (!isElement(thing)) return thing;
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

    static toNorm(uc) {
        return [
            (uc[0][0] * 3) + (uc[1][0] % 3),
            (uc[0][1] * 3) + (uc[1][1] % 3)
        ];
    }

    static fromNorm(norm) {
        return [
            [Math.floor(norm[0] / 3), Math.floor(norm[1] / 3)],
            [norm[0] % 3, norm[1] % 3]
        ];
    }
}

class BaseCoord {
    static directionsOf(config, delta) {
        var xDist = Math.abs(delta[0]);
        var yDist = Math.abs(delta[1]);
        // No directions if the delta is 0.
        if (xDist == 0 && yDist == 0) return [];
        var toReturn = [];
        if (xDist > yDist) {
            toReturn.push(FacingAttr.fromUnit([delta[0], 0]));
            if (yDist > 0) {
                toReturn.push(FacingAttr.fromUnit([0, delta[1]]));
            }
        } else {
            toReturn.push(FacingAttr.fromUnit([0, delta[1]]));
            if (yDist > 0) {
                toReturn.push(FacingAttr.fromUnit([delta[0], 0]));
            }
        }

        return toReturn;
    }

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

    static orthoLength(config, coord) {
        return Math.abs(coord[0]) + Math.abs(coord[1]);
    }

    static diagLength(config, coord) {
        return Math.max(Math.abs(coord[0]), Math.abs(coord[1]));
    }

    static clone(config, coord) {
        return [
            coord[0], coord[1]
        ];
    }

    static sign(config, coord) {
        return [Math.sign(coord[0]), Math.sign(coord[1])];
    }

    static x(config, coord) {
        return coord[0];
    }

    static y(config, coord) {
        return coord[1];
    }

    static onlyX(config, coord) {
        return [coord[0], 0];
    }

    static onlyY(config, coord) {
        return [0, coord[1]];
    }
}

class NormCoord {
    static extract(cell) {
        return UberCoord.toNorm(UberCoord.extract(cell));
    }
}
Utils.classMixin(NormCoord, BaseCoord, {
    x: null,
    y: null
})


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
        return qsa(elt, "[wt~='CellBlock'][team='" + team + "']");
    }

    static findByRef(elt, otherElt) {
        return CellBlock.findByCoord(elt, BigCoord.extract(otherElt));
    }

    static findByCoord(elt, coords) {
        return qs(elt, CellBlock.coordSelector(coords));
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

    // TODO: Remove?
    static findEnabled(elt) {
        return qsa(elt, "");
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
            "LAY-BOH": label,
            "ODDNESS": (x + y) % 2
        }
    },
    decorate: function(fragment, x, y, label) {
        // Micro Grid
        var microRowLabelCode = "A".charCodeAt(0);
        for (var k = 0; k < 3; k++) {
            var microRow = Templates.inflateIn("smolrow", fragment);
            for (var l = 0; l < 3; l++) {
                var cell = Cell.inflateIn(microRow, l, k, String.fromCharCode(microRowLabelCode) + (l + 1));        
                Cell.__populateEffectivePositions(cell);
            }
            microRowLabelCode += 1;
        }
    }
});



class Cell {
    static EffectivePositions = new ScopedAttr("effective-positions", ListAttr);

    static __populateEffectivePositions(cell) {
        var coord = SmallCoord.extract(cell);
        var map = EffectivePosition.directionMapFor(coord);
        Cell.EffectivePositions.set(cell, map.toArray(function(k, v) {
            return EffectivePosition.normToContextual(k, v);
        }));
    }

    static findAllInBlock(block) {
        return qsa(block, "[wt~='Cell']");
    }


    static findByCoord(elt, coords) {
        return qs(elt, "[wt~='Cell'][smol-x='" + coords[0] + "'][smol-y='" + coords[1] + "']");
    }

    static findByLabel(elt, label) {
        return qs(elt, "[wt~='Cell'][smol-label='" + label + "']")
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