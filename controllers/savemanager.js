
class SaveManager {
    
    /** Basic APIs for storing the current save in the DOM. */
    static SaveKey = new ScopedAttr('save-key', StringAttr);
    static SaveData = new ScopedAttr("save-data", BlobAttr);

    static loadToElement(saveElt, saveKey) {
        var blob = SaveManager.loadSaveData(saveKey);
        if (!blob) {
            throw boom("Unknown save key", saveKey);
        }

        SaveManager.SaveKey.set(saveElt, saveKey);
        SaveManager.SaveData.set(saveElt, blob);
    }

    static updateElement(elt, data) {        
        elt = bf(elt, SaveManager.SaveKey.buildSelector());
        if (!elt) throw boom("Unable to update save element, can't find it.");

        var key = SaveManager.SaveKey.get(elt);
        SaveManager.SaveData.set(elt, data);
        
        // Update our save.
        SaveManager.writeSave(key, data);
    }

    static getDataFromElement(elt) {
        elt = bf(elt, SaveManager.SaveKey.buildSelector());
        if (!elt) throw boom("Unable to update save element, can't find it.");

        return SaveManager.SaveData.get(elt);
    }

    /** Methods for managing saves in local storage. */

    static _SAVE_KEYS_KEY = "@save-keys";
    static getSaveKeys() {
        var keys = window.localStorage.getItem(SaveManager._SAVE_KEYS_KEY);
        if (!keys) {
            Logger.info("No saves found!");
            return [];
        }
        return JSON.parse(keys);
    }

    static __putSaveKeys(keys) {
        window.localStorage.setItem(SaveManager._SAVE_KEYS_KEY, JSON.stringify(keys));
    }

    static deleteSave(saveKey) {
        // Remove the keys.
        window.localStorage.removeItem(saveKey);
        var keys = SaveManager.getSaveKeys();
        if (keys.indexOf(saveKey) < 0) return;

        keys.splice(keys.indexOf(saveKey), 1);
        SaveManager.__putSaveKeys(keys);
    }

    static loadSave(saveKey) {
        var found = window.localStorage.getItem(saveKey);
        if (!found) return {};
        return JSON.parse(found);
    }

    static writeSave(saveKey, blob) {
        // Write our key first.
        var keys = SaveManager.getSaveKeys();
        if (keys.indexOf(saveKey < 0)) {
            keys.push(saveKey);
            SaveManager.__putSaveKeys(keys);
        }
        window.localStorage.setItem(saveKey, JSON.stringify(blob));
    }

    static wipe() {
        window.localStorage.clear();
    }
}


/** Methods for doing stuff with a blob of save data. */
class SaveData {
    static initial(opt_seed, protagName) {
        return {
            'global': {
                'seed': opt_seed || Utils.UUID(),
                'protagonist': {
                    'name': protagName
                }
            },
            'last-run': null
        };
    }
}
