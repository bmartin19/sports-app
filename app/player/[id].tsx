import { router, useLocalSearchParams } from "expo-router";
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function PlayerGameScreen() {
  const {
    id,
    name,
    headshot,
    min,
    pts,
    reb,
    ast,
    stl,
    blk,
    fg,
    threefg,
    ft,
    to,
    pf,
    ts,
  } = useLocalSearchParams();

  const stats = [
    { label: "Minutes", value: min },
    { label: "Points", value: pts },
    { label: "Rebounds", value: reb },
    { label: "Assists", value: ast },
    { label: "Steals", value: stl },
    { label: "Blocks", value: blk },
    { label: "FG", value: fg },
    { label: "3FG", value: threefg },
    { label: "FT", value: ft },
    { label: "Turnovers", value: to },
    { label: "Fouls", value: pf },
    { label: "TS%", value: ts },
  ];

  const headshotUri =
    (headshot as string) ??
    `https://a.espncdn.com/i/headshots/wnba/players/full/${id}.png`;

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.green}>← Back</Text>
      </TouchableOpacity>

      {/* Player header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.push({
              pathname: "/profile/[id]",
              params: { id, name, headshot: headshotUri },
            } as any)
          }
        >
          <Image source={{ uri: headshotUri }} style={styles.headshot} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: "/profile/[id]",
                params: { id, name, headshot: headshotUri },
              } as any)
            }
          >
            <Text style={styles.name}>{name}</Text>
          </TouchableOpacity>
          <Text style={styles.sub}>Game Stats</Text>
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.grid}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statBox}>
            <Text style={styles.statValue}>{stat.value ?? "-"}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  back: { padding: 16, paddingBottom: 4 },
  green: { color: "#16fd16", fontSize: 15 },
  header: { flexDirection: "row", alignItems: "center", padding: 20, gap: 16 },
  headshot: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#333",
  },
  name: { color: "white", fontSize: 22, fontWeight: "bold" },
  sub: { color: "#666", fontSize: 13, marginTop: 2 },
  profileHint: { color: "#444", fontSize: 11, marginTop: 4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 8,
  },
  statBox: {
    width: "29%",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  statValue: { color: "white", fontSize: 22, fontWeight: "bold" },
  statLabel: { color: "#666", fontSize: 11, marginTop: 4, textAlign: "center" },
});
