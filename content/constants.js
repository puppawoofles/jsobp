class Activations {
    static front_row = ["F1", "F2", "F3"];
    static middle_row = ["M1", "M2", "M3"];
    static back_row = ["B1", "B2", "B3"];
    static all_rows = Activations.front_row.concat(Activations.middle_row).concat(Activations.back_row);

    static rows(front, middle, back) {
        var returnMe = [];
        if (front) returnMe = returnMe.concat(Activations.front_row);
        if (middle) returnMe = returnMe.concat(Activations.middle_row);
        if (back) returnMe = returnMe.concat(Activations.back_row);
        return returnMe;
    }
}