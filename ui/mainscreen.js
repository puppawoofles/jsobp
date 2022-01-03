class MainScreenHandler {}

Utils.classMixin(MainScreenHandler, AbstractDomController, {
    matcher: '.main_screen'
});
WoofRootController.register(MainScreenHandler);
