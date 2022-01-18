class Visitors {
    static Frequency = new ScopedAttr("frequency", IntAttr);
    static HalfFrequency(visitor) {
        var elt = Visitors.Frequency.find(visitor);
        var value = Visitors.Frequency.get(elt);
        Visitors.Frequency.set(elt, Math.max(Math.floor(value / 2), 1));
    }

    static PlusOneFrequency(visitor) {
        var elt = Visitors.Frequency.find(visitor);
        var value = Visitors.Frequency.get(elt);
        Visitors.Frequency.set(elt, value + 1);
    }

    static ZeroFrequency(visitor) {
        var elt = Visitors.Frequency.find(visitor);
        Visitors.Frequency.set(elt, 0);
    }
}
WoofRootController.register(Visitors);