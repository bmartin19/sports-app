import { useEffect, useState } from "react";
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
    <View style={{ flex: 1 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
      >
        {Object.keys(sports).map((key) => (
          <TouchableOpacity
            key={key}
            onPress={() => setLeague(key)}
            style={[styles.tab, league === key && styles.activeTab]}
          >
            <Text
              style={[styles.tabText, league === key && styles.activeTabText]}
            >
              {key.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={games}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const competitors = item.competitions[0].competitors;
          const home = competitors[0];
          const away = competitors[1];
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
    </View>
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
  tabs: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "#eee",
  },
  activeTab: { backgroundColor: "#000" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#666" },
  activeTabText: { color: "#fff" },
});
