
class UiTreatments {
	// Overall type
	static Type = new ScopedAttr("type", StringAttr);
	static Style = new ScopedAttr("style", StringAttr);
	static Label = new ScopedAttr("label", StringAttr);
	static Delay = new ScopedAttr("delay", IntAttr);

	// For wub
	static Icon = new ScopedAttr("icon", StringAttr);
	static Text = new ScopedAttr("text", StringAttr);
	static ContentFn = new ScopedAttr("content-fn", FunctionAttr);

	// For text
	static Color = new ScopedAttr("color", StringAttr);
	static Shadow = new ScopedAttr("shadow", StringAttr);
	static TextFn = new ScopedAttr("text-fn", FunctionAttr);
	static StartTransform = new ScopedAttr("start-transform", StringAttr);
	static EndTransform = new ScopedAttr("end-transform", StringAttr);	
	static FilterFn = new ScopedAttr("filter-fn", FunctionAttr);
	static TargetFn = new ScopedAttr("target-fn", FunctionAttr);
	static IconFn = new ScopedAttr("icon-fn", FunctionAttr);

	static ExtraClasses = new ScopedAttr("extra-classes", StringAttr);

	static OnAfterUiEffect = GameEffect.after(function(handler, event, params, result) {
		var effects = handler.querySelectorAll("ui-effect");
		var targeting = function(effect) {
			if (UiTreatments.TargetFn.has(effect)) return UiTreatments.TargetFn.invoke(effect, effect, event, params, result);
			if (UiTreatments.TargetFn.has(handler)) return UiTreatments.TargetFn.invoke(handler, handler, event, params, result);
			throw boom("No targeting provided for", handler, effect);
		};
		var filtering = function(effect) {
			if (UiTreatments.FilterFn.has(effect)) return UiTreatments.FilterFn.invoke(effect, handler, event, params, result);
			if (UiTreatments.FilterFn.has(handler)) return UiTreatments.FilterFn.invoke(handler, handler, event, params, result);
			return true;
		}
		var delay = UiTreatments.Delay.get(handler);
		
		for (var effect of effects) {
			// If this is filtered out, skip it.
			if (!filtering(effect)) {
				continue;
			}
			switch (UiTreatments.Type.get(effect)) {
				case "blink":
					var target = targeting(effect);
					if (target) {
						var color = effect.getAttribute("blink-color") || "white";
						DomHighlighter.highlight(target, {
							color: color
						});			
					}	
					break;
				case "wub":
					var target = targeting(effect);
					if (target) {
						var icon = UiTreatments.IconFn.has(effect) ?
								UiTreatments.IconFn.invoke(effect, handler, event, params, result) :
								(UiTreatments.Icon.has(effect) ? (UiTreatments.Icon.get(effect) || "💩") : "💩");
						UiTreatments.__wub(target, icon);
					}
					break;
				case "text":
					var target = targeting(effect);
					if (target) {
						var text = UiTreatments.TextFn.has(effect) ?
								UiTreatments.TextFn.invoke(effect, handler, event, params, result) :
								(UiTreatments.Text.has(effect) ? UiTreatments.Text.get(effect) : null);
						if (text) {
							UiTreatments.__text(target, effect, text);
						}
					}
					break;
				case "scroll-into-view":
					var target = targeting(effect);
					if (target) {
						if (Array.isArray(target)) target = target[0];
						target.scrollIntoView({
							behavior: 'smooth',
							block: 'center',
							inline: 'center'				
						});
					}					
					break;
				case "banner":
					var content = UiTreatments.ContentFn.invoke(effect, handler, event, params, result);
					var extraClasses = UiTreatments.ExtraClasses.get(effect) || '';
					if (content) {
						UiTreatments.__banner(handler, content, extraClasses);
					}
					break;
				case "delay":
					// Do nothing.
					var otherDelay = UiTreatments.Delay.get(effect);
					if (!!otherDelay) {
						delay = Math.max(delay || 0, otherDelay);
					}
					break;
				default:
					Logger.warn("Unknown effect type", TypeAttr.get(effect), effect);				
			}			
		}

		if (!isNaN(delay)) {
			return new Promise(function(resolve, reject) {
				window.setTimeout(resolve, delay);	
			});
		}
	});
	
	static __findEffectContainer(elt) {
		var up = Utils.findUp(elt, '[effect-container]');
		if (!up) throw boom("Unable to find redirect to effect container", elt);
		var down = up.querySelector(up.getAttribute('effect-container'));
		if (!down) throw boom("Unable to find effect container", elt);
		return down;
	}

	static banner(relativeTo, content, extraClasses, effect, delay) {
		UiTreatments.__banner(relativeTo, content, extraClasses);
	}

	static __banner(relativeTo, content, extraClasses) {
		if (typeof content == 'string') {
			content = Templates.inflate('text_banner_wrapper', {
				CONTENT: content
			});
		}
		var textBanner = Utils.bfind(relativeTo, 'body', WoofType.buildSelector("BannerEffect"));
		if (!textBanner) {
			Logger.warn("Can't find text banner.");
			return;
		}
		var wrapper = Templates.inflate('banner_contents', {
			EXTRA_CLASSES: extraClasses
		});
		wrapper.appendChild(content)
		textBanner.appendChild(wrapper);
	}

	static wub(targets, icon) {
		UiTreatments.__wub(targets, icon);
	}
	
	static __wub(targets, icon) {
		if (targets === undefined || targets === null) {
			return;
		}
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
		});
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
	
	static TargetParam = new ScopedAttr("target-param", ListAttr);
	static TargetsFromParams(handler, event, params) {
		if (!UiTreatments.TargetParam.has(handler)) {
			Logger.info("TargetsFromParams called while missing target-param attribute.");
			return [];
		}

		var paramKeys = UiTreatments.TargetParam.get(handler);

		var mappingFn = function(thing) {
			if (params[thing] instanceof HTMLElement) {
				return params[thing];
			}
			if (Array.isArray(params[thing])) {
				return params[thing].map(mappingFn);
			}
			if (typeof thing == 'string') {
				return Utils.bfind(handler, 'body', params[thing]);
			}
			return null;
		};
		return paramKeys.map(mappingFn).flat().filter(function(t) { return !!t; });
	}
		
	static OnBannerContentCreate(event, handler) {
		window.setTimeout(function() {
			var fn = function() {
				if (!handler.parentNode) return;
				handler.removeEventListener('animationend', fn);
				// Remove effect from the DOM.
				handler.remove();
			};
			handler.addEventListener('animationend', fn);
			// Backup option.
			window.setTimeout(fn, 8000);
		});		
	}

	static __text(targets, baseEffect, text) {
		if (targets === undefined || targets === null) {
			return;
		}
		if (!Array.isArray(targets)) {
			targets = [targets];
		}
		targets.forEach(function(target) {
			var color = UiTreatments.Color.get(baseEffect) || "white";
			var shadow = UiTreatments.Shadow.get(baseEffect) || "white";

			var effect = Templates.inflate('text_ui_effect', {
				CONTENT: text,
				COLOR: color,
				SHADOW: shadow
			});

			UiTreatments.EndTransform.copy(effect, baseEffect);
			var startTransform = UiTreatments.StartTransform.get(baseEffect);
			if (startTransform) {
				startTransform = "transform: " + startTransform + ";";
			}
			
			var container = UiTreatments.__findEffectContainer(target);
			container.appendChild(effect);		
			var left = target.offsetLeft + (target.offsetWidth - effect.offsetWidth) / 2;
			var top = target.offsetTop + (target.offsetHeight - effect.offsetHeight) / 2;		

			UiTreatments.Style.append(effect," left: " + left + "px; top: " + top + "px; " + (startTransform || ""))
		});
	}
		
	static OnTempTextCreate(event, handler) {
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

			var endTransform = UiTreatments.EndTransform.get(handler);
			if (endTransform) {
				UiTreatments.Style.append(handler, "transform: " + endTransform + ";")
			}
			
			// Add the class that does the transition.
			handler.classList.add("finalize");
		});		
	}
}
WoofRootController.register(UiTreatments);