
class TitleScreen {

    static OnStart(event, handler) {
        var queue = EffectQueue.find(handler);

        var seedInput = bf(handler, 'input.seed_input').value;

        GameEffect.enqueue(queue, GameEffect.create("Run", {
            startingGold: 50,
            rawSeed: seedInput,
            seed: Noise.stringHash(seedInput)
        })).then(function() {
            // Kick back to title screen.
            Logger.info("Cleaning up run screen.");
            var old = Screen.showScreen(handler, WoofType.buildSelector('TitleScreen'));
            if (old) old.remove();               
        });        
    }

}
WoofRootController.register(TitleScreen);
Utils.classMixin(TitleScreen, AbstractDomController, {
    template: 'title_screen',
    params: function() {}
});