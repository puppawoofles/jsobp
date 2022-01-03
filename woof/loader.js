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