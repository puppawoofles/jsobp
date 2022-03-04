class Teams {
    static Player = "player";
    static Enemy = "enemy";
    static Neutral = "neutral";

    static __opposedMap = {
        "player": ["enemy"],
        "enemy": ["player"],
        "neutral": []
    };

    static allTeams() {
        return [Teams.Player, Teams.Enemy, Teams.Neutral];
    }

    static opposed(to) {
        return (Teams.__opposedMap[to] || []).clone();
    }

    // In order of of hostility.
    static not(team) {
        switch (team) {
            case Teams.Player:
                return [Teams.Enemy, Teams.Neutral];
            case Teams.Enemy:
                return [Teams.Player, Teams.Neutral];
            case Teams.Neutral:
                return [Teams.Player, Teams.Enemy];
        }
        return [Teams.Player, Teams.Enemy, Teams.Neutral];
    }
}