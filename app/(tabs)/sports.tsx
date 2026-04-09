import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

type Team = {
  team: { displayName: string };
  score: string;
};

type Game = {
  id: string;
  status: { type: { description: string; state: string } };
  competitions: { competitors: Team[] }[];
};

export default function SportsScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState("nba");

  const sports = {
    nba: { sport: "basketball", league: "nba" },
    nfl: { sport: "football", league: "nfl" },
    mlb: { sport: "baseball", league: "mlb" },
    wnba: { sport: "basketball", league: "wnba" },
    nhl: { sport: "hockey", league: "nhl" },
  };

  useEffect(() => {
    const selected = sports[league as keyof typeof sports];
    setLoading(true);
    fetch(
      `http://site.api.espn.com/apis/site/v2/sports/${selected.sport}/${selected.league}/scoreboard`,
    )
      .then((res) => res.json())
      .then((data) => {
        setGames(data.events || []);
        setLoading(false);
      });
  }, [league]);

  if (loading)
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );

  if (games.length === 0)
    return (
      <View style={styles.container}>
        <Text>No games today</Text>
      </View>
    );

  return (
    <FlatList
      data={games}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const competitors = item.competitions[0].competitors;
        const home = competitors.find((c, i) => i === 0);
        const away = competitors.find((c, i) => i === 1);
        const status = item.status.type.description;

        return (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.team}>{away?.team.displayName}</Text>
              <Text style={styles.score}>{away?.score ?? "-"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.team}>{home?.team.displayName}</Text>
              <Text style={styles.score}>{home?.score ?? "-"}</Text>
            </View>
            <Text style={styles.status}>{status}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#ccc" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  team: { fontSize: 16, color: "white" },
  score: { fontSize: 16, color: "white", fontWeight: "bold" },
  status: { fontSize: 12, color: "green", marginTop: 10 },
  boxscore: { fontSize: 14, color: "yellow" },
});
