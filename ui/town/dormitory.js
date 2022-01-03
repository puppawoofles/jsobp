class DormitoryScreen {



    static setup(dialog) {

    }

    static teardown(dialog) {

    }




}
Utils.classMixin(DormitoryScreen, AbstractDomController, {
    matcher: '.dormitory',
    template: 'dormitory_screen',
});
WoofRootController.register(DormitoryScreen);