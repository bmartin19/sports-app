import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function PlayerProfileScreen() {
  const { id, name, headshot } = useLocalSearchParams();
  const [player, setPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlayer() {
      try {
        const res = await fetch(
          `http://site.api.espn.com/apis/site/v2/sports/basketball/wnba/athletes/${id}`,
        );
        const data = await res.json();
        setPlayer(data.athlete);
      } catch (e) {
        console.log("error:", e);
      }
      setLoading(false);
    }
    fetchPlayer();
  }, [id]);

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16fd16" />
      </View>
    );

  const headshotUri =
    (headshot as string) ??
    `https://a.espncdn.com/i/headshots/wnba/players/full/${id}.png`;
  const stats = player?.statistics?.[0]?.splits?.categories?.[0]?.stats ?? [];

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.green}>← Back</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.header}>
        <Image source={{ uri: headshotUri }} style={styles.headshot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{player?.displayName ?? name}</Text>
          <Text style={styles.sub}>
            {player?.position?.displayName ?? ""}
            {player?.team?.displayName ? `  ·  ${player.team.displayName}` : ""}
          </Text>
          <View style={styles.tagRow}>
            {player?.age ? (
              <Text style={styles.tag}>Age {player.age}</Text>
            ) : null}
            {player?.displayHeight ? (
              <Text style={styles.tag}>{player.displayHeight}</Text>
            ) : null}
            {player?.displayWeight ? (
              <Text style={styles.tag}>{player.displayWeight}</Text>
            ) : null}
            {player?.experience?.displayValue ? (
              <Text style={styles.tag}>{player.experience.displayValue}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Season averages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Season Averages</Text>
        {stats.length > 0 ? (
          <View style={styles.grid}>
            {stats.map((stat: any) => (
              <View key={stat.name} style={styles.statBox}>
                <Text style={styles.statValue}>{stat.displayValue ?? "-"}</Text>
                <Text style={styles.statLabel}>
                  {stat.shortDisplayName ?? stat.name}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.gray}>No season stats available.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  back: { padding: 16, paddingBottom: 4 },
  green: { color: "#16fd16", fontSize: 15 },
  gray: { color: "#666" },
  header: { flexDirection: "row", padding: 20, gap: 16, alignItems: "center" },
  headshot: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#333",
  },
  name: { color: "white", fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  sub: { color: "#666", fontSize: 13 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: {
    color: "#aaa",
    fontSize: 12,
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  section: { padding: 20 },
  sectionTitle: {
    color: "#16fd16",
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 16,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statBox: {
    width: "29%",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  statValue: { color: "white", fontSize: 20, fontWeight: "bold" },
  statLabel: { color: "#666", fontSize: 11, marginTop: 4, textAlign: "center" },
});
