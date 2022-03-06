woofLoadThing = function(element, parent, onLoad) {
    var listener = function() {
        onLoad();
        element.removeEventListener('load', listener);
    }
    element.addEventListener('load', listener);
    parent.appendChild(element);
}


window.____loaded = {};

require = function(key) {
    return new Promise(function(resolve, reject) {
        var file = key + ".js";
        var found = window.document.querySelector("script[src='" + file + "']");
        if (!found) {
            var elt = window.document.createElement("script");
            elt.type = "text/javascript";
            var head = window.document.querySelector("head");
            elt.setAttribute("src", file);
            elt.onload = function() {
                window.____loaded[key] = true;
                resolve();
            };
            head.appendChild(elt);            
        } else {
            if (window.____loaded[key]) {
                resolve();
            } else {
                found.onload = resolve;
            }
        }
    });
}

requireAll = function(...keys) {
    var toLoad = Array.from(keys);
    var loadFn = function() {
        if (toLoad.length == 0) return;
        var key = toLoad.shift();
        return require(key).then(loadFn);
    };
    return Promise.resolve(loadFn());
};

loadDataFrame = function(name, src) {
    return new Promise(function(resolve, reject) {

        var existing = window.document.body.querySelector(`iframe[name="${name}$"`);
        if (existing) return resolve();

        var iframe = window.document.createElement('IFRAME');
        iframe.setAttribute('height', 0);
        iframe.setAttribute('width', 0);
        iframe.setAttribute('name', name);
        iframe.setAttribute('src', src);

        woofLoadThing(iframe, document.body, function() {
            WoofRootController.addRoot(iframe.contentDocument.body, [], name);
            window.console.log("Loaded frame ", name);
            resolve();
        });

        window.document.body.appendChild(iframe);
    });
}


loadDataFrames = function(idToSrc) {
    return Promise.all(Array.from(Object.entries(idToSrc)).map(kv => loadDataFrame(kv[0], kv[1])));
}