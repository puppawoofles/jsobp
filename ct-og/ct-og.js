/** Note: Must all be lower case! */
ConsoleCommands.register("echo", function(handler, params) {
	var attr = handler.getAttribute('console-selector');		
	var consoleElts = !!attr ? handler.querySelectorAll(attr) : [handler];
	for (var i = 0; i < consoleElts.length; i++) {
		TestConsole.PostMessage(consoleElts[i], params);
	}
});

ConsoleCommands.register("spawn", function(handler, params) {
	var parsed = ConsoleCommandUtils.parseParams(params);
	var icon = Emoji[parsed.icon || 'GOOD_BOY'];
	
	var battlefields = Battlefield.find(handler);
	for (var i = 0; i < battlefields.length; i++) {
		var coordinate = Coordinate.normalize(battlefields[i], parsed.target || '0,0');
		var unit = Unit.create({
			'APPEARANCE': icon
		});
		Battlefield.addUnitTo(battlefields[i], unit, coordinate);
	}		
});

ConsoleCommands.register("testparseparams", function(handler, params) {
	var actualParams = ConsoleCommandUtils.parseParams(params);
	Logger.info("Parsed params", actualParams);
});

ConsoleCommands.register("move", function(handler, params) {
	var battlefields = Battlefield.find(handler);
	var coords = params.split(" ");
	for (var i = 0; i < battlefields.length; i++) {
		var parsed1 = Coordinate.fromBattlefieldLabel(battlefields[i], coords[0]) || Coordinate.fromString(coords[0]);
		var parsed2 = Coordinate.fromBattlefieldLabel(battlefields[i], coords[1]) || Coordinate.fromString(coords[1]);
		if (parsed1 && parsed2) {
			Battlefield.moveFromTo(battlefields[i], parsed1, parsed2);
		}			
	}		
});

ConsoleCommands.register("performaction", function(handler, params) {
	var split = params.split(' ');
	var action = split.shift();
	if (!Actions.hasOwnProperty(action) ||
			typeof(Actions[action]) != 'function') {
		// This isn't an action.
		Logger.warn("Unknown Action", action);
		return;
	}
	
	var parsedParams = ConsoleCommandUtils.parseParams(split);
	var battlefields = Battlefield.find(handler);
	for (var i = 0; i < battlefields.length; i++) {
		Actions[action](battlefields[i], parsedParams);			
	}
});

ConsoleCommands.register("targetaction", function(handler, params) {
	var split = params.split(' ');
	var action = split.shift();
	if (!ActionTargetSelector.hasOwnProperty(action) ||
			typeof(Actions[action]) != 'function') {
		// This isn't an action.
		Logger.warn("Don't know how to target", action);
		return;
	}
	TargetController.clearTarget(handler);
	
	var parsedParams = ConsoleCommandUtils.parseParams(split);
	var battlefields = Battlefield.find(handler);
	for (var i = 0; i < battlefields.length; i++) {
		var result = ActionTargetSelector[action](battlefields[i], parsedParams);
		var cells = result.map(coord => Battlefield.findCell(battlefields[i], coord));
		TargetController.addTargets(battlefields[i], cells, "broken", parsedParams.controller || "EncounterController.SelectTargetForPlayerAction");
	}
});

ConsoleCommands.register("cleartarget", function(handler, params) {
	TargetController.clearTarget(handler);
});

ConsoleCommands.register("setactiveunit", function(handler, params) {
	// Clear the previous.
	var parsedParams = ConsoleCommandUtils.parseParams(params);
	var active = Unit.findActive(handler);
	if (active) Unit.setActive(unit, false);
	// Find the new.
	var battlefields = Battlefield.find(handler);
	for (var i = 0; i < battlefields.length; i++) {
		var unit = Unit.findAt(battlefields[i], Coordinate.normalize(battlefields[i], parsedParams.subject));
		if (unit) Unit.setActive(unit, true);
	}
});

ConsoleCommands.register("endturn", function(handler, params) {
	BoardEffects.endTurn(handler);
});

ConsoleCommands.register("create", function(handler, params) {
	var split = params.split(' ');
	var type = split.shift();
	if (CreateFromConsole.hasOwnProperty(type)
			&& typeof(CreateFromConsole[type]) == 'function') {
		var mergedParams = split.join(' ');
		CreateFromConsole[type](handler, mergedParams);					
	}		
});

ConsoleCommands.register("setup", function(handler, params) {
	params = params || '';
	var split = params.split(' ');
	var type = split.shift();
	var mergedParams = split.join(' ');
	if (!type) {
		Logger.info("Using default setup");
		TestSetup.__default(handler);
		return;
	}
	if (TestSetup.hasOwnProperty(type)
			&& typeof(TestSetup[type]) == 'function') {
		TestSetup[type](handler, mergedParams);					
	}
});

ConsoleCommands.register("reset", function(handler, params) {
	TestSetup.__reset(handler);
});

ConsoleCommands.register("draw", function(handler, params) {
	var count = !!params ? parseInt(params) : 1;
	while (count-- > 0) {
		CardRules.drawInto(CardHud._findHandContent(handler), PLAYER_TEAM);
	}
});

ConsoleCommands.register("discard", function(handler, params) {
	var cards = CardHud.findSelectedCards(handler);
	CardHud.discardCards(cards);
});

ConsoleCommands.register("takedamage", function(handler, params) {
	params = params.split(' ');		
	var label = params[0];
	var count = !!params[1] ? parseInt(params[1]) : 1;
	var battlefield = Battlefield.find(handler);		
	var unit = Unit.findAt(battlefield, Coordinate.normalize(battlefield, label));

	if (!unit) {
		Logger.err("No unit found", label);
		return;
	}
	
	var queue = EffectQueue.findUp(unit);
	while (count-- > 0) {
		GameEffect.enqueue(queue, GameEffect.create('TakeDamage', {
			target: UnitIdAttr.get(unit),
			amount: 6
		}));		
	}
});

ConsoleCommands.register("walk", function(handler, params) {
	var battlefield = Battlefield.find(handler);		
	params = params.split(' ').map(label => Coordinate.normalize(battlefield, label));
	var unit = Unit.findAt(battlefield, params[0]);
	if (!unit) {
		Logger.err("No unit at", params[0]);
		return;
	}
	
	var queue = EffectQueue.findUp(unit);
	GameEffect.enqueue(queue, GameEffect.create("WalkUnit", {
		target: UnitIdAttr.get(unit),
		path: params,
		budget: params.length
	}));
});

ConsoleCommands.register("delay", function(handler, params) {
	var battlefield = Battlefield.find(handler);		
	params = params.split(' ');
	var amount = params[0];
	if (params[0] != "start" && params[0] != "end") {
		amount = parseInt(amount);
	}
	
	params = params.slice(1).map(label => Coordinate.normalize(battlefield, label)).map(coord => Unit.getId(Unit.findAt(battlefield, coord)));

	var queue = EffectQueue.findUp(Unit.findById(battlefield, params[0]));
	GameEffect.enqueue(queue, GameEffect.create("DelayAll", {
		targets: params,
		amount: amount
	}));
});

class CreateFromConsole {
	static battlefield(handler, params) {
		var parsedParams = ConsoleCommandUtils.parseParams(params);
		var container = EncounterScreenHandler.findBattleContainer(handler);
		if (!container) return Logger.err("Couldn't find battlefield container");
		
		Utils.clearChildren(container);
		
		Battlefield.create(container, parsedParams);		
	}
}


class CardIdsAttr{}
Utils.classMixin(CardIdsAttr, ListAttr, "card-ids");

class CardIdAttr{}
Utils.classMixin(CardIdAttr, GenericIdAttr, "card-id");

class TeamIdAttr{}
Utils.classMixin(TeamIdAttr, GenericIdAttr, "team-id");

class TriggerIdAttr{}
Utils.classMixin(TriggerIdAttr, GenericIdAttr, "trigger-id");

class RendererAttr {}
Utils.classMixin(RendererAttr, StringAttr, "renderer");

class ControllerAttr {}
Utils.classMixin(ControllerAttr, StringAttr, "controller");

class RefAttr{}
Utils.classMixin(RefAttr, StringAttr, "ref");

class UnitIdAttr {}
Utils.classMixin(UnitIdAttr, StringAttr, "unit-id");

class PriorityAttr {}
Utils.classMixin(PriorityAttr, IntAttr, "priority");

class HandlerAttr {}
Utils.classMixin(HandlerAttr, StringAttr, "handler");

class PromiseIdAttr {
	static generate(elt) {
		var current = PromiseIdAttr.get(elt);
		if (current) return current;
		var newId = Utils.UUID();
		PromiseIdAttr.set(elt, newId);
		return newId;
	}		
}
Utils.classMixin(PromiseIdAttr, StringAttr, "promise-id");

class IdAttr {
	static generateAll(elts) {
		elts.forEach(elt => IdAttr.generate(elt));
	}
	
	static generate(elt) {
		var current = IdAttr.get(elt);
		if (current) return current;
		var id = Utils.UUID();
		IdAttr.set(elt, id);
		return id;
	}
		
	static buildSelector(value) {
		return '[w-id="' + value + '"]';
	}
}
Utils.classMixin(IdAttr, StringAttr, "w-id");

class IconAttr {}
Utils.classMixin(IconAttr, StringAttr, "icon");

class TypeAttr {
	STANDARD = "standard";
	BONUS = "bonus";	
}
Utils.classMixin(TypeAttr, StringAttr, "type");

class EventTypesAttr {}
Utils.classMixin(EventTypesAttr, ListAttr, "event-types");

class ActiveAttr {}
Utils.classMixin(ActiveAttr, BoolAttr, "active");

class SelectedAttr {}
Utils.classMixin(SelectedAttr, BoolAttr, "selected");

class IsPendingAttr {}
Utils.classMixin(IsPendingAttr, BoolAttr, "is-pending");

class InvokedAttr {}
Utils.classMixin(InvokedAttr, BoolAttr, "invoked");

class SumAttr{}
Utils.classMixin(SumAttr, IntAttr, "sum");

class NameAttr{}
Utils.classMixin(NameAttr, StringAttr, "name");

/** Test controller that just logs to the console. */
class DebugController {
	__find = '.battlefield_unit';
	static log(evt, handler) {
		Logger.log("Got event", evt, "on handler", handler);
	}
}
WoofRootController.register(DebugController);

Emoji = {
	// Hero classes
	ROGUE: '🗡️',
	WIZARD: '🔮',
	FIGHTER: '🛡️',
	CLERIC: '🌞',
	GOOD_BOY: '🐕',
	
	// Enemy classes
	ONI: '👹',
	SKELLINGTON: '💀',
	GHOST: '👻',
	OCTOPUS: '🐙',
	INVADER: '👾',
	GOBLIN: '👺',
	CONSTRUCT: '🤖',
	DRAGON: '🐉',
	UNICORN: '🦄',
	ALIEN: '👽',
	MONKEY: '🐒',
	GORILLA: '🦍',
	
	// Misc
	POOP: '💩'
}

/** Constants. */
PLAYER_TEAM = "Player";
AI_TEAM = "AI";



class DefendRules {
	static ReduceDefend = GameEffect.handle(function(handler, effect, params) {
		var battlefield = Battlefield.find(effect);
		var unit = Unit.findById(battlefield, params.target);
		var defend = Unit.getDefend(unit);
		defend = Math.max(defend - params.amount, 0);
		var defenseLost = Math.min(defend, params.amount);
		return GameEffect.baseResult(effect, {
			target: params.target,
			amount: defenseLost,
			total: Unit.getDefend(unit)
		});
	});
	
	static GainDefend = GameEffect.handle(function(handler, effect, params) {
		var battlefield = Battlefield.find(effect);
		var unit = Unit.findById(battlefield, params.target);
		var defend = Unit.getDefend(unit);
		defend = Math.min(defend + params.amount, 0);
		return GameEffect.baseResult(effect, {
			target: params.target,
			amount: defend,
			total: Unit.getDefend(unit)
		});
	});
}
WoofRootController.register(DefendRules);


class DamageRules {
	static ReduceHP = GameEffect.handle(function(handler, effect, params) {
		var battlefield = Battlefield.find(effect);
		var unit = Unit.findById(battlefield, params.target);
		
		var hp = Unit.getHP(unit);
		var hpLost = Math.min(hp, params.amount);
		hp = Math.max(hp - params.amount, 0);
		Unit.setHP(unit, hp);
		
		if (hp == 0) {
			var ticket = PendingOpAttr.takeTicket(effect);
			return GameEffect.push(effect, GameEffect.create("Die", {
				target: params.target
			})).then(result => {
				return GameEffect.createResults(effect, {
					target: params.target,
					amount: hpLost					
				}, [result]);
			});
		} 
		
		return GameEffect.baseResult(effect, {
			target: params.target,
			amount: hpLost,
		});		
	});
	
	/**
	 * Composite / "high level" effect: Deals damage.
	 */
	static TakeDamage = GameEffect.handle(function(handler, effect, params) {
		
		var battlefield = Battlefield.find(effect);
		var unit = Unit.findById(battlefield, params.target);
		var results = [];
		
		// Pending while we resolve all our other damage effects.
		var ticket = PendingOpAttr.takeTicket(effect);
		var toSkip = params.skip || [];
		var pendingPromise = Promise.resolve();
		
		// Deal with defense first.
		if (!toSkip.contains("defense")) {
			pendingPromise = pendingPromise.then(function(ignore) {
                return GameEffect.push(effect, GameEffect.create("ReduceDefend", {
					target: params.target,
					amount: params.amount
				})).then(function(result) {
					return GameEffect.mergeResults(results, result);
				});
			});
		}
		
		// Deal with HP loss next.
		pendingPromise = pendingPromise.then(function(result) {
			var amount = params.amount;
			if (result) {
				amount = amount - result.amount;
			}			
			return GameEffect.push(effect, GameEffect.create("ReduceHP", {
				target: params.target,
				amount: amount
			})).then(function(result) {
				return GameEffect.mergeResults(results, result);
			});
		});
		
		// Return the result.
		return pendingPromise.then(function(result) {
			PendingOpAttr.returnTicket(effect, ticket);
			return GameEffect.createResults(effect, {
				target: params.target
			}, results);			
		});
	}); 
	
	static Die = GameEffect.handle(function(handler, effect, params) {
		var battlefield = Battlefield.find(effect);
		var unit = Unit.findById(battlefield, params.target);
		Battlefield.removeUnit(unit);
		
		return GameEffect.baseResult(effect, {
			target: params.target
		});		
	});	
}
WoofRootController.register(DamageRules);



class MovementRules {
	
	/** 
	 * {
	 *   target: Unit ID,
	 *   destination: Coordinate they are moving to.
	 * }
	 */
	static MoveUnit = GameEffect.handle(function(handler, effect, params) {
		var battlefield = Battlefield.find(effect);
		var unit = Unit.findById(battlefield, params.target);
		
		var current = Unit.coordinate(unit);
		
		Battlefield.moveFromTo(battlefield, current, params.destination);	
		return GameEffect.baseResult(effect, {
			target: params.target,
			moveFrom: current,
			moveTo: params.destination 
		});
	});


	/** 
	 * {
	 *   target: Unit ID,
	 *   direction: Coordinate representing a delta.
	 * }
	 */
	static StepUnit = GameEffect.handle(function(handler, effect, params) {
		var battlefield = Battlefield.find(effect);
		var unit = Unit.findById(battlefield, params.target);
		
		var current = Unit.coordinate(unit);
		var destination = Coordinate.plus(current, params.direction);
		// This is where we would factor in transitions and such.
		
		return GameEffect.push(effect, GameEffect.create("MoveUnit", {
			target: params.target,
			destination: destination
		})).then(function(result) {
			return GameEffect.createResults(effect, result.result, GameEffect.flattenResults(result));
		});		
	});
	
	/** 
	 * {
	 *   target: Unit ID,
	 *   path: [Coordinate...] including the starting position, in order.
	 *   budget: Number of movement points available.
	 * }
	 */
	static WalkUnit = GameEffect.handle(function(handler, effect, params) {
		var ticket = PendingOpAttr.takeTicket(effect);
		var battlefield = Battlefield.find(effect);
		var path = params.path;
		var budget = params.budget;
		var results = [];
		
		var basePromise = Promise.resolve(null);
		var stepsTaken = 0;
		var baseFn = function(success, result) {
			if (result) {
				GameEffect.mergeResults(results, result);
			}
			// End-case: We've walked as far as we can (budget), or we've
			// reached our destination.
			if (budget == 0 || (path.length - stepsTaken == 1)) {
				PendingOpAttr.returnTicket(effect, ticket);
				return GameEffect.createResults(effect, {
					target: params.target,
					stepsTaken: stepsTaken					
				}, results);
			}
			
			var startingFrom = path[stepsTaken];
			var goingTo = path[stepsTaken + 1];			
			
			return GameEffect.push(effect, GameEffect.create("StepUnit", {
				target: params.target,
				direction: Coordinate.minus(goingTo, startingFrom)
			})).then(function(success) {
				// Bookkeeping.
				budget = budget - 1;
				stepsTaken = stepsTaken + 1;
				return success;
			}, function (fail) {
				budget = budget - 1;
				// Pass failure along.
				return fail;
			}).then(baseFn.bind(this, true), baseFn.bind(this, false));
		};
		
		return basePromise.then(
				baseFn.bind(this, true),
				baseFn.bind(this, false));		
	});	
}
WoofRootController.register(MovementRules);

class InfluenceRules {
	static OnAfterMoveUnit = GameEffect.after(function(handler, effect, params, result) {
		// Do something eventually.
		return Promise.resolve(null);
	});
}
WoofRootController.register(InfluenceRules);

class InitiativeRules {
	/** 
	 * {
	 *   target: Unit ID,
	 *   amount: Integer for a delta, or "end" for just-go-to-the-end.
	 *   min: If set, the lowest we can go,
	 *   max: if set, the highest we can go
	 * }
	 */
	static AdjustUnitInitiative = GameEffect.handle(function(handler, effect, params) {
		var battlefield = Battlefield.find(effect);
		var unit = Unit.findById(battlefield, params.target);
		var tracker = InitiativeTracker.find(effect);
		
		if (params.amount == 'end') {
			params.amount = InitiativeTracker.size(tracker);
		}
		if (params.amount == 'start') {
			params.amount = -InitiativeTracker.size(tracker);
		}
		if (params.amount > 0) {
			// Because moving forward moves ourself, it messes with the indexing
			// by a factor of 1.  So... we add 1 here.
			params.amount = params.amount + 1;
		}
		
		var current = InitiativeTracker.indexOfUnit(unit);
		
		var max = InitiativeTracker.size(tracker);
		InitiativeTracker.moveUnitTo(unit, Math.max((params.min || 0), Math.min((params.max || max), current + params.amount)))					
				
		return GameEffect.baseResult(effect, {
			target: params.target,
			amount: InitiativeTracker.indexOfUnit(unit) - current
		});	
	});
	
	/** 
	 * {
	 *   target: Unit ID,
	 *   amount: Integer for a delta, or "end" for just-go-to-the-end.
	 * }
	 */
	static DelayUnit = GameEffect.handle(function(handler, effect, params) {
		return GameEffect.push(effect, GameEffect.create("AdjustUnitInitiative", params)).then(function(result) {
			// This is where we would do things like interrupt the current turn.
			return GameEffect.chainResult(effect, {}, result);
		});
	});
	
	/** 
	 * {
	 *   targets: [Unit ID...],
	 *   amount: Integer for a delta, or "end" for just-go-to-the-end.
	 * }
	 */
	static DelayAll = GameEffect.handle(function(handler, effect, params) {
		var battlefield = Battlefield.find(effect);
		var tracker = InitiativeTracker.find(effect);
		
		// First, we need to sort our targets.
		var targets = params.targets.map(target => Unit.findById(battlefield, target));

		// Second, we need to decide who we want to move first.
		// This is based on which direction has risk of stacking (e.g. if
		// the last 3 units are bumped at +2, we want to maintain their order even though there
		// are no effective moves, so we process them last-to-first.  Vice versa.
		var priority = params.amount;

		if (params.amount == "start") priority = -1;
		else if (params.amount == 'end') priority = 1;
		else priority = Math.sign(params.amount);

		// Sort targets in current initiative order based on which direction we're going.
		targets.sort(function(a, b) {
			return (InitiativeTracker.indexOfUnit(b) - InitiativeTracker.indexOfUnit(a));
		});
		if (priority < 0) targets.reverse();

		var promises = [];
				
		var currentBounds = [0, InitiativeTracker.size(InitiativeTracker.find(effect))];
		var effectiveAmount = (params.amount == "start") ? -currentBounds[1] :
				(params.amount == "end") ? currentBounds[1] : params.amount;
		var constraint = (Math.sign(effectiveAmount) < 0) ? 0 : 1;
		for (var unit of targets) {
			var currentPos = InitiativeTracker.indexOfUnit(unit);
			var updatedPos = currentPos + effectiveAmount;
			// Clamp the value to what we allow.
			var realUpdatedPos = (updatedPos < currentBounds[0] || updatedPos > currentBounds[1]) ?
					currentBounds[constraint] : updatedPos;
						
			promises.push(GameEffect.push(effect, GameEffect.create("AdjustUnitInitiative",  {
				target: Unit.getId(unit),
				amount: realUpdatedPos - currentPos,
				min: currentBounds[0],
				max: currentBounds[1]
			})));

			currentBounds[constraint] = currentBounds[constraint] - Math.sign(effectiveAmount);
		}
		
		return Promise.allSettled(promises).then(function(results) {
			// This is where we would handle the "current turn" being interrupted.
			
			return GameEffect.createResults(effect, {},
					results.map(result => result.status == 'fulfilled' ? result.value : null).filter(obj => !!obj));
		});
	});

}
WoofRootController.register(InitiativeRules);



class ActionRules {
	
	/**
	 * {
	 *   target: Selector for the unit invoking the action.  Named such for consistency.
	 *   victim: Selector for the thing affected by the action.  Wish for above name.
	 *   cards: A list of card IDs.
	 *	 move: The ID of the move being used.
	 * }
	 */
	static InvokeAction = GameEffect.handle(function(handler, effect, params) {
		var context = ActionRules.__buildActionContext(handler, params);
		var paramFn = MoveDB.paramFn(context.move);
		var actionParams = paramFn(context.trigger, context.cards, context.invoker, context.target);
		
		// Evoke the action.
		var evokeFn = MoveDB.evokeFn(context.move);
		var resultPromise = evokeFn(invoker, victim, params, cards, effect);
		return resultPromise.finally(result => {
			// End of turn.
			
			var activeTeam = TeamIdAttr.get(context.invoker);
			var actionResult = result.result;
			actionResult.discard && actionResult.discard.forEach(card => Cards.discard(handler, activeTeam, card));
						
			return GameEffect.push(effect, new GameEffect.create("AdjustUnitInitiative", {
				target: IdAttr.get(context.invoker),
				amount: 'end'				
			})).then(function(initResult) {
				var childResults = [];
				childResults.push.apply(childResults, result.results);
				childResults.push(initResult);
				return GameEffect.createResults(effect, {}, childResults);
			});;
		}); 		
	});
	
	static resolveActionContext(base) {
		var effect = GameEffect.findParentByType(base, "InvokeAction");
		if (!effect) return null;
		return ActionRules.__buildActionContext(effect, GameEffect.getParams(effect));
	}
	
	static __buildActionContext(elt, params) {
		var battlefield = Battlefield.find(effect);
		var invoker = battlefield.querySelector(params.target);
		var victim = battlefield.querySelector(params.victim);
		var cardHud = CardHud.find(battlefield);
		var cards = params.cards.map(id => CardHud.findCardById(cardHud, id));
		
		var moveRef = MoveDB.resolveRef(invoker, moveId);
		var move = MoveDB.resolve(moveRef);		
		var trigger = Triggers.findUp(moveRef);
		
		return {
			invoker: invoker,
			target: victim,
			cards: cards,
			move: move,
			trigger: trigger
		};				
	}
}
WoofRootController.register(ActionRules);


class RateAttr {}
Utils.classMixin(RateAttr, IntAttr, 'rate');

class TimeoutAttr {}
Utils.classMixin(TimeoutAttr, IntAttr, 'timeout');

class CancelledAttr {}
Utils.classMixin(CancelledAttr, BoolAttr, 'cancelled');


class GameEffectInvoker {	
	static start(queueElt) {
		var fn = function() {
			try {
				var start = window.performance.now();
				while (window.performance.now() - start < (1000.0 / 60)) {					
					EffectQueue.evoke(queueElt);
				}
			} catch (e) {
				Logger.err(e);
			}
			TimeoutAttr.set(queueElt, null);
			if (!!EffectQueue.findCurrentEvent(queueElt)) {
				var timeout = window.setTimeout(fn, 0);	
				TimeoutAttr.set(queueElt, timeout);
			}
		};
		fn();
	}	
	
	static stopTimer(queueElt) {
		var timer = TimeoutAttr.get(queueElt);
		if (typeof(timer) == 'number') {
			window.clearTimeout(timer);
		}		
	}
	
	static OnNewElement(event, handler) {
		var queue = EffectQueue.findDown(handler);
		
		var event = EffectQueue.findCurrentEvent(handler);
		if (event) {
			var timeout = TimeoutAttr.get(handler);
			if (isNaN(timeout)) {
				GameEffectInvoker.start(queue);
			}
		} else {
			GameEffectInvoker.stopTimer(queue);
		}
	}
}
WoofRootController.register(GameEffectInvoker);




class UiTreatments {	
	static OnAfterUiEffect = GameEffect.after(function(handler, event, params, result) {
		var ticket = PendingOpAttr.takeTicket(event);
		
		var effects = handler.querySelectorAll("ui-effect");
		var targetFn = handler.getAttribute('target-fn');
		var actualTarget = null;		
		var target = function() {
			if (!targetFn) throw boom("Can't use target-requiring effect with no target fn", handler);
			if (!actualTarget) actualTarget = WoofRootController.invokeController(targetFn, [handler, event, params, result]);
			return actualTarget;
		};
		var delay = IntAttr.get("delay", handler) || 0;
		
		for (var effect of effects) {
			switch (TypeAttr.get(effect)) {
				case "blink":
					var color = effect.getAttribute("blink-color") || "white";
					DomHighlighter.highlight(target(), {
						color: color
					});				
					break;
				case "wub":
					var icon = IconAttr.get(effect) || "💩";
					UiTreatments.__wub(target(), icon);
					break;
				default:
					Logger.warn("Unknown effect type", TypeAttr.get(effect), effect);				
			}			
		}

		window.setTimeout(function() {
			PendingOpAttr.returnTicket(event, ticket);						
		}, delay);
	});
	
	static __findEffectContainer(elt) {
		var up = Utils.findUp(elt, '[effect-container]');
		if (!up) throw boom("Unable to find redirect to effect container", elt);
		var down = up.querySelector(up.getAttribute('effect-container'));
		if (!down) throw boom("Unable to find effect container", elt);
		return down;
	}
	
	static __wub(targets, icon) {
		if (!Array.isArray(targets)) {
			targets = [targets];
		}

		targets.forEach(function(target) {


		var wubEffect = Templates.inflate('icon_wub_ui_effect', {
			CONTENT: icon
		});
		
		var container = UiTreatments.__findEffectContainer(target);
		container.appendChild(wubEffect);		

		var left = target.offsetLeft + (target.offsetWidth - wubEffect.offsetWidth) / 2;
		var top = target.offsetTop + (target.offsetHeight - wubEffect.offsetHeight) / 2;		
		wubEffect.style.cssText = "left: " + left + "px; top: " + top + "px;";				
	})
	}
	
	static ResultToUnit(handler, event, params, result) {
		var battlefield = Battlefield.find(handler);
		return Unit.findById(battlefield, result.target);		
	}
	
	static OnTempIconCreate(event, handler) {
		window.setTimeout(function() {
			var fn = function() {
				if (!handler.parentNode) return;
				handler.removeEventListener('transitionend', fn);
				// Remove effect from the DOM.
				handler.parentNode.removeChild(handler);
			};
			handler.addEventListener('transitionend', fn);
			// Backup option.
			window.setTimeout(fn, 1000);
			
			// Add the class that does the transition.
			handler.classList.add("finalize");
		});		
	}	
}
WoofRootController.register(UiTreatments);



// ###################################################################
// ###############        DOM CONTROLLERS HERE         ###############
// ###################################################################


/** Dumping grounds for different testing scenarios. */
class TestSetup {
	
	static __reset(handler, params) {
		var mainScreen = handler.querySelector(".main_screen");		
		Utils.clearChildren(mainScreen);		
	}
	
	static __default(handler, params) {
		var mainScreen = handler.querySelector(".main_screen");		
		EncounterScreenHandler.create(mainScreen, {
			battlefield: {
				width: 10,
				height: 10,				
			},
			teams: [{
				id: PLAYER_TEAM,
				controller: Player
			}, {
				id: AI_TEAM,
				controller: AI,
			}]
		});
		var encounterInfo = EncounterScreenHandler.getInfo(mainScreen);
				
		var container = Battlefield.find(handler);

		Battlefield.addUnitTo(container,
				Unit.createFromBlueprint(handler, "rogue", {
					team: PLAYER_TEAM
				}),
				Coordinate.normalize(container, "D5"));			
			
		Battlefield.addUnitTo(container,
				Unit.createFromBlueprint(handler, "goblin"),
				Coordinate.normalize(container, "D3"));

		Battlefield.addUnitTo(container,
				Unit.createFromBlueprint(handler, "fighter", {
					team: PLAYER_TEAM
				}),
				Coordinate.normalize(container, "D2"));	

		Battlefield.addUnitTo(container,
				Unit.createFromBlueprint(handler, "rogue", {
					team: PLAYER_TEAM
				}),
				Coordinate.normalize(container, "E4"));

		Battlefield.addUnitTo(container,
				Unit.createFromBlueprint(handler, "fighter", {
					team: PLAYER_TEAM
				}),
				Coordinate.normalize(container, "D4"));


		Battlefield.addUnitTo(container,
				Unit.createFromBlueprint(handler, "goblin"),
				Coordinate.normalize(container, "E2"));

		Battlefield.addUnitTo(container,
				Unit.createFromBlueprint(handler, "goblin"),
				Coordinate.normalize(container, "F2"));

		Battlefield.addUnitTo(container,
				Unit.createFromBlueprint(handler, "goblin"),
				Coordinate.normalize(container, "E5"));

		Battlefield.addUnitTo(container,
				Unit.createFromBlueprint(handler, "goblin"),
				Coordinate.normalize(container, "F5"));

		Battlefield.addUnitTo(container,
				Unit.createFromBlueprint(handler, "goblin"),
				Coordinate.normalize(container, "E7"));
				
				
		var teams = TeamInfo.findAll(mainScreen).toObject(IdAttr.get);
		// Player initializers.
		// Draw some cards.
		CardHud.drawCard(CardHud.find(mainScreen), true);
						
		// Enemy team initializers.
		var aiTeam = teams[AI_TEAM];

		// Set up the AI deck.
		AI.__initializeDeck(aiTeam);
		
		// Set up base intentions for each of those boyos.
		for (var unit of Unit.findAll(container).filter(unit => AI_TEAM == TeamIdAttr.get(unit))) {
			AI.__drawCardsFor(unit);
		}
	}
		
}



class MainScreenController {
	
}
WoofRootController.register(MainScreenController);


class Compendium {
	static find(parentElt, opt_path) {
		var parent = Utils.find(parentElt, '.compendium');
		if (!parent) return null;
		if (!opt_path) return parent;
		
		var parts = opt_path.toLowerCase().split('/');
		var current = '';
		var first = true;
		for (var i = 0; i < parts.length; i++) {
			if (first) { first = false; }
			else { current += " > "; }
			current += "concept[hash='" + parts[i] + "']";
		}
		return parent.querySelector(current);		
	}
	
	static getValues(parentElt, path, opt_key) {
		var spot = Compendium.find(parentElt, path);
		if (!spot) return null;
		return spot.querySelectorAll('values > ' + (opt_key || '*'));
	}
	
	static getValue(parentElt, path, key) {
		var spot = Compendium.find(parentElt, path);
		if (!spot) return null;
		return spot.querySelector('values > ' + key);		
	}
}



// NOTE FOR YOU: Text when hitting "up" in the console is one thingie behind for some reason.


// ##################### Game things below this line #######################


/** Handles populating all the encounter screen shenanigans. */
class EncounterScreenHandler {
	static create(parentElt, config) {	
		var mainElt = Templates.inflateIn("encounter_screen", parentElt);
		Battlefield.create(parentElt.querySelector('.battlefield_widget_container'), config.battlefield);
		InitiativeTracker.create(parentElt.querySelector('.battlefield_widget_container'), config.initiative);
		CardHud.create(parentElt.querySelector('.card_hud_widget'), {
			cards: DeckDB.generate(parentElt)
		});

		// Next up, we want to populate our team info.
		if (config.teams) {
			for (var team of config.teams) {
				TeamInfo.put(mainElt, {
					TEAM_ID: team.id,
					CONTROLLER: typeof(team.controller) == 'string' ? team.controller : team.controller.name					
				});
			}			
		}
		
		return mainElt;
	}
	
	static getInfo(elt) {
		var me = EncounterScreenHandler.find(elt);
		return me.querySelector('info.encounter');
	}
	
	static findBattleContainer(parentElt) {
		if (parentElt.classList.contains('battlefield_widget_container')) return parentElt;
		return parentElt.querySelector('.battlefield_widget_container');
	}
	
	static OnNewUnit(event, handler) {
		var element = EncounterScreenHandler.find(handler);
		if (!element) return;
		
		var tracker = InitiativeTracker.find(element);
		if (tracker) {
			var unit = event.detail.unit;
			InitiativeTracker.addTurn(tracker, unit);			
		}			
	}
	
	static OnRemovedUnit(event, handler) {
		var unitId = Unit.getId(event.detail.unit);
		InitiativeTracker.removeUnit(handler, unitId);
		
	}
	
	static OnCurrentTurn(event, handler) {
		var newActive = Unit.findById(handler, event.detail.unit);		
		var currentUnit = Unit.findActive(handler);
		if (newActive == currentUnit) return;		
		if (currentUnit) Unit.setActive(currentUnit, false);
		if (newActive) Unit.setActive(newActive, true);		
	}	
}
Utils.classMixin(EncounterScreenHandler, AbstractDomController, { matcher: '.encounter_screen' });
WoofRootController.register(EncounterScreenHandler);


/** First child is the active element. */
class InitiativeTracker {
	static create(parentElt, opt_config) {
		Templates.inflateIn("initiative_tracker", parentElt);
	}
	
	static findEntryContainer(elt) {
		if (elt.classList.contains("initiative_tracker_contents")) return elt;
		return elt.querySelector(".initiative_tracker_contents");
	}
	
	static removeTurnAt(parentElt, turnAt) {
		var current = InitiativeTracker.find(parentElt);
		var top = InitiativeTracker.__allTurns(parentElt);
		
		if (turnAt < top.length) {
			var toReturn = top[turnAt];
			toReturn.parentNode.removeChild(toReturn);
			return toReturn;
		}
		return null;
	}
	
	static currentTurn(parentElt) {
		var current = InitiativeTracker.find(parentElt);
		var children = current.querySelectorAll('.initiative_entry');
		
		if (children.length == 0) {
			return null;
		}
		return children[0].getAttribute("unit");		
	}
	
	static _current(parentElt) {
		var current = InitiativeTracker.find(parentElt);
		return current.querySelector('.initiative_entry').parentNode.firstElementChild;
	}
	
	static moveCurrent(parentElt, delta) {
		var current = InitiativeTracker._current(parentElt);
		if (delta < 0) {
			// This means move to the end
			current.parentNode.appendChild(current);
		} else {
			current.parentNode.insertChild(current, delta);			
		}
		InitiativeTracker._onChange(parentElt);
	}
	
	static addTurn(parentElt, unit) {
		var self = InitiativeTracker.findEntryContainer(parentElt);
		var id = Unit.getId(unit);
		var icon = Unit.getIcon(unit);
		
		Templates.inflateIn("initiative_entry", self, {
			UNIT: id,
			VALUE: icon
		});		
	}
	
	static getUnitId(elt) {
		return elt.getAttribute("unit") || null;
	}
	
	static swap(parentElt, firstId, secondId) {
		if (firstId == secondId) return;

		var root = InitiativeTracker.find(parentElt);		
		var firstIdx = InitiativeTracker.__indexOf(
				InitiativeTracker.__findById(root, firstId));
		var secondIdx = InitiativeTracker.__indexOf(
				InitiativeTracker.__findById(root, secondId));
				
		InitiativeTracker.__swap(root, firstIdx, secondIdx);		
	}
	
	static OnChange(event, handler) {
		InitiativeTracker._onChange(handler);
	}
	
	static _onChange(handler) {
		var self = InitiativeTracker.find(handler);		
		InitiativeTracker.__setCurrent(self, InitiativeTracker.currentTurn(self));		
	}
	
	static OnAttrChange(event, handler) {
		var tracker = InitiativeTracker.find(handler);
		
		WoofRootController.dispatchNativeOn(tracker, "CurrentTurn", {
			unit: event.detail.newValue
		});
	}
	
	static removeUnit(handler, id) {
		var tracker = InitiativeTracker.find(handler);
		var item = InitiativeTracker.__findById(tracker, id);
		item.parentNode.removeChild(item);
		InitiativeTracker._onChange(handler);
	}

	
	static indexOfUnit(unit) {
		var tracker = InitiativeTracker.find(unit);
		var item = InitiativeTracker.__findById(tracker, Unit.getId(unit));
		return InitiativeTracker.__indexOf(item);
	}
	
	static size(element) {
		var tracker = InitiativeTracker.find(element);
		return InitiativeTracker.__allTurns(tracker).length;
	}
	
	static moveUnitTo(unit, index) {
		var tracker = InitiativeTracker.find(unit);
		var item = InitiativeTracker.__findById(tracker, Unit.getId(unit));
		item.parentNode.insertChild(item, index);		
	}
	
	static __swap(parentElt, firstIdx, secondIdx) {
		var self = InitiativeTracker.find(parentElt);
		var init1 = InitiativeTracker.__childAt(self, firstIdx);
		var init2 = InitiativeTracker.__childAt(self, secondIdx);
		
	    const after2 = init2.nextElementSibling;
		const parent = init2.parentNode;
		init1.replaceWith(init2);
		parent.insertBefore(init1, after2);		
	}
	
	static __setCurrent(parentElt, value) {
		var self = InitiativeTracker.find(parentElt);
		if (self.getAttribute('current') == value) return;
		self.setAttribute('current', value);		
	}
	
	static __getCurrent(parentElt) {
		var self = InitiativeTracker.find(parentElt);
		self.getAttribute('current');
	}
	
	static __allTurns(parentElt) {
		var current = InitiativeTracker.find(parentElt);
		return current.querySelectorAll('.initiative_entry') || [];
	}
	
	static __indexOf(child) {
		return child.parentNode.children.indexOf(child);
	}
	
	static __findById(parentElt, id) {
		var self = InitiativeTracker.find(parentElt);
		return self.querySelector("[unit='" + id + "']");
	}
	
	static __childAt(parentElt, idx) {
		var current = InitiativeTracker.find(parentElt);
		current = InitiativeTracker.findEntryContainer(current);
		return current.children[idx];
	}
}
WoofRootController.register(InitiativeTracker);
WoofRootController.addListener("CurrentTurn");
Utils.classMixin(InitiativeTracker, AbstractDomController, { matcher: '.initiative_tracker' });


class Battlefield {	
	static findOverlay(mainElt) {
		return mainElt.querySelector('.battlefield_widget_overlay');
	}
	
	static OnOverlayItemMove(evt, handler) {
		var battlefield = Battlefield.find(handler);
		var unit = evt.detail.node;
		Battlefield._positionUnit(battlefield, unit);
		WoofRootController.dispatchNativeOn(battlefield, 'UnitMoved', {
			unit: unit
		});
	}
	
	static OnOverlayItemAdd(evt, handler) {
		var unit = evt.detail.child;
		Battlefield._positionUnit(handler, unit);

		var battlefield = Battlefield.find(unit);
		WoofRootController.dispatchNativeOn(battlefield, 'NewUnit', {
			unit: unit
		});
	}
	
	static OnOverlayItemRemove(evt, handler) {
		var elt = evt.detail.child;
		var id = Unit.getId(evt.detail.child);
		
		var battlefield = Battlefield.find(handler);
		WoofRootController.dispatchNativeOn(battlefield, 'RemovedUnit', {
			unit: elt
		});
	}
		
	static findCell(parentElt, coordinate) {
		return parentElt.querySelector(".battlefield_cell[x='" + coordinate.x + "'][y='" + coordinate.y + "']");
	}
	
	static cellsInRange(battlefield, coordinate, maxRange, opt_minRange) {
		var battle = Battlefield.find(battlefield);
		var okayFn = function() { return true; };
		
		var cells = BoardEffects.findMovementCandidates(battle, coordinate, maxRange, okayFn, okayFn)
				.map(cell => Battlefield.findCell(battle, cell));
		
		if (typeof(opt_minRange) == 'number') {
			var toRemove = BoardEffects.findMovementCandidates(battle, coordinate, opt_minRange, okayFn, okayFn)
				.map(cell => Battlefield.findCell(battle, cell));
				
			cells = cells.filter(cell => {
				return !toRemove.contains(cell)
			});			
		}
		
		return cells;		
	}
	
	static hasUnit(cell) {
		return !!Battlefield.getUnit(cell);
	}
	
	static removeUnit(unit) {
		unit.parentNode.removeChild(unit);		
	}
	
	static getUnit(cell) {
		var battle = Battlefield.find(cell);
		var coordinate = Cell.coordinate(cell);
		return Unit.findAt(battle, coordinate);
	}
	
	static _positionUnit(parentElt, unitElt) {
		var coordinate = Unit.coordinate(unitElt);
		var cell = Battlefield.findCell(parentElt, coordinate);
		if (!cell) return false;
		var left = cell.offsetLeft + (cell.offsetWidth - unitElt.offsetWidth) / 2;
		var top = cell.offsetTop + (cell.offsetHeight - unitElt.offsetHeight) / 2;		
		unitElt.style.cssText = "left: " + left + "px; top: " + top + "px;";
	}
			
	static create(battlefield, config) {
		Templates.inflateIn("battlefield_wrapper", battlefield);
		var parentElt = battlefield.querySelector(".battlefield_widget_inner");		
		
		var mainElt = Templates.inflate("battlefield_root");
		var header = mainElt.querySelector(".battlefield_header");
		var transitions = mainElt.querySelector(".battlefield_transition_row");
		
		var baseRow = "A".charCodeAt(0);

		/** Header row. */
		for (var i = 0; i < config.width; i++) {
			Templates.inflateIn("battlefield_header_cells", header, { "LAY-BOH": i + 1 });
			Templates.inflateIn("battlefield_transition_cells", transitions);
		}
				
		for (var y = 0; y < config.height; y++) {
			var rowLabel = String.fromCharCode(baseRow + y);
			var rows = Templates.inflate("battlefield_rows", { "LAY-BOH": rowLabel });
			var row = rows.querySelector(".battlefield_row");
			var transition = rows.querySelector(".battlefield_transition_row");
			
			for (var x = 0; x < config.width; x++) {
				Templates.inflateIn("battlefield_cells", row, {
					"X-LU": x,
					"Y-LU": y,
					"LAY-BOH": rowLabel + (x + 1)
				});
				Templates.inflateIn("battlefield_transition_cells", transition);
			}
			
			mainElt.appendChild(rows);
		}
		parentElt.appendChild(mainElt);
				
		return mainElt;
	}
	
	static addUnitTo(parentElt, unit, coordinate) {
		var overlay = Battlefield.findOverlay(parentElt);
		Unit.setCoordinate(unit, coordinate);
		overlay.appendChild(unit);
	}	
	
	static moveFromTo(parentElt, coordinateFrom, coordinateTo) {
		var overlay = Battlefield.findOverlay(parentElt);
		var unit = Unit.findAt(overlay, coordinateFrom);
		if (!unit) return;
		Unit.setCoordinate(unit, coordinateTo);
	}
}
WoofRootController.register(Battlefield);
WoofRootController.addListeners('NewUnit', 'RemovedUnit', "UnitMoved");
Utils.classMixin(Battlefield, AbstractDomController, { matcher: '.battlefield_widget' });

class Cell {
	static normalize(battlefield, thing) {
		var coordinate = Coordinate.normalize(battlefield, thing);
		if (coordinate) return Battlefield.findCell(battlefield, coordinate);
		return null;
	}
	
	static coordinate(cell) {
		return Coordinate.value(parseInt(cell.getAttribute("x")), parseInt(cell.getAttribute("y")));
	}
}

class Team {		
	static __evaluateTeams(encounter, elt1, elt2, fn) {
		var info = TeamInfo.findAll(encounter).toObject(info => IdAttr.get(info));
		var team1 = typeof(elt1) == 'string' ? elt1 : TeamIdAttr.get(elt1);
		var team2 = typeof(elt2) == 'string' ? elt2 : TeamIdAttr.get(elt2);
		return fn(info[team1], info[team2]);
		
	}
	
	static allied(encounter, element1, element2) {
		return Team.__evaluateTeams(encounter, element1, element2, function(a, b) {
			return a == b;
		});
	}
	
	static opposed(encounter, element1, element2) {
		return Team.__evaluateTeams(encounter, element1, element2, function(a, b) {
			return a != b;
		});
	}
	
	static findController(elt) {
		var info = TeamInfo.findAll(elt).toObject(info => IdAttr.get(info));
		var team = Team.get(elt);
		if (!team) throw boom("Unable to find team", elt);		
		var teamInfo = info[team];
		return ControllerAttr.get(teamInfo);		
	}
}
// Mix these in for now so game logic can use "team" and DOM shit can use "TeamIdAttr" and still do the same thing.
Utils.classMixin(Team, TeamIdAttr);


class Unit {
	
	static create(config) {
		return Templates.inflate("battlefield_unit", config);
	}
	
	static createFromBlueprint(root, templateName, opt_config) {
		var baseConfig = {
			ID: Utils.UUID()
		};
		if (opt_config) {
			baseConfig = {
				...baseConfig,
				...opt_config
			};
		}
		var unit = UnitDB.findBlueprint(root, templateName);
		var icon = Emoji[unit.querySelector("icon").getAttribute("ref")];
		var info = unit.querySelector("info");
		
		var unitElt = Unit.create({
			...{
				APPEARANCE: icon				
			},
			...baseConfig
		});	
		if (opt_config && opt_config.team) {
			Team.set(unitElt, opt_config.team);
		}
		Unit.setDefend(unitElt, 0);
			
		if (!info) {
			var triggers = Triggers.findAll(unitElt);
			IdAttr.generateAll(triggers);		
			return unitElt;
		}
		
		var child = info.firstElementChild;
		while (child) {
			Unit.addInfo(unitElt, child.cloneNode(true));
			var previousChild = child;
			child = child.nextElementSibling;
		}

		var triggers = Triggers.findAll(unitElt);
		IdAttr.generateAll(triggers);		

		return unitElt;
	}
	
	static isA(elt) {
		return WoofType.has(elt, "Unit");
	}
	
	
	static findById(parentElt, id) {
		return parentElt.querySelector("[unit-id='" + id + "']");
	}
		
	static normalize(battlefield, thing) {
		if (thing instanceof Element &&
			thing.classList.contains("battlefield_unit")) return thing;
		if (thing == 'active') return Unit.findActive(battlefield);
		var coordinate = Coordinate.normalize(battlefield, thing);
		if (coordinate) return Unit.findAt(battlefield, coordinate);
		return null;
	}
		
	static findAt(parentElt, coordinate) {
		return parentElt.querySelector(".battlefield_unit[coordinate='" + Coordinate.toString(coordinate) + "']");
	}
	
	static findActive(parentElt) {
		return parentElt.querySelector(".battlefield_unit[active='true']");
	}
	
	static findAll(parentElt) {
		return Array.from(parentElt.querySelectorAll(".battlefield_unit"));
	}
	
	static findUp(parentElt) {
		return WoofType.findUp(parentElt, "Unit");
	}
	
	static find(parent) {
		return Unit.findUp(parent);
	}
		
	static isActive(unitElt) {
		var attr = unitElt.getAttribute("active");
		if (!!attr) {
			return true;
		}		
	}
	
	static setActive(unitElt, value) {
		if (!!value) unitElt.setAttribute("active", "true");
		else unitElt.removeAttribute("active");
	}
	
	static coordinate(unitElt) {
		var attr = unitElt.getAttribute("coordinate");
		if (!attr) return null;
		return Coordinate.fromString(attr);
	}
	
	static setCoordinate(unitElt, coordinate) {
		unitElt.setAttribute("coordinate", Coordinate.toString(coordinate));
	}
	
	static getId(unitElt) {
		return unitElt.getAttribute("unit-id");
	}
	
	static getIcon(unitElt) {
		return unitElt.querySelector(".appearance").innerHTML.trim();
	}
	
	static OnHPBarUpdate(event, handler) {
		var text = handler.querySelector(".hp_text");
		var progressBar = handler.querySelector("progress.hp_bar");
		text.innerHTML = progressBar.getAttribute("value") + "/" + progressBar.getAttribute("max");
	}
	
	static getHP(unitElt) {
		var progressBar = unitElt.querySelector("progress.hp_bar");
		return Att.int(progressBar, "value", 0); 
	}
	
	static setHP(unitElt, hp) {
		var progressBar = unitElt.querySelector("progress.hp_bar");
		progressBar.setAttribute("value", hp); 
	}
	
	static getMaxHP(unitElt) {
		var progressBar = unitElt.querySelector("progress.hp_bar");
		return Att.int(progressBar, "max", 0); 
	}
	
	static setMaxHP(unitElt) {
		var progressBar = unitElt.querySelector("progress.hp_bar");
		progressBar.setAttribute("max", hp); 
	}
	
	static getDefend(unitElt) {
		var container = unitElt.querySelector(".defend > .content");
		if (!container.innerHTML) {
			return 0;
		}
		return parseInt(container.innerHTML);
	}
	
	static setDefend(unitElt, defense) {
		var defend = unitElt.querySelector(".defend");
		var container = unitElt.querySelector(".defend > .content");
		container.innerHTML = (!!defense) ? defense : '';		
		if (!defense) {
			defend.classList.add("hidden");
		} else {
			defend.classList.remove("hidden");			
		}
	}
	
	static addInfo(unitElt, element) {
		var container = unitElt.querySelector("info");
		container.appendChild(element);
	}
	
	static getIntentCards(unitElt) {
		var unit = Unit.findUp(unitElt);
		return unitElt.querySelectorAll(".intent_tracker [wt~=Card]");
	}
	
	static addIntentCards(unitElt, cards) {
		var unit = Unit.findUp(unitElt);
		var content = unitElt.querySelector(".intent_tracker .content");
		cards.forEach(card => content.appendChild(card));		
	}
}
WoofRootController.register(Unit);


/** Generel purpose card handler.  One layer up from CardHud, one layer below CardRules. */
class Cards {
	
	static discard(cards, teamId) {
		if (cards.length == 0) return;
		var discard = Cards.discard(cards[0], teamId);
		if (!discard) throw boom("Unable to find discard pile for", teamId);
		cards.forEach(card => discard.appendChild(card));
		return true;
	}
	
	static drawInto(container, teamId, opt_config) {
		if (cards.length == 0) return;
		var draw;
		if (teamId.nodeType && teamId.nodeType == Node.ELEMENT_NODE && WoofType.has(teamId, "CardSet")) {
			draw = teamId;
		} else {
		    draw = Cards.drawPile(container, teamId);
		}
		if (!draw) throw boom("Unable to find draw pile for", teamId);
		
		// TODO: This is where you would factor in the idea of top/middle/bottom.

		if (!draw.firstElementChild) return false;

		if (opt_config && opt_config.random) {
			var childIdx = Math.floor(Math.random() * draw.childElementCount);
			container.appendChild(draw.children[childIdx]);
		} else {
			container.appendChild(draw.firstElementChild);
		}
		return true;					
	}
	
	static hand(elt, teamId) {
		return Utils.bfind(elt,
				'body',
				'[wt~="Hand"][team-id="' + teamId + '"]');
	}
	
	static discard(elt, teamId) {
		return Utils.bfind(elt,
				'body',
				'[wt~="Discard"][team-id="' + teamId + '"]');
	}
	
	static drawPile(elt, teamId) {
		return Utils.bfind(elt,
				'body',
				'[wt~="DrawPile"][team-id="' + teamId + '"]');
	}
	
	static intentForUnit(elt) {
		var found = elt.querySelectorAll('[wt~="IntentHand"]');
		if (found.length != 1) throw boom("Found invalid number of valid intent hands", found);
		return found[0];
	}
	
	static shuffle(elt, teamId) {
		var discard = Cards.discard(elt, teamId);
		var draw = Cards.drawPile(elt, teamId);
		while (discard.firstElementChild) {
			draw.appendChild(discard.firstElementChild);
		}
	}
	
}


/** Handler for the card UI the player uses. */
class CardHud {
	
	static create(parentElt, config) {
		Templates.inflateIn("card_hud", parentElt);	
		var cards = config.cards;
		var deck = parentElt.querySelector('.deck > .content');
		for (var card of cards) {
			Card.create(deck, card);
		}		
		
		CardHud.__resetSize(parentElt.querySelector('.deck'));
		CardHud.__resetSize(parentElt.querySelector('.discard'));		
	}
	
	static findCardById(parentElt, id) {
		var hud = CardHud.find(parentElt);
		return hud.querySelector('.hand [w-id="' + id + '"]');
	}
	
	static findSelectedCards(parentElt) {
		var hud = CardHud.find(parentElt);
		return hud.querySelectorAll('.hand .card[selected]');
	}
	
	static _findDeckContent(parentElt) {
		var root = CardHud.find(parentElt);
		if (!root) return null;
		return root.querySelector('.deck > .content');
	}
	
	static _findDiscardContent(parentElt) {
		var root = CardHud.find(parentElt);
		if (!root) return null;
		return root.querySelector('.discard > .content');		
	}
	
	static _findHandContent(parentElt) {
		var root = CardHud.find(parentElt);
		if (!root) return null;
		return root.querySelector('.hand > .content');		
	}
		
	static __resetSize(parentElt) {
		var children = parentElt.querySelector(".content");
		var size = parentElt.querySelector(".size");
		while ((!size || !children) && parentElt != parentElt.parentNode) {
			parentElt = parentElt.parentNode;
			children = parentElt.querySelector(".content");
			size = parentElt.querySelector(".size");
		}
		if (size.innerHTML == children.childElementCount) return null;
		var current = parseInt(size.innerHTML);		
		size.innerHTML = children.childElementCount;
		return {
			delta: children.childElementCount - current,
			oldSize: current,
			newSize: children.childElementCount
		};
	}
	
	static OnContentChange(event, handler) {
		var delta = CardHud.__resetSize(event.target);
		if (delta) {
			var target = WoofType.findUp(event.target, "CardSet");
			if (target) {
				WoofRootController.dispatchNativeOn(target, "SizeChange", delta);
			}			
		}
		if (event.type == "AddChild") {
			WoofRootController.dispatchNativeOn(event.detail.to, "AddCard", { card: event.detail.child });
		}
		if (event.type == "RemoveChild") {
			WoofRootController.dispatchNativeOn(event.detail.from, "RemoveCard", { card: event.detail.child });			
		}
		if (event.type == "MoveFrom") {
			WoofRootController.dispatchNativeOn(event.detail.from, "RemoveCard", { card: event.detail.child });						
		}
		if (event.type == "MoveTo") {
			WoofRootController.dispatchNativeOn(event.detail.to, "AddCard", { card: event.detail.child });						
		}
	}
	
	static OnCardSelect(event, handler) {
		var card = Card.normalize(event.target);
		if (!card) return;
		SelectedAttr.toggle(card);
		WoofRootController.dispatchNativeOn(CardHud._findHandContent(card), "SelectChange", {});
	}
	
	static setCardSelect(card, value) {
		SelectedAttr.set(card, value);
	}
	
	static drawCard(parentElt, random) {
		var deck = CardHud._findDeckContent(parentElt);
		var hand = CardHud._findHandContent(parentElt);
		if (!deck || !hand) throw boom("Unable to find card hud from", parentElt);
		
		if (!deck.firstElementChild) return false;
		
		if (!random) {
			hand.appendChild(deck.firstElementChild);
		} else {
			var childIdx = Math.floor(Math.random() * deck.childElementCount);
			hand.appendChild(deck.children[childIdx]);			
		}
		
		return true;
	}
	
	static firstCard(parentElt) {
		var hand = CardHud._findHandContent(parentElt);
		return hand.firstElementChild;
	}
	
	static discardCard(cardElt) {
		return CardHud.discardCards([cardElt]);
	}
	
	static discardCards(cardElts) {
		if (cardElts.length == 0) return;
		var discard;
		var idx = 0;
		while (!discard && idx < cardElts.length) {			
			discard = CardHud._findDiscardContent(cardElts[idx++]);
		}
		if (!discard) throw boom("Unable to find card hud from one of", cardElts);
		for (var card of cardElts) {
			discard.appendChild(card);
			SelectedAttr.set(card, false);
		}
	}
	
	static handSize(root) {
		var hand = CardHud._findHandContent(root);
		return hand.childElementCount;
	}
	
	static hand(root) {
		var hand = CardHud._findHandContent(root);
		return Array.from(hand.children)
				.filter(card => card.nodeType == Node.ELEMENT_NODE);
	}
}
WoofRootController.register(CardHud);
WoofRootController.addListeners('SizeChange', 'SelectChange', 'AddCard', 'RemoveCard');
Utils.classMixin(CardHud, AbstractDomController, { matcher: "[wt~=CardHud]" });


class Card {	
	static create(parentElt, config) {
		var config ={
			ID: Utils.UUID()
		};
		if (!!parentElt) {
			return Templates.inflateIn("card", parentElt, config);
		}
		return Templates.inflate("card", config);
	}
	
	static normalize(elt) {
		return WoofType.findUp(elt, "Card");
	}
	
	static __nas(elt) {
		var me = Card.normalize(elt);
		if (!me) throw boom("This is not a card", elt);
		return me;		
	}
		
	static getRank(elt) {
		var me = Card.__nas(elt);
		return me.getAttribute("rank");		
	}
	
	static getSuit(elt) {
		var me = Card.__nas(elt);
		return me.getAttribute("suit");				
	}
	
	static getValue(elt) {
		var rank = parseInt(Card.getRank(elt));
		return Math.min(rank, 10);
	}
	
	static inHand(elt) {
		return !!WoofType.findUp(elt, "Hand");
	}
	
	static inDiscard(elt) {
		return !!WoofType.findUp(elt, "Hand");		
	}
	
	static inDrawPile(elt) {
		return !!WoofType.findUp(elt, "DrawPile");	
	}
}


class PreviewPanel {
	static __findTriggers(element) {
		var battlefield = Battlefield.find(element);
		return battlefield.querySelectorAll('.battlefield_unit[active="true"] trigger');
	}	
		
	static __renderTrigger(baseElt, icon) {		
		var base = Templates.inflate("trigger_preview", {
			TRIGGER_ID: IdAttr.get(baseElt)
		});
		
		var move = MoveDB.resolve(baseElt);
		base.querySelector('.card_icon').appendChild(icon);
		base.querySelector('.move_name').innerHTML = NameAttr.get(move);		
		PriorityAttr.set(base, PriorityAttr.get(baseElt));
		
		return base;
	}
	
	static __findTriggerContainer(parentElt) {
		var base = PreviewPanel.find(parentElt);
		return base.querySelector('.trigger_preview > .content');
	}
	
	static __findTriggerDefault(parentElt) {
		var base = PreviewPanel.find(parentElt);
		return base.querySelector('.trigger_preview > .default');
	}
	
	static __setHeights(contentPane) {
		window.setTimeout(function() {
			var pane = PreviewPanel.find(contentPane);
			var panel = pane.querySelector(".trigger_preview > .content");
			var current = pane.querySelector(".trigger_preview .trigger_preview");
			var height = 5;
			while (current) {
				current.style.top = height + "px";
				height += 40;			
				current = current.nextElementSibling;
			}
			panel.style.height = height + "px";
		}, 0);
	}
	
	static __reorderElements(contentPane) {
		
		var pane = PreviewPanel.find(contentPane);
		var panel = pane.querySelector(".trigger_preview > .content");
		var children = Array.from(pane.querySelectorAll(".trigger_preview .trigger_preview"));
		
		// Descending: B - A.
		children.sort(function(a, b) {
			if (ActiveAttr.get(a) != ActiveAttr.get(b)) {
				if (ActiveAttr.get(a)) {
					return -1;
				}
				return 1;				
			}
			if (IsPendingAttr.get(a) != IsPendingAttr.get(b)) {
				if (IsPendingAttr.get(a)) {
					return -1;
				}
				return 1;				
			}
			return PriorityAttr.get(b) - PriorityAttr.get(a);			
		});
		
		// Tack them onto the end in order.
		children.forEach(child => panel.appendChild(child));		
	}
	
	static __addTriggerPermutations(elt, permutations) {
		var panel = PreviewPanel.find(elt);
		var triggers = PreviewPanel.__findTriggerContainer(panel).querySelectorAll(".trigger_preview");
		var activeUnit = Unit.findActive(elt);
		
		var cardCache = {};
		
		for (var triggerPreview of triggers) {
			var info = triggerPreview.querySelector('info');			
			var trigger = TriggerIdAttr.resolve(triggerPreview);
			for (var permutation of permutations) {
				var cardIds = CardIdsAttr.get(permutation);
				var cards = cardIds.map(cardId => {
					if (cardCache[cardId]) return cardCache[cardId];
					var found = IdAttr.find(elt, cardId);
					cardCache[cardId] = found;
					return found;
				}).filter(Card.inHand);
				if (Triggers.activeFn(trigger)(trigger, cards, activeUnit)) {
					// Copy the permutation over into this one.
					info.appendChild(permutation.cloneNode(true));
				}
			}			
		}		
	}
		
	static __addBasePermutations(elt, card) {
		var panel = PreviewPanel.find(elt);
		var info = panel.querySelector('info.base');
		var existing = info.querySelectorAll('permutation');
		var newCardId = IdAttr.get(card);
		var cardHud = CardHud.find(elt);		
		
		var toAdd = [[newCardId]];
		for (var i = 0; i < existing.length; i++) {
			var ids = CardIdsAttr.get(existing[i]);			
			ids.push(IdAttr.get(card));
			toAdd.push(ids);			
		}		
		
		var newPermutations = toAdd.map(theGroup => {
			var newElt = Templates.inflate('card_permutation');
			IdAttr.generate(newElt);
			CardIdsAttr.put(newElt, theGroup);
			return newElt;
		});
		
		for (var boyo of newPermutations) {
			info.appendChild(boyo);
		}
		
		return newPermutations;
	}
	
	static __removePermutations(elt, card) {
		var cardId = IdAttr.get(card);
		var existing = PreviewPanel.find(elt).querySelectorAll('info > permutation[card-ids~="' + cardId + '"]');
		for (var i = 0; i < existing.length; i++) {
			existing[i].parentNode.removeChild(existing[i]);
		}
		
	}
	
	static __updatePermutations(element) {
		var triggers = Array.from(PreviewPanel.__findTriggerContainer(element).querySelectorAll(".trigger_preview"));
		triggers.forEach(trigger => {
			var permutations = trigger.querySelectorAll("info > permutation");
			IsPendingAttr.set(trigger, permutations.length > 0);			
		});		
	}
	
	static OnActiveUnitChange(event, handler) {
		var panel = PreviewPanel.find(handler);
		var triggers = Array.from(PreviewPanel.__findTriggers(handler));
		var defaultValue  = PreviewPanel.__findTriggerDefault(handler);
		var container = PreviewPanel.__findTriggerContainer(handler);
		var cardHud = CardHud.find(handler);
				
		Utils.clearChildren(container);
		
		if (triggers.length == 0) {
			container.classList.add('hidden');
			defaultValue.classList.remove('hidden');
		} else {	
			var hand = CardHud.hand(handler);
			defaultValue.classList.add('hidden');
			container.classList.remove('hidden');
			var height = 5;
			triggers.forEach(trigger => {
				var renderer = RendererAttr.get(trigger);
				var icon = WoofRootController.invokeController(renderer, [trigger]);

				var preview = PreviewPanel.__renderTrigger(trigger, icon);
				ActiveAttr.set(preview, ActiveAttr.get(trigger));
										
				container.appendChild(preview);
			});
			container.style.height = height + "px";
			PreviewPanel.__setHeights(container);

			var permutations = panel.querySelectorAll("info.base > permutation");
			PreviewPanel.__addTriggerPermutations(handler, permutations);		
			PreviewPanel.__updatePermutations(handler);
			PreviewPanel.__reorderElements(container);
			PreviewPanel.__setHeights(container);
		}
	}
	
	static OnTriggerActiveChange(event, handler) {
		var panel = PreviewPanel.find(handler);
		var trigger = event.detail.node;
		
		var unit = Unit.findUp(trigger);
		if (!Unit.isActive(unit)) {
			// This guy is from last turn.  Skip this one.
			return;			
		}
		
		var elt = TriggerIdAttr.find(panel, IdAttr.get(event.detail.node));		
		if (!elt) throw boom("OnTriggerActiveChange explosion");
				
		ActiveAttr.set(elt, ActiveAttr.get(event.detail.node));
		var content = PreviewPanel.__findTriggerContainer(handler);
		
		PreviewPanel.__reorderElements(content);
		PreviewPanel.__setHeights(content);
	}
	
	static OnCardAdd(event, handler) {
		var newPermutations = PreviewPanel.__addBasePermutations(handler, event.detail.card);
		
		// TODO: Consider breaking this into chunks and doing it behind a timer to
		// speed things up a bit.
		PreviewPanel.__addTriggerPermutations(handler, newPermutations);		
		PreviewPanel.__updatePermutations(handler);
		PreviewPanel.__reorderElements(handler);
		PreviewPanel.__setHeights(handler);
	}
	
	static OnCardRemove(event, handler) {
		PreviewPanel.__removePermutations(handler, event.detail.card);
		PreviewPanel.__updatePermutations(handler);		
		PreviewPanel.__reorderElements(handler);
		PreviewPanel.__setHeights(handler);
	}
	
	static OnGemClick(event, triggerPreview) {
		if (!IsPendingAttr.get(triggerPreview)) return;
		
		var permutation = triggerPreview.querySelector('permutation[active]');
		var next = permutation ?
				permutation.nextElementSibling || permutation.parentNode.firstElementChild :
				triggerPreview.querySelector('permutation');
		if (permutation) ActiveAttr.set(permutation, false);
		var otherActive = triggerPreview.parentNode.querySelector('permutation[active]');
		if (otherActive) ActiveAttr.set(otherActive, false);
		
		ActiveAttr.set(next, true);

		var cardIds = CardIdsAttr.get(next);
		var hand = CardHud.hand(triggerPreview);
		
		hand.forEach(card => {
			var id = IdAttr.get(card);
			CardHud.setCardSelect(card, cardIds.contains(id));
		});
	}
}
WoofRootController.register(PreviewPanel);
Utils.classMixin(PreviewPanel, AbstractDomController, { matcher: ".preview_panel" });





// ###################################################################
// ###############         USEFUL DATA TYPES           ###############
// ###################################################################


class Coordinate {
	
	static isA(thing) {
		return thing.x !== undefined && thing.y !== undefined;
	}
	
	
	static copy(coord) {
		return Coordinate.value(coord.x, coord.y);
	}
	
	static plus(thisThing, thisOtherThing) {
		return Coordinate.value(
				thisThing.x + thisOtherThing.x,
				thisThing.y + thisOtherThing.y);
	}
	
	static minus(thisThing, minusThisThing) {
		return Coordinate.value(
				thisThing.x - minusThisThing.x,
				thisThing.y - minusThisThing.y);
	}
	
	static stupidDistance(thisThing, thatThing) {
		var coordinate = Coordinate.abs(Coordinate.minus(thisThing, thatThing));
		return coordinate.x + coordinate.y;
	}
	
	static equal(thisOne, thatOne) {
		return thisOne.x == thatOne.x && thisOne.y == thatOne.y;
	}
	
	static unit(coordinate) {
		return Coordinate.value(
				coordinate.x > 0 ? 1 : (coordinate.x < 0 ? -1 : 0),
				coordinate.y > 0 ? 1 : (coordinate.y < 0 ? -1 : 0));	
	}
	
	static value(x, y) {
		return {x: x, y: y};
	}
	
	static abs(coord) {
		return Coordinate.value(coord.x < 0 ? -coord.x : coord.x,
								coord.y < 0 ? -coord.y : coord.y);
	}
	
	static toString(coordinate) {
		return "" + coordinate.x + "," + coordinate.y;
	}
	
	static toBattlefieldLabel(battlefield, coordinate) {
		return battlefield.querySelector("[x='" + coordinate.x + "'][y='" + coordinate.y + "']").getAttribute("label");
	}
	
	static fromString(string) {
		var split = string.split(',');
		return Coordinate.value(parseInt(split[0]), parseInt(split[1]));
	}
	
	static fromBattlefieldLabel(battlefield, string) {
		var cell = battlefield.querySelector("[label='" + string + "'][x][y]");
		if (!cell) return null;
		return Coordinate.value(parseInt(cell.getAttribute('x')), parseInt(cell.getAttribute('y')));
	}
	
	static normalize(battlefield, thing) {
		if (typeof(thing) == 'string') {
			var cell = Coordinate.fromBattlefieldLabel(battlefield, thing);
			if (!cell) cell = Coordinate.fromString(thing);
			if (!cell) return null;
			return cell;
		}
		if (Coordinate.isA(thing)) return thing;
		return null;
	}
	
	static neighbors(coordinate) {
		return [
			Coordinate.plus(coordinate, Coordinate.value(1, 0)),
			Coordinate.plus(coordinate, Coordinate.value(-1, 0)),
			Coordinate.plus(coordinate, Coordinate.value(0, 1)),
			Coordinate.plus(coordinate, Coordinate.value(0, -1))
		];
	}
}


// ###################################################################
// ###############        COMPENDIUM CLASSES           ###############
// ###################################################################

class MoveDB {
	static findBlueprint(root, moveName) {
		var move = Compendium.find(root, "move");
		if (!move) throw boom("Can't find compendium from", root);
		return move.querySelector("blueprints > move-blueprint[name='" + moveName + "']");
	}
	
	static resolve(elt, name) {
		if (elt.matches("move")) return elt;
		if (elt.matches("move-ref")) {
			return MoveDB.findBlueprint(elt, !name ? elt.getAttribute("ref") : name);
		}
		var move = elt.querySelector("move");
		if (move) return move;
		var ref = elt.querySelector("move-ref");
		if (ref) {
			return MoveDB.findBlueprint(ref, ref.getAttribute("ref"));
		}
		
		throw boom("Unable to resolve this as a move", elt);
	}
	
	static resolveRef(elt, moveId) {
		var move = elt.querySelector("move[move-id='" + moveId + "']");
		if (!move) move = elt.querySelector("move-ref[ref='" + moveId + "']");
		if (!move) throw boom("Unable to resolve move", elt, moveId);
		return move;
	}
	
	static paramFn(elt) {
		return BlueprintFunction.find(elt, "params");
	}
	
	static targetFn(elt) {
		return BlueprintFunction.find(elt, "targets");
	}
	
	static evokeFn(elt) {
		return BlueprintFunction.find(elt, "evoker");
	}
	
	static id(elt) {
		if (Utils.tag(elt) == "move") return elt.getAttribute("move-id");
		if (Utils.tag(elt) == "move-blueprint") return elt.getAttribute("name");
		throw boom("Not a valid move", elt);
	}
	
}

class UnitDB {
	static findBlueprint(root, unitName) {
		var units = Compendium.find(root, "unit");
		if (!units) throw boom("Can't find compendium from", root);
		
		return units.querySelector("blueprints > unit-blueprint[name='" + unitName + "']");
	}
	
}

class DeckDB {
	static generate(parentElt) {
		var cardSets = Compendium.getValues(parentElt, "card", "card-set");
		var extraCards = Compendium.getValues(parentElt, "card", "extra-card");

		var returnMe = [];
		
		for (var cardSet of cardSets) {
			var ranks = ParamList.get(cardSet, "ranks");
			var suits = ParamList.get(cardSet, "suits");
			
			for (var rank of ranks) {
				for (var suit of suits) {
					returnMe.push({
						rank: rank,
						suit: suit
					});
				}				
			}			
		}
		
		for (var extraCard of extraCards) {
			returnMe.push({
				rank: extraCard.getAttribute('rank'),
				suit: extraCard.getAttribute('suit')
			});
		}
		
		return returnMe;
	}
	
	static findRank(parentElt, key) {
		return Compendium.getValue(parentElt || document.body, "card/rank", 'rank[value="' + key + '"]');
	}
	
	static findSuit(parentElt, key) {
		return Compendium.getValue(parentElt || document.body, "card/suit", 'suit[value="' + key + '"]');		
	}
}



// ###################################################################
// ###############             GAME EFFECTS            ###############
// ###################################################################
// Below this line, we speak in the language of the game.

class DebugTrigger {
	static AnyCards(triggerElt, cards, unit) {
		return cards.length > 0;
	}	
}
WoofRootController.register(DebugTrigger);

class SingleTrigger {
	static AnyActive(triggerElt, cards, unit) {
		return cards.length == 1;
	}
	
	static SuitActive(triggerElt, cards, unit) {
		if (cards.length != 1) return false;
		return ParamList.has(triggerElt, "suit-filter", Card.getSuit(cards[0]));
	}
	
	static RankActive(triggerElt, cards, unit) {
		if (cards.length != 1) return false;
		return ParamList.has(triggerElt, "rank-filter", Card.getRank(cards[0]));		
	}
	
	static SuitRankActive(triggerElt, cards, unit) {
		if (cards.length != 1) return false;
		return ParamList.has(triggerElt, "rank-filter", Card.getRank(cards[0])) &&
				ParamList.has(triggerElt, "suit-filter", Card.getSuit(cards[0]));
	}
}
WoofRootController.register(SingleTrigger);

// "Do all cards match a specific requirement."
class SetTrigger {
	static ActiveByRank(triggerElt, cards, unit) {
		if (cards.length < 2) return false;
		var firstRank;
		for (var i = 0; i < cards.length; i++) {			
			if (!firstRank) firstRank = Card.getRank(cards[i]);
			if (firstRank != Card.getRank(cards[i])) {
				return false;
			}
		}
		return true;		
	}
	
	static ActiveBySuit(triggerElt, cards, unit) {
		if (cards.length < 2) return false;
		var firstSuit;
		for (var i = 0; i < cards.length; i++) {			
			if (!firstSuit) firstSuit = Card.getSuit(cards[i]);
			if (firstSuit != Card.getSuit(cards[i])) {
				return false;
			}
		}
		return true;				
	}
}
WoofRootController.register(SetTrigger);

// "Do the cards add up to a number?"
class SumTrigger {
	static Of(triggerElt, cards, unit) {
		var targetSum = Att.int(triggerElt, "sum");
		for (var card of cards) {
			targetSum = targetSum - Card.getValue(card);
		}
		return targetSum == 0;
	}	
}
WoofRootController.register(SumTrigger);

class Triggers {
	static activeFn(elt) {
		return BlueprintFunction.find(elt, "active-test");
	}
	
	static move(elt) {
		return elt.querySelector("move,move-ref");
	}	
}
Utils.classMixin(Triggers, AbstractDomController, { matcher: "trigger" });


class TriggerRenderer {
	
	static __templateFor2(item1, item2) {
		var top = TriggerRenderer.__miniTemplate(item1);
		var bottom = TriggerRenderer.__miniTemplate(item2);
		return {
			CONTENT1: top.content,
			KONTENT1CLASSES: top.classes,
			CONTENT2: bottom.content,
			KONTENT2CLASSES: bottom.classes,
			CLASSES: "icon_count_2"
		};
	}
	
	static __templateFor1(item) {
		if (item.type == "suit") {
			return TriggerRenderer.__templateForMainSuit(item.value);
		}
		if (item.type == "*") {
			return TriggerRenderer.__templateForMainAny();
		}
		if (item.type == "rank") {
			return TriggerRenderer.__templateForMainSingleRank(item.value);
		}
	
		return {};		
	}
	
	static __templateForMainSingleRank(item) {
		var obj = DeckDB.findRank(null, item);
		if (!obj) {
			// This is our "wildcard" case.
			return TriggerRenderer.__templateForMainAnyRank();
		}
				
		return {
			CONTENT1: IconAttr.get(obj),
			KONTENT1CLASSES: "rank",
			CONTENT2: '',
			KONTENT2CLASSES: '',
			CLASSES: 'icon_count_1 rank'
		};
	}
	
	static __templateForMainAnyRank() {				
		return {
			CONTENT1: '.',
			KONTENT1CLASSES: "any-rank",
			CONTENT2: '.',
			KONTENT2CLASSES: 'any-rank',
			CLASSES: 'icon_count_1 any-rank'
		};
	}
	
	static __templateForMainAny() {
		return {
			CONTENT1: "*",
			KONTENT1CLASSES: "any",
			CONTENT2: '',
			KONTENT2CLASSES: '',
			CLASSES: 'icon_count_1 any'
		};
	}
	
	static __templateForMainSuit(item) {
		var obj = DeckDB.findSuit(null, item);
		
		return {
			CONTENT1: !!obj ? IconAttr.get(obj) : item,
			KONTENT1CLASSES: item,
			CONTENT2: '',
			KONTENT2CLASSES: '',
			CLASSES: !!obj ? 'icon_count_1 ' + item : 'icon_count_1'
		};
	}
	
	static __miniTemplate(item) {
		if (item.type == "suit") {
			return TriggerRenderer.__templateForMiniSuit(item.value);
		}
		if (item.type == "*") {
			return TriggerRenderer.__templateForMiniAny();
		}
		if (item.type == "rank") {
			return TriggerRenderer.__templateForMiniSingleRank(item.value);
		}
	
		return {};		
	}
	
	static __templateForMiniSingleRank(item) {
		var obj = DeckDB.findRank(null, item);
		if (!obj) {
			// This is our "wildcard" case.
			return TriggerRenderer.__templateForMiniAnyRank();
		}
				
		return {
			content: item.value,
			classes: 'rank',
		};
	}
	
	static __templateForMiniAnyRank() {				
		return {
			content: '.',
			classes: 'any-rank',
		};
	}
	
	static __templateForMiniAny() {
		return {
			content: '*',
			classes: 'any',
		};
	}
	
	static __templateForMiniSuit(item) {
		var obj = DeckDB.findSuit(null, item);
		
		return {
			content: IconAttr.get(obj),
			classes: item,
		};
	}
	
	static Single(base) {
		var params;
		var suitFilter = ParamList.get(base, 'suit-filter');				
		if (suitFilter.length > 2) throw boom("Not supported yet!");


		if (suitFilter.length == 0) {
			params = [{ type: "*", value: "*" }];
		} else {
			params =  params || suitFilter.map(name => {
				return {
					type: 'suit',
					value: name
				};
			});
		}
		var template = params.length == 1 ?
				TriggerRenderer.__templateFor1(params[0]) :
				TriggerRenderer.__templateFor2(params[0], params[1]);
				
		return Templates.inflate("icon_single_card", template);
	}

	
	static Set(base) {
		var matchOn = ParamList.get(base, "match-on");
		if (matchOn.length == 0) matchOn = ["*"];
		if (matchOn.length > 2) throw boom("Not supported yet!");

		var template = matchOn.length == 1 ?
				TriggerRenderer.__templateFor1({
					type: matchOn[0],
					value: "*"
				}) :
				TriggerRenderer.__templateFor2({
					type: matchOn[0],
					value: "*"
				}, {
					type: matchOn[1],
					value: "*"
				});
		
		return Templates.inflate("icon_card_set_middle", template);		
	}
	
	static Sum(base) {
		var sum = SumAttr.get(base);
		
		return Templates.inflate("icon_card_set_middle", {
			CONTENT1: ' Σ ',
			KONTENT1CLASSES: '',
			CONTENT2: sum,
			KONTENT2CLASSES: '',
			CLASSES: 'icon_count_op1'
		});	
		
	}	
}
WoofRootController.register(TriggerRenderer);


class CTPredicates {
	// Specifics
	static cellHasUnit(battlefield, cell) {
		var coord = Cell.coordinate(cell);
		var unit = Unit.findAt(battlefield, coord);
		return !!unit;
	}
}

															
/** Card rules! */
class CardRules {
	
	static findHandRules(root) {
		var result = WoofType.findUp(root, "HandRules");
		if (result) return result;
		var candidates = root.querySelectorAll("[at-least]");
		for (var i = 0; i < candidates.length; i++) {
			if (WoofType.has(candidates[i], "HandRules")) {
				return candidates[i];
			}
		}
		return null;
	}
	
	static minHandSize(root) {
		var rules = CardRules.findHandRules(root);
		if (!rules) return null;
		return Att.int(rules, "at-least");
	}
	
	static maxHandSize(root) {
		var rules = CardRules.findHandRules(root);
		if (!rules) return null;
		return Att.int(rules, "at-most");		
	}
	
	// Enforces hand size stays within bounds.
	static OnHandSizeChange(evt, handler) {
		var detail = evt.detail;
		var min = CardRules.minHandSize(evt.target);
		if (min) {
			if (detail.newSize < min) {
				// Draw 1 card.  It'll resolve itself.
				CardRules.draw(evt.target, TeamIdAttr.get(evt.target), { noCycle: true });
			}
		}
		var max = CardRules.maxHandSize(evt.target);
		if (max) {
			if (detail.newSize > max) {
				CardHud.discardCard(CardHud.firstCard(evt.target));
			}
		}
	}

	static handSize(root) {		
		return {
			min: CardRules.minHandSize(root),
			max: CardRules.maxHandSize(root),
			current: CardHud.handSize(root),
		};
	}
	
	static draw(root, opt_options) {
		var team = (!!opt_options) ?
				(opt_options.team || PLAYER_TEAM) :
				PLAYER_TEAM;		
		
		if (opt_options && opt_options.noCycle) {
			var handSize = CardRules.handSize(root);
			if (handSize.max == handSize.current) return;					
		}
		
		var hand = Cards.hand(root, team);
		if (!Cards.drawInto(hand, team, { random: true })) {
			Cards.shuffle(hand, team);
			Cards.drawInto(hand, team, { random: true });
		}		
	}	
}
WoofRootController.register(CardRules);


class BoardEffects {
	
	// ############### Normalizers ###############
	static _coordinate(thing) {
		if (Coordinate.isA(thing)) return thing;
		var coord = Unit.coordinate(thing);		
		if (!coord) throw boom("Can't tell what this is.", thing);		
		return coord;
	}
	// ############### Turn Effects ###################

	static endTurn(root) {
		var tracker = InitiativeTracker.find(root);
		var current = Unit.findById(root, InitiativeTracker.currentTurn(tracker));

		InitiativeTracker.removeTurnAt(tracker, 0);
		InitiativeTracker.addTurn(tracker, current);		
	}
	
	
	
	
    // ############### Movement Effects ###############	
		
	// Basically a teleport.
	static stepUnit(battlefield, unit, destination, opt_config) {
		var coord = BoardEffects._coordinate(unit);
		destination = BoardEffects._coordinate(destination);
		
		Battlefield.moveFromTo(battlefield, coord, destination);
	}
	
	// Returns the set of cells in the given range.
	static findMovementCandidates(battlefield, start, distance, okayToPassFn, okayToLandFn) {
		var results = {};
		var checked = {};
		var workQueue = [{ coord: start, distance: distance}];
		while (workQueue.length > 0) {
			var item = workQueue.shift();
			var coordinateString = Coordinate.toString(item.coord);
			// Check if we've already checked this one.
			if (checked[coordinateString] !== undefined &&
					checked[coordinateString] >= item.distance) {
				// Skip this one.
				continue;
			}
			// Mark it as checked.
			checked[coordinateString] = item.distance;
			if (!results[coordinateString] && okayToLandFn(battlefield, Battlefield.findCell(battlefield, item.coord))) {
				results[coordinateString] = item.coord;
			}
			
			if (item.distance > 0 && (Coordinate.equal(start, item.coord) || okayToPassFn(battlefield, Battlefield.findCell(battlefield, item.coord)))) {
				var deltas = [
					Coordinate.value(1,0),
					Coordinate.value(-1,0),
					Coordinate.value(0,1),
					Coordinate.value(0,-1)
				];
				for (var i = 0; i < deltas.length; i++) {
					var candidate = Coordinate.plus(deltas[i], item.coord);
					var cell = Battlefield.findCell(battlefield, candidate);
					if (cell) {
						workQueue.push({ coord: candidate, distance: item.distance - 1 });
					}
				}				
			}
		}
		var returnMe = [];
		for (var [key, value] of Object.entries(results)) {
			if (!Coordinate.equal(value, start)) returnMe.push(value);
		}
		return returnMe;
	}
	
	
	static findPath2(battlefield, start, end, okayFn, distanceLimit) {
		var queue = new PriorityQueue(function(item) {
			return item.score;
		});
		var finalCandidates = new PriorityQueue(function(item) {
			return item.score;
		});
		
		var scoreFn = function(previous, current) {
			var newScore = 0;
			var distanceCoord = Coordinate.minus(end, current);
			newScore += Math.sqrt((distanceCoord.x * distanceCoord.x) + (distanceCoord.y * distanceCoord.y));

			if (Coordinate.equal(previous.delta, Coordinate.minus(current, previous.node))) {
				// Same direction!  Fewer points.
				newScore = newScore / 2;				
			}
						
			return previous.score + newScore;
		};
		
		queue.insert({
			score: 0,
			node: start,
			delta: Coordinate.value(0,0),
			path: [start],
			distance: 0
		});
		
			
		while (queue.peekLowest()) {
			var current = queue.popLowest();			
			if (Coordinate.equal(end, current.node)) {
				// Add it to our candidates.
				finalCandidates.insert(current);
				if (finalCandidates.length() >= Math.max(1, Math.floor(distanceLimit / 3))) {
					return finalCandidates.peekLowest().path;
				}
				continue;
			}
			if (distanceLimit > 0 && distanceLimit <= current.distance) {
				// We went too far.
				continue;
			}
			var flatDistanceCoord = Coordinate.abs(Coordinate.minus(end, current.node));
			var flatDistance = flatDistanceCoord.x + flatDistanceCoord.y;
			
			if (distanceLimit > 0 && flatDistance > distanceLimit - current.distance) {
				// We can't possibly get to the finish in time.
				continue;
			}
			
			var cell = Battlefield.findCell(battlefield, current.node);			
			
			var candidates = Coordinate.neighbors(current.node);
			// Filter out not-okay cells.			
			candidates = candidates
					// Filter out any nonsense cells.
					.filter(item => !!Battlefield.findCell(battlefield, item))
					// Check our okay function.
					.filter(item => okayFn(battlefield, Battlefield.findCell(battlefield, item)));
			candidates = candidates.map(item => {
				return {
					node: item,
					score: scoreFn(current, item),
					delta: Coordinate.minus(item, current.node),
					path: current.path.concat([item]),
					distance: current.distance + 1
				};
			});
			// Filter out circular paths.
			candidates = candidates.filter(function(item) {
				for (var i = 0; i < item.path.length - 1; i++) {
					if (Coordinate.equal(item.path[i], item.node)) return false;
				}
				return true;
			});
			
			candidates.forEach(candidate => queue.insert(candidate));			
		}
		if (finalCandidates.length() == 0) return null;
		return finalCandidates.peekLowest().path;
	}
	
	// Basic pathfinding with no turning around.
	static findPath(battlefield, start, end, okayFn) {
		// If we have longer to move in one direction, prioritize that one.
		var delta = Coordinate.minus(end, start);
		var unit = Coordinate.unit(delta);		
		
		var priorities = {
			x: ["x", "y"],
			y: ["y", "x"]
		};

		var path = [ {
			coord: Coordinate.copy(start),
			idx: -1,
			directions: delta.x > delta.y ? priorities.x : priorities.y,
		} ];
				
		while (path[path.length - 1].coord.x != end.x || path[path.length - 1].coord.y != end.y) {
			var peek = path[path.length - 1];			
			var keys = peek.directions;
			
			var delta = Coordinate.minus(peek.coord, end);
			var avoiding = false;
			// If we already are at our destination on this axis, we should prioritize the other one.
			if (delta[keys[0]] == 0) {
				keys.push(keys.shift());
				avoiding = true;
			}			
			
			var candidate = null;			
			for (peek.idx = peek.idx + 1; peek.idx < keys.length; peek.idx++) {
				var coord = Coordinate.copy(peek.coord);
				coord[keys[peek.idx]] += unit[keys[peek.idx]];
				if (unit[keys[peek.idx]] == 0) {
					//
				}
				var cell = Battlefield.findCell(battlefield, coord);
				if (cell && okayFn(battlefield, cell)) {
					// Cool, we found it.
					candidate = coord;
					break;
				}				
			}
			if (!candidate) {
				// No candidate?  Gotta walk backwards or admit defeat.
				path.pop();
				if (path.length == 0) {
					// We popped our start, so no valid path.
					return null;
				}
			} else {
				path.push({
					coord: candidate,
					idx: -1,
					directions: priorities[keys[peek.idx]]
				});
			}
		}
		return path.map(x => x.coord);		
	}
	
	static findWalkPath(battlefield, start, destination, config) {
		var okFns = [
			// Note: These are in priority order and should be populated
			// based on the opt_config.
			Predicates.not(CTPredicates.cellHasUnit) // Can't walk into units.
			// TODO: Put other things in here as there are reasons to avoid things.
		];
		
		
		var path;
		while (!path && okFns.length > 0) {
			path = BoardEffects.findPath2(battlefield, start, destination, okFns.shift(), config.distance);
		}
		return path;
	}
	
	static moveUnitAlongPath(battlefield, unit, path, optBeforeMove, optAfterMove) {
		for (var i = 1; i < path.length; i++) {
			if (optBeforeMove) optBeforeMove(battlefield, unit, path[i-1], path[i]);
			BoardEffects.stepUnit(battlefield, path[i-1], path[i]);	
			var cell = Battlefield.findCell(battlefield, path[i-1]);
			DomHighlighter.highlight(cell);
			cell = Battlefield.findCell(battlefield, path[i]);
			DomHighlighter.highlight(cell);
			
			
			if (optAfterMove) optAfterMove(battlefield, unit, path[i-1], path[i]);
		}
	}
		
	static DealDamage(source, target, damageAmount, params) {
		var defend = Unit.getDefend(target);
		var hpDamage = Math.max(damageAmount - defend, 0);
		defend = Math.max(defend - damageAmount, 0);
		Unit.setDefend(target, defend);
		if (hpDamage > 0) {
			var hp = Math.max(Unit.getHP(target) - hpDamage, 0);
			
			Unit.setHP(target, hp);
			if (hp == 0) {
				Battlefield.removeUnit(target);
			}
		}		
	}
	
	static DelayAll(targets, config) {
		if (targets.length == 0) return;
		var initiativeTracker = InitiativeTracker.find(targets[0]);
		
		// Sort so our last targets are first in the list.
		targets.sort(function(a, b) {
			return InitiativeTracker.indexOfUnit(a) - InitiativeTracker.indexOfUnit(b);
		}).reverse();
		
		var max = InitiativeTracker.size(initiativeTracker);
		for (var target of targets) {
			InitiativeTracker.moveUnitTo(target,
					Math.max(max, InitiativeTracker.indexOfUnit(target) + config.amount));
			// Walk our max back to prevent the end of the list from being weird.
			max = max - 1;
		}
		
	}
}


/** Container classes for actions, which are how players cause board effects. */

class EncounterController {

	/** The action that happens when you pick a target during a turn. */
	static SelectTargetForPlayerAction(evt, handler) {
		var target = WoofType.findUp(evt.target, "Target");
		
		var battlefield = Battlefield.find(evt.target);
		var activeUnit = Unit.findActive(battlefield);
		var selectedCards = CardHud.findSelectedCards(evt.target);
		
		var moves = TargetController.getTargetContext(target);
		if (moves.length > 1) {
			Logger.warn("Multiple move options!", moves);
		}
		if (moves.length == 0) {
			Logger.err("No move options?!", target);
			throw boom("No move options", target);
		}
		var moveId = moves[0];		
		var moveRef = MoveDB.resolveRef(activeUnit, moveId);
		var move = MoveDB.resolve(moveRef);
		var paramFn = MoveDB.paramFn(move);
		var evokeFn = MoveDB.evokeFn(move);
		
		var trigger = Triggers.findUp(moveRef);
		
		var params = paramFn(trigger, selectedCards, activeUnit);
		
		var result = evokeFn(activeUnit, target, params, selectedCards);
		TargetController.clearTarget(handler);

		CardHud.discardCards(result.discard);		
		InitiativeTracker.moveCurrent(handler, result.initiative);
	}
	
	/** Event handler for what happens when you change what card is selected. */
	static OnCardSelectChange(evt, handler) {
		// Find our battlefield.
		var battlefield = Battlefield.find(evt.target);
		// Find our active unit.
		var activeUnit = Unit.findActive(battlefield);
		// Find our selected cards.
		var selectedCards = CardHud.findSelectedCards(evt.target);
		
		var actives = {};
				
		var triggers = Triggers.findAll(activeUnit);
		for (var trigger of triggers) {
			var activeCheckHandler = Triggers.activeFn(trigger);
			if (activeCheckHandler(trigger, selectedCards, activeUnit)) {			
				ActiveAttr.set(trigger, true);	
				
				var move = MoveDB.resolve(Triggers.move(trigger));
				var paramsFn = MoveDB.paramFn(move);
				var targetsFn = MoveDB.targetFn(move);
				
				var params = paramsFn(trigger, selectedCards, activeUnit);
				var targets = targetsFn(activeUnit, params); 
				var moveId = MoveDB.id(move);

				if (!actives[moveId]) actives[moveId] = [];
				actives[moveId].extend(targets);				
			} else {
				ActiveAttr.set(trigger, false);
			}
		}
		TargetController.clearTarget(handler);
		TargetController.setHandler(battlefield, "EncounterController.SelectTargetForPlayerAction");
		for (var [key, value] of Object.entries(actives)) {
			TargetController.addTargets(battlefield, value, key);
		}
	}
	
	static OnActiveUnitChange(event, handler) {		
		var unit = event.detail.node;
		var controller = Team.findController(unit);
		if (!Unit.isActive(unit)) {
			// No longer their turn.  End their turn.
			WoofRootController.invokeController(controller + ".EndTurn", [unit]);
		} else {
			// Now their turn.  Start it.
			WoofRootController.invokeController(controller + ".StartTurn", [unit]);
		}		
	}
}
WoofRootController.register(EncounterController);


// Influencing on enemies.
class Flanking {
  static isFlanked(elt) {
	  return Att.bool(elt, 'flanked', false);
  }

  static OnInfluenceChange(event, handler) {
	  var thisUnit = event.detail.node;
	  var units = Influencing.getInfluencedBy(event.detail.node);
	  var battlefield = Battlefield.find(thisUnit);
	  
	  var teams = {};
	  units.map(unitId => Unit.findById(battlefield, unitId))
			.forEach(function(thatUnit) {
				var team = TeamIdAttr.get(thatUnit);
				teams[team] = !!teams[team] ? teams[team] + 1 : 1
			});
	  var myCrew = TeamIdAttr.get(thisUnit);
	  var support = 0;
	  var opposed = 0;
	  for (var [key, value] of Object.entries(teams)) {
		 if (Team.opposed(battlefield, key, myCrew) && opposed < value) opposed = value;
		 if (Team.allied(battlefield, key, myCrew) && support < value) support = value;
	  }
	  
	  var currentlyFlanked = Att.bool(thisUnit, 'flanked');
	  var currentlySupported = Att.bool(thisUnit, 'supported');
	  if (currentlyFlanked != (opposed > 1)) {
		  thisUnit.setAttribute('flanked', !currentlyFlanked);
	  }
	  
	  if (currentlySupported != (support > 0)) {
		  thisUnit.setAttribute('supported', !currentlySupported);
	  }
  }
}
WoofRootController.register(Flanking);

// Influencing on allies.
class Supporting {
  static isSupported(elt) {
	  return Att.bool(elt, 'supported', false);
  }
}
WoofRootController.register(Supporting);

class Influencing {	

	// Sets which cells the unit is influencing.
	static __setInfluencing(unit, coords) {
		var battlefield = Battlefield.find(unit);
		ParamList.put(unit, 'influences', coords.map(coord => Coordinate.toBattlefieldLabel(battlefield, coord)));
	}

	// Returns the units influencing the current cell.
	static __findInfluencingMe(unit) {
		var battlefield = Battlefield.find(unit);
		return battlefield.querySelectorAll('[influences~="' + Coordinate.toBattlefieldLabel(battlefield, Unit.coordinate(unit)) + '"]');
	}
	
	static __findWhoIInfluence(unit) {
		var battlefield = Battlefield.find(unit);
		if (!battlefield) Battlefield.find(document.body);
		
		return battlefield.querySelectorAll('[influencedBy~="' + Unit.getId(unit) + '"]');
	}

	static __findInfluencingThemCoords(unit) {
		var battlefield = Battlefield.find(unit);
		// Only adjacent for now.
		return Coordinate.neighbors(Unit.coordinate(unit))
				// Only real cells plz
				.filter(coord => !!Battlefield.findCell(battlefield, coord))
	}

	static getInfluencedBy(activeElt) {
		return ParamList.get(activeElt, 'influencedBy');
	}
	
	static __resetInfluences(thisUnit) {
		var battlefield = Battlefield.find(thisUnit);
		
		var influencingMe = Influencing.__findInfluencingMe(thisUnit);
		var influencingThemCoords = Influencing.__findInfluencingThemCoords(thisUnit);
		var alreadyInfluencing = Influencing.__findWhoIInfluence(thisUnit);
		alreadyInfluencing.forEach(thatUnit => influencingThemCoords.contains(Unit.coordinate(thatUnit)) || ParamList.remove(thatUnit, 'influencedBy', Unit.getId(thisUnit)));

		ParamList.put(thisUnit, 'influencedBy', influencingMe.map(thatUnit => Unit.getId(thatUnit)));
		Influencing.__setInfluencing(thisUnit, influencingThemCoords);
		
		var influencingThem = influencingThemCoords.map(coord => Unit.findAt(battlefield, coord)).filter(thatUnit => !!thatUnit);
		influencingThem.forEach(thatUnit => ParamList.add(thatUnit, 'influencedBy', Unit.getId(thisUnit)));		
	}
	
	static __removeInfluences(thisUnit) {
		var alreadyInfluencing = Influencing.__findWhoIInfluence(thisUnit);
		alreadyInfluencing.forEach(thatUnit => ParamList.remove(thatUnit, 'influencedBy', Unit.getId(thisUnit)));
	}
	
	static OnUnitMove(event, handler) {
		Influencing.__resetInfluences(event.detail.unit);
	}
	
	static OnUnitAdd(event, handler) {
		Influencing.__resetInfluences(event.detail.unit);
	}
	
	static OnUnitRemove(event, handler) {
		// Remove this unit's influence.
		Influencing.__removeInfluences(event.detail.unit);
	}	
}
WoofRootController.register(Influencing);


// ############################################################
// ###########        PLAYERS AND SICH       ##################
// ############################################################

class AllTeamBehaviors {
	static startTurn(unit) {
		DomHighlighter.highlight(unit);
		unit.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
			inline: 'center'
		});
	}
}

class Player {
	static StartTurn(unit) {
		AllTeamBehaviors.startTurn(unit);
		Logger.info("Start of player turn.");
	}
	
	static EndTurn(unit) {
		Logger.info("End of player turn.");		
	}
}
WoofRootController.register(Player);


class AI {
	
	static __expandIntoPermutations(cards) {
		var permutations = [];
		for (var i = 0; i < cards.length; i++) {
			var toAdd = [[cards[i]]];
			for (var j = 0; j < permutations.length; j++) {
				var clone = [...permutations[j]];
				clone.push(cards[i]);
				toAdd.push(clone);				
			}
			permutations.extend(toAdd);
		}
		return permutations;
	}
	
	static __resolveTrigger(unit, trigger, cards) {
		// First, check the trigger.
		if (!Triggers.activeFn(trigger)(trigger, cards, unit)) return null;
				
		var moveId = RefAttr.get(Triggers.move(trigger));		
		var move = MoveDB.resolve(trigger, moveId);
		
		var params = MoveDB.paramFn(move)(trigger, cards, unit);
		var targets = MoveDB.targetFn(move)(unit, params);
		if (!targets || targets.length == 0) return null;

		var currentBest = null;
		for (var option of targets) {
			var score = BlueprintFunction.find(move, 'score')(unit, option, params, cards);
			if (!currentBest || currentBest.score < score) {
				currentBest = {
					trigger: trigger,
					cards: cards,
					moveId: moveId,
					move: move,
					params: params,
					target: option,
					score: score					
				};				
			}			
		}
		return currentBest;
	}
	
	static StartTurn(unit) {
		Logger.info("Start of AI turn.");				

		AllTeamBehaviors.startTurn(unit);
		
		// Temporary hard-coded AI:
		// - If you can attack, do so (biggest one).
		// - If you can get closer to an enemy, do so (closest one with space, longest distance).
		// - If you can defend, defend.

		var cards = Unit.getIntentCards(unit);
		var permutations = AI.__expandIntoPermutations(cards);		
		var triggers = Trigger.findAll(unit);
		
		var dials = AIDial.findMap(unit);
		
		var options = [];		
		for (var i = 0; i < triggers.length; i++) {
			for (var j = 0; j < permutations.length; j++) {				
				var trigger = triggers[i];
				var possibility = AI.__resolveTrigger(unit, trigger, permutations[j]);
				if (possibility) options.push(possibility);
			}			
		}
		
		// Lastly, prioritize each by weight.
		var currentWinnerValue = -100;
		var currentWinner = null;
		for (var value of options) {
			var dial = AIDial.find(unit, RefAttr.buildSelector(value.moveId));
			var weight = !!dial ? AIDial.value(dial) : 0.5;
			var score = value.score * weight;
			
			if (score > currentWinnerValue) {
				currentWinnerValue = weight;
				currentWinner = value;
			}			
		}
		
		if (!currentWinner) {
			throw boom("No action, uh oh.");
		}

		// Now invoke the thing.
		var evokeFn = MoveDB.evokeFn(currentWinner.move);
		var result = evokeFn(unit, currentWinner.target, currentWinner.params, currentWinner.cards);

		AI.__discardCards(unit, currentWinner.cards);		
		InitiativeTracker.moveCurrent(unit, result.initiative);		
	}
	
	static EndTurn(unit) {
		Logger.info("End of AI turn.");
		
		// Add some intent cards.
		var currentIntents = Unit.getIntentCards(unit);
		// This should be configurable and in the unit's <info> block.
		AI.__drawCardsFor(unit);
	}
	
	
	static __initializeDeck(teamInfo) {
		// Filter out the jokers.
		var aiDeck = Templates.inflateIn("ai-deck", teamInfo);
		var cards = DeckDB.generate(teamInfo).filter(cardConfig => cardConfig.rank > 0);
		cards.shuffle();
				
		var drawPile = WoofType.queryAll(teamInfo, "DrawPile")[0];
		cards.forEach(card => Card.create(drawPile, card));		
	}
	
	static __drawCardsFor(unit) {
		var deck = TeamInfo.find(unit).querySelector("deck");
		var currentIntents = Unit.getIntentCards(unit);
		var dials = AIDial.findMap(unit);
				
		// TODO: This is where we'd be smarter about how the AI picks
		// cards from the top N cards in the deck and only fills up
		// to a specific size.
		var numToDraw = AIDial.value(dials.intent_hand_size) - currentIntents.length;
		if (numToDraw <= 0) return;
		
		while(!!deck.firstElementChild && numToDraw-- > 0) {
			Unit.addIntentCards(unit, [deck.firstElementChild]);
		}		
	}
	
	static __discardCards(unit, cards) {
		var deck = Team.resolve(unit).querySelector("deck");
		cards.forEach(card => deck.appendChild(card));
	}
}
WoofRootController.register(AI);


// ############################################################
// ##########       INFO CLASSES N SICH          ##############
// ############################################################


// Info roots, or "How to navigate up to the point where you start looking down"
// and "how to find the one thing below you."

class EncounterInfoRoot {}
Utils.classMixin(EncounterInfoRoot, BaseInfoRoot, {
	relativeTo: EncounterScreenHandler,
	relativeMatcher: 'info.encounter',	
});


class UnitInfoRoot {}
Utils.classMixin(UnitInfoRoot, BaseInfoRoot, {
	relativeTo: Unit,
	relativeMatcher: 'info.unit',	
});

class AnyInfoRoot {}
Utils.classMixin(AnyInfoRoot, BaseInfoRoot, {
	relativeMatcher: 'info'
});



class Trigger {}
Utils.classMixin(Trigger, BaseInfo,  {
	infoRoot: UnitInfoRoot,
	matcher: 'trigger',
	templateName: 'trigger',
	idFn: IdAttr.get,
	refFn: TriggerIdAttr.get,
	refSelectorFn: IdAttr.buildSelector
});


class TeamInfo {}
Utils.classMixin(TeamInfo, BaseInfo, {
	infoRoot: EncounterInfoRoot,	
	matcher: 'team-info',
	templateName: 'team_info',
	idFn: IdAttr.get,
	refFn: TeamIdAttr.get,
	refSelectorFn: IdAttr.buildSelector
});

class AIDial {
	static value(dial) {
		var type = dial.getAttribute("type").toLowerCase().trim();
		if (type == "int") {
			return parseInt(dial.getAttribute("value"));
		}
		if (type == "number") {
			return Number(dial.getAttribute("value"));
		}
		if (type == "bool") {
			return dial.getAttribute("value") == true;
		}
		return dial.getAttribute("value");
	}
}
Utils.classMixin(AIDial, BaseInfo, {
	infoRoot: UnitInfoRoot,
	matcher: 'ai-dial',
	templateName: 'ai_dial',
	idFn: NameAttr.get,
	refFn: (id, name) => name,
	refSelectorFn: id => '[name="' + id + '"]'
});


// ############################################################
// ###########        MOVES AND SICH       ####################
// ############################################################

class MovementPredicates {
	static BASIC_MOVEMENT = Predicates.and(
		// Note: These are in priority order.
	    Predicates.not(CTPredicates.cellHasUnit) // Can't walk into units.
	);
	
}

class MoveDefaults {
	static defaults(cards, opt_initiative) {
		return {
			discard: cards,
			initiative: (opt_initiative === undefined || opt_initiative === null) ? -1 : opt_initiative
		};
	}
	
	static AlliesInRange(activeUnit, range) {
		var encounter = EncounterScreenHandler.find(activeUnit);
		return MoveDefaults.unitsInRange(activeUnit, range, function(units) {
			return units.filter(unit => Team.allied(encounter, activeUnit, unit))
						.filter(unit => unit != activeUnit);
		});
	}
	
	static EnemiesInRange(activeUnit, range) {
		var encounter = EncounterScreenHandler.find(activeUnit);
		return MoveDefaults.unitsInRange(activeUnit, range, function(units) {
			return units.filter(unit => Team.opposed(encounter, activeUnit, unit))
						.filter(unit => unit != activeUnit);
		});
	}
	
	static unitsInRange(activeUnit, range, predicate) {
		var battlefield = Battlefield.find(activeUnit);
		var filtered = predicate(Unit.findAll(battlefield).filter(unit => range >= Coordinate.stupidDistance(Unit.coordinate(activeUnit), Unit.coordinate(unit))));
		return filtered;
	}
}


class StepMove {	
	static ToParams(trigger, cards, activeUnit) {
		return {
			distance: cards.length * 2
		};
	}
	
	static ToShiftParams(trigger, cards, activeUnit) {
		return {
			distance: 1
		};		
	}
	
	static ToTargets(activeUnit, params) {
		var battlefield = Battlefield.find(activeUnit);
		var candidates = BoardEffects.findMovementCandidates(battlefield, Unit.coordinate(activeUnit), params.distance, MovementPredicates.BASIC_MOVEMENT, MovementPredicates.BASIC_MOVEMENT);
		return candidates.map(candidate => Battlefield.findCell(battlefield, candidate));
	}
	
	static Evoke(activeUnit, target, params, cards) {
		var battlefield = Battlefield.find(activeUnit);
		var path = BoardEffects.findWalkPath(battlefield, Unit.coordinate(activeUnit), Cell.coordinate(target), {
			distance: params.distance
		});
		if (!path) throw boom("No valid path for", activeUnit, "to get to", target);
		BoardEffects.moveUnitAlongPath(battlefield, activeUnit, path);
		return Promise.resolve(MoveDefaults.defaults(cards));
	}	
	
	static Score(activeUnit, target, params, cards) {
		// Easy solution.
		return 1;
	}
}
WoofRootController.register(StepMove);

class SwapMove {
	static ToParams(trigger, cards, activeUnit) {
		return {
			range: 5
		};
	}
	
	static ToTargets(activeUnit, params) {
		return MoveDefaults.AlliesInRange(activeUnit, params.range);
	}
	
	static Evoke(activeUnit, target, params, cards) {
		var yourId = Unit.getId(target);
		var myId = Unit.getId(activeUnit);
		InitiativeTracker.swap(activeUnit, myId, yourId);
		return Promise.resolve(MoveDefaults.defaults(cards, 0));
	}	
	
	static Score(activeUnit, target, params, cards) {
		// Easy solution.
		return 0;
	}
}
WoofRootController.register(SwapMove);

class StrikeMove {
	static ToParams(trigger, cards, activeUnit) {
		return {
			minRange: 0,
			maxRange: 1,
			damage: 6 * cards.length,
			cards: Array.from(cards)
		};
	}
	
	static ToTargets(activeUnit, params) {
		return MoveDefaults.EnemiesInRange(activeUnit, params.maxRange)
			.filter(unit => Coordinate.stupidDistance(
						Unit.coordinate(unit),
						Unit.coordinate(activeUnit)) >= params.minRange);
	}
	
	static Evoke(activeUnit, target, params, cards) {
		var queue = EffectQueue.findUp(activeUnit);
		BoardEffects.DealDamage(activeUnit, target, params.damage, {});
		return Promise.resolve(MoveDefaults.defaults(cards));
	}	

	static Score(activeUnit, target, params, cards) {
		// Easy solution.
		return 1;
	}	
}
WoofRootController.register(StrikeMove);


class MultistrikeMove {
	static ToParams(trigger, cards, activeUnit) {
		return {
			hits: Array.from(cards).map(card => StrikeMove.ToParams(trigger, [card], activeUnit))
		};
	}
	
	static ToTargets(activeUnit, params) {
		return StrikeMove.ToTargets(activeUnit, params.hits[0]);
	}
	
	static Evoke(activeUnit, target, params, cards) {
		params.hits.forEach(hit => StrikeMove.Evoke(activeUnit, target, hit, hit.cards));
		return Promise.resolve(MoveDefaults.defaults(cards));
	}
	
	static Score(activeUnit, target, params, cards) {
		return StrikeMove.Score(activeWork, target, params, cards);
	}
}
WoofRootController.register(MultistrikeMove);


class DefendMove {
	static ToParams(trigger, cards, activeUnit) {		
		return {
			amount: cards.length * 6
		};
	}
	
	static ToTargets(activeUnit, params) {
		return [activeUnit];
	}
	
	static Evoke(activeUnit, target, params, cards) {
		var defense = Unit.getDefend(activeUnit);
		defense = defense + params.amount;
		Unit.setDefend(activeUnit, defense);
		
		return Promise.resolve(MoveDefaults.defaults(cards));
	}

	static Score(activeUnit, target, params, cards) {
		// Easy AND correct solution!
		return 1;
	}
}
WoofRootController.register(DefendMove);


class ShoutMove {
	static ToParams(trigger, cards, activeUnit) {		
		return {
			volume: cards.length,
			range: 2
		};
	}
	
	static ToTargets(activeUnit, params) {
		return [activeUnit];
	}
	
	static Evoke(activeUnit, target, params, cards) {
		var targets = MoveDefaults.EnemiesInRange(activeUnit, params.range);
		BoardEffects.DelayAll(targets, {
			amount: params.volume
		});
		return Promise.resolve(MoveDefaults.defaults(cards));
	}

	static Score(activeUnit, target, params, cards) {
		// Easy AND correct solution!
		return 1;
	}
}
WoofRootController.register(ShoutMove);
