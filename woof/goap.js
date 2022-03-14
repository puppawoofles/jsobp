/** A JS implementation of Goal Oriented Action Planning. */

class Goap {

    static BaseEvalFor(requirement) {
        return {
            req: requirement,
            name: Goap.N.get(requirement),
            id: IdAttr.generate(requirement),
            solved: true,
            options: []
        };
    }

    static AddEvalOption(ev, option, cost) {
        ev.options.push({
            data: option,
            cost: cost
        });
    }

    static MarkBlocked(ev, opt_blocked) {
        if (opt_blocked === undefined) {
            ev.solved = false;
        } else {
            ev.solved = !opt_blocked;
        }
    }

    /**
     * This is what <goap-data eval-fn="this"> should return. 
     */
    static Eval(requirement, needsToBeSolved, options) {
        return {
            req: requirement,
            name: Goap.N.get(requirement),
            id: IdAttr.generate(requirement),
            solved: !needsToBeSolved,
            options: options || []
        }
    }

    static GoalName = new ScopedAttr("goal-name", StringAttr);
    static GoalParams = new ScopedAttr("goal-params", BlobAttr);
    static EvalFn = new ScopedAttr("eval-fn", FunctionAttr);
    static N = new ScopedAttr("n", StringAttr);
    static ExpandFn = new ScopedAttr("expand-fn", FunctionAttr);

    static __precached = false;
    static __commonNodes = {};
    static __data = {};
    static __precache() {
        if (Goap.__precached) return;
        var nodes = fa('goap-global goap-node');
        var data = fa('goap-global goap-data');

        var expectedDataTypes = {};
        nodes.forEach(function(node) {
            qsa(node, 'req[n]').forEach(function(req) {
                expectedDataTypes[Goap.N.get(req)] = true;
            });
            qsa(node, 'res[n]').forEach(function(res) {
                expectedDataTypes[Goap.N.get(res)] = true;
            });
        });

        data = data.toObject(Goap.N.get);

        var foundKeys = Object.keys(data);
        var expectedKeys = Object.keys(expectedDataTypes);
        if (foundKeys.length < expectedKeys) {
            // Let's find our mismatch.
            var missing = expectedDataTypes.filter(function(t) {
                return !!data[t];
            });

            throw boom("Mismatch in found GOAP keys and expected GOAP keys", missing);
        }
        Goap.__data = data;
        Goap.__commonNodes = nodes.toObject(Goap.N.get);
        Goap.__precached = true;
    }

    static _commonNodes() {
        Goap.__precache();
        return Goap.__commonNodes.clone();
    }

    static _data() {
        Goap.__precache();
        return Goap.__data.clone();
    }

    /**
     * Runs the thing, invokes the actions.
     */
    static goap(goalNode, contextElt) {
        // First, figure out all of our nodes.  Start with common.
        var nodes = Goap._commonNodes();
        var data = Goap._data();

        // Add our context-specific nodes (which might override common nodes!)
        qsa(contextElt, 'goap-node').forEach(function(node) {
            nodes[Goap.N.get(node)] = node;
        });        

        // Figure out what resolves what so we can get all these queries out of the way.
        var resolve = {};
        var require = {};
        for (var [key, value] of Object.entries(nodes)) {
            qsa(value, 'res').forEach(function(res) {
                var name = Goap.N.get(res);
                if (!resolve[name]) resolve[name] = [];
                resolve[name].push(key);
            });

            // Note down our reqs, which might be parameterized, so we
            // can't just use their names.
            require[key] = qsa(value, 'req');
        }

        // Starting from our main goal.
        var params = Goap.GoalParams.get(goalNode) || {};

        /**
         * TODO: You were here before groceries.  The real issue is you want to
         * be able to plumb the full walk of requirements that led you to a given
         * destination or action from the root. That will allow you to map a given
         * action's parameters back to the real thing that triggered it.
         * Maybe that's just for attempt #2, and you should stick with your current
         * thing of updating params as you go.
         */




        /**
         * Each item in this work queue represents a unique walk on the path, along with
         * the current members of its breadth-first search.
         * 
         * When an item has no more [nodes] left, it goes in options.
         */

        var toEvaluate = [{
            nodes: [{
                // The evaluated requirement.  Null for this first one.
                evalReq: null,
                // The data item from evaluating the requirement.  Null for the first one too.
                data: null,
                // The actual node we're evaluating.
                node: goalNode,
                // The requirements of said node.
                reqs: qsa(goalNode, 'req'),
                // The params for this subtree.
                params: params,
                // The cost of this specific node (as opposed to the total cost of this walk)
                cost: 0
            }],
            cost: 0,

            // A reverse-order list of actions we can take based on our walk.  Later items
            // will be from deeper requirements, and should be prioritized.
            actions: []
        }];
        var options = [];

        while (toEvaluate.length > 0) {
            var currentWalk = toEvaluate.shift();
            if (currentWalk.nodes.length == 0) {
                // Base case: We have terminated a requirement pass.
                options.push(currentWalk);
                continue;
            }

            // Add the current cost to this walk.  We eventually use this to decide
            // our best option.
            var currentProblem = currentWalk.nodes.shift();
            params = currentProblem.params;
            var currentNode = currentProblem.node;
            Logger.info("Currently evaluating", Goap.N.get(currentNode));            
            currentWalk.cost += currentProblem.cost;
            currentWalk.actions.extend(qsa(currentNode, 'goap-action').map(function(action) {
               return {
                   action: action,
                   data: params
               };
            }));

            // First, check if we can even resolve the listed issues.
            var unsolvable = currentProblem.reqs.filter(function(req) {
                return resolve[Goap.N.get(req)].length == 0;
            });
            if (unsolvable.length > 0) {
                // Bail out if we can't solve the requirements listed because 
                // there isn't an available node for doing so.
                Logger.info(contextElt, "can't solve", unsolvable);
                continue;
            }

            // In theory, it's possible to resolve all of these nodes, so first, we
            // want to map them to their evaluated result.
            var evald = currentProblem.reqs.map(function(req) {
                return Goap.EvalFn.invoke(data[Goap.N.get(req)], req, params, contextElt);
            }).filter(function(evalReq) {
                if (evalReq.solved) Logger.info(contextElt, "already solved", evalReq.req);
                return !evalReq.solved;
            });

            var noOptions = evald.filter(function(evalReq) {
                return evalReq.options.length == 0;
            });
            if (noOptions.length > 0) {
                Logger.info(contextElt, "has no valid options for", noOptions);
                continue;
            }

            // Each of the evaluated options at this point has a node to resolve it,
            // and there is a set of data options for fulfilling it.  Let's gooooo.
            // We want to basically do a cross-product here for each requirement pairing
            // up a node + a data option.

            var candidateOptions = {};

            // For each of our requirements...
            for (var evalReq of evald) {
                // For each possible node that resolves it...
                candidateOptions[evalReq.id] = [];
                for (var nodeName of resolve[evalReq.name]) {
                    // For each of our possible data options...
                    var nodeOption = nodes[nodeName];
                    for (var dataOption of evalReq.options) {
                        // Check for requirements.
                        var reqs = require[nodeName] || [];
                        if (Goap.ExpandFn.has(nodeOption)) {
                            // This one has expanded requirements based on its
                            // data inputs, so we should add those in.
                            // We use this to evaluate move requirements.
                            reqs = reqs.concat(Goap.ExpandFn.invoke(nodeOption, nodeOption, evalReq.req, dataOption.data, contextElt));
                        }
                        var newParams = params.clone();
                        Object.assign(newParams, dataOption.data);

                        // Store it as an option.
                        candidateOptions[evalReq.id].push({
                            evalReq: evalReq,
                            node: nodeOption,
                            data: dataOption,
                            reqs: reqs,
                            params: newParams,
                            cost: dataOption.cost
                        });
                    }
                }
            }

            // So now what we have is:
            // - An (ordered!) array of evaluated requirements.
            // - A set of possible solutions for each of those requirements.
            // We now basically need to find every permutation of those solutions to those requirements.
            // TODO: we may want to do some pruning at this stage, since this is where the tree could explode.
            // E.g. if I have 10 different location options and 15 different moves, that's 150 options to consider.

            var permutations = [];
            for (var evalReq of evald) {
                // We can't really multiply this against nothing, so this is
                // the base case.
                if (permutations.length == 0) {
                    permutations = candidateOptions[evalReq.id].map(function(opt) {
                        return [opt];
                    });
                    continue;
                }
                var perm = [];
                for (var p of permutations) {
                    for (var opt of candidateOptions[evalReq.id]) {
                        var n = p.clone();
                        n.push(opt);
                        perm.push(n);                        
                    }
                }
                permutations = perm;
            }
            // If we have no permutations, we had no requirements to fulfill.  Neat!
            // Let's just add it and move on.
            if (permutations.length == 0) {
                toEvaluate.push(currentWalk.clone());
            }

            // Each of these permutations creates a new branch of our requirements, which
            // translates into a new walk.
            permutations.forEach(function(perm) {
                var next = currentWalk.clone();                
                next.nodes.extend(perm);
                toEvaluate.push(next);
            });
        }

        var chosen = options.sort(function(a, b) { return a.cost - b.cost; })[0];

        // TODO: Don't just return this thing, but you're testing graph algorithms for now.
        return chosen;
    }



}