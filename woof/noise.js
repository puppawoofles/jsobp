
/**
 * Adapted from Squirrel Eiserloh's http://eiserloh.net/noise/SquirrelNoise5.hpp
 * TODO figure out licensing / credit / whatever.  Suck it, RNG!
 **/
 class Noise {
	static NOISE = [
		parseInt("11010010101010000000101000111111", 2),
		parseInt("10101000100001001111000110010111", 2),
		parseInt("01101100011100110110111101001011", 2),
		parseInt("10110111100111110011101010111011", 2),
		parseInt("00011011010101101100010011110101", 2)
	];

	// Everything after index 3 is me going off script trying to follow patterns.
	// This caps out at 6 dimensions.
	static PRIMES = [1|0, 198491317|0, 6542989|0, 357239|0, 20201|0, 2909|0, 467|0];

	static __seed = null;
	static SetSeed(int) {
		// For caching.
		Noise.__seed = int|0;
	}

	static __noise(int, opt_seed) {
		var seed = (opt_seed !== undefined && opt_seed !== null && !isNaN(opt_seed)) ? opt_seed : Noise.__seed || 0;
		var r = int|0;
		// Good thing I don't give a shit about perf on this project!
		for (var i = 0; i < Noise.NOISE.length; i++) {
			r = (((i % 2) == 0) ? (r * Noise.NOISE[i]) : (r + Noise.NOISE[i]))|0;
			r = i == 0 ? (r + seed)|0 : r;
			r = r ^ (r >>> (((i * 2) % 24) + 9))|0;
		}
		return r; // Should be good enough.
	}

	static noise(parts, opt_seed) {
		var chunk = parts;
		if (Array.isArray(parts)) {
			var chunk = parts.merge(function(total, next, index) {
				return (total + ((next * Noise.PRIMES[index]|0)))|0;
			});
		}
		return Noise.__noise(chunk, opt_seed);
	}

	static SIGN_BIT = parseInt("10000000000000000000000000000000", 2);
	static BIG_VALUE = parseInt("01000000000000000000000000000000", 2) * 2;
	static ONE_OVER_MAX_INT = 1 / 4294967295;
	static float(parts, opt_seed) {
		var raw = Noise.noise(parts, opt_seed);
		if (raw < 0) {
			// Gotta do some dumb JS shit.
			raw = raw ^ Noise.SIGN_BIT;  // Remove sign bit as 32-bit int.
			raw += Noise.BIG_VALUE; // Add sign bit as 64 bit int.
		}
		return raw * Noise.ONE_OVER_MAX_INT;
	}


	static intInRange(parts, min, max, opt_seed) {
		return Math.floor((Noise.float(parts, opt_seed) * (max - min)) + min);
	}


	/** Overly simplistic human distribution test */
	static testSeed(seed, prefixParts) {
		var distributions = [
			[0.0, 0.1],
			[0.1, 0.2],
			[0.2, 0.3],
			[0.3, 0.4],
			[0.4, 0.5],
			[0.5, 0.6],
			[0.6, 0.7],
			[0.7, 0.8],
			[0.8, 0.9],
			[0.9, 1.0]];
		var buckets = distributions.map(function() { return 0; });

		// 10 million is hopefully enough.
		for (var i = 0; i < 10000000; i++) {
			var val;
			if (prefixParts) {
				val = Noise.float(prefixParts.clone().extend([i]), seed);
			} else {
				val = Noise.float(i, seed);
			}
			for (var j = 0; j < distributions.length; j++) {
				var range = distributions[j];
				if (val <= range[1] && val > range[0]) {
					buckets[j]++;
					break;
				}
			}
		}

		return buckets;
	}


	// Adapted from stackoverflow somewhere, totally not crypto-friendly, but
	// that's not the damn point. :D
	// This is used to generate the seed for a run.
	static stringHash(str) {
		var v1 = 0xdeadbeef;  // Yum!!
		var v2 = 0x41c6ce57;  // What does this taste like?
		for (var i = 0; i < str.length; i++) {
			v1 = Math.imul((v1 ^ str.charCodeAt(i)), 2654435761);
			v2 = Math.imul((v2 ^ str.charCodeAt(i)), 1597334677);
		}
		v1 = Math.imul(v1 ^ (v1 >>> 16), 2246822507) ^ Math.imul(v2 ^ (v2 >>> 13), 3266489909);
		v2 = Math.imul(v2 ^ (v2 >>> 16), 2246822507) ^ Math.imul(v1 ^ (v1 >>> 13), 3266489909);		
		return Noise.noise(v1, v2);
	}
}



/** Used to track noise input parts. */
class NoiseCounters {
	static Name = new ScopedAttr('name', StringAttr);
	static Value = new ScopedAttr('value', IntAttr);
	static findCounters(...names) {
		var root = bf(document, 'noise-counters');
		return names.map(function(name) {
			var elt = NoiseCounters.Name.findDown(root, name);
			if (!elt) {
				elt = Templates.inflateIn('woof.noise_counter', root, {
					NAME: name,
					VALUE: 0
				});
			}
			return NoiseCounters.Value.findGet(elt);
		});
	}

	static setCounter(name, value) {
		var root = bf(document, 'noise-counters');
		var elt = NoiseCounters.Name.findDown(root, name);
		if (!elt) {
			elt = Templates.inflateIn('woof.noise_counter', root, {
				NAME: name,
				VALUE: value
			});
		} else {
			NoiseCounters.Value.set(elt, value);
		}
	}

	static getIncLast(...names) {
		var toReturn = NoiseCounters.findCounters.apply(this, names);
		NoiseCounters.setCounter(names[names.length - 1], toReturn[toReturn.length - 1] + 1);
		return toReturn;
	}

	static getImplicit(value, ...names) {
		return NoiseCounters.findCounters.apply(this, names).extend([value]);
	}

	static get(name) {
		return NoiseCounters.findCounters(name)[0];
	}

	static inc(name) {
		var value = NoiseCounters.get(name);
		NoiseCounters.setCounter(name, value + 1);
	}
}

class SRNG {
	constructor(seed, implicitFirst, ...names) {
		// First one is always the seed.
		this.seedName = seed;
		this.implicitFirst = implicitFirst;
		this.names = names;
		this.needsRefresh = true;
	}

	invalidate() {
		this.needsRefresh = true;
	}

	__refresh() {
		if (!this.needsRefresh) return;
		this.seed = NoiseCounters.get(this.seedName);
		this.values = this.names.map(function(name) {
			return NoiseCounters.get(name);
		});
		if (this.implicitFirst) this.values.unshift(0);
		this.needsRefresh = false;
	}

	__tick() {
		this.values[0]++;
		if (!this.implicitFirst) {
			NoiseCounters.set(this.names[0], this.values[0]);
		}
	}

	next() {
		this.__refresh();

		var toReturn = Noise.float(this.values, this.seed);
		this.__tick();
		return toReturn;
	}

	nextInRange(min, max) {
		this.__refresh();

		var toReturn = Noise.intInRange(this.values, min, max, this.seed);
		this.__tick();
		return toReturn;

	}

	nextIdx(forArr) {
		this.__refresh();

		var toReturn = Noise.intInRange(this.values, 0, forArr.length, this.seed);
		this.__tick();
		return toReturn;
	}

	randomValue(forArr, optWeights) {
		if (optWeights) {
			var idx = WeightedValue.getValue(optWeights, this.next());
			if (idx === null) return null;
			return forArr[idx];
		} else {
			return forArr[this.nextIdx(forArr)];
		}
	}

	randomValueR(forArr, optWeights) {
		if (optWeights) {
			var idx = WeightedValue.getValue(optWeights, this.next());
			if (idx === null) return null;
			return forArr.splice(idx, 1)[0];
		} else {
			return forArr.splice(this.nextIdx(forArr), 1)[0];
		}
	}

	shuffle(forArr) {
		var current = forArr.length;
		var temp;
		var rando;
	  
		while (0 != current) {
	
			// Pick a remaining element...
			rando = this.nextInRange(0, current);
			current -= 1;
	
			// And swap it with the current element.
			temp = forArr[current];
			forArr[current] = forArr[rando];
			forArr[rando] = temp;	
		}
	}
}

/** A RNG factory that also registers for auto-invalidation. */
class ASRNG {
    static __rngs = {};

    static newRng(seed, implicitFirst, ...names) {
        var rng = new SRNG(seed, implicitFirst, ...names);

        names.forEach(function(name) {
            if (!ASRNG.__rngs[name]) {
                ASRNG.__rngs[name] = [];
            }
            ASRNG.__rngs[name].push(rng);
        });

        return rng;
    }

    static Counter = new ScopedAttr("counter", StringAttr);
    static __invalidateHandler(effect, handler) {
        var counter = ASRNG.Counter.get(handler);
        if (!counter) return;
        if (!ASRNG.__rngs[counter]) return;
        ASRNG.__rngs[counter].forEach(function(srng) {
            srng.invalidate();
        });
    }
}
WoofRootController.register(ASRNG);