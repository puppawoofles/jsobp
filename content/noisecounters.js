class NC {    
    static Seed = "seed";  // Overall Seed.

    // "Parent" trackers that are used as earlier dimensions.
    static Day = "day";  // Includes Act + Day
    static Event = "event"; // Includes event counter + inner event counter (which "page" of a storyboard thing we're on)
    static Round = "round"; // Inclues round number + volley number.

    // "Root" trackers that are used as run-wide counters.
    static Unit = "unit";
    static Encounter = "encounter";
}