import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SportsScreen() {
  const [selectedLeague, setSelectedLeague] = useState("NBA");
  const [selectedDay, setSelectedDay] = useState("Mon");
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* League Tabs */}
      <View style={styles.leagueRow}>
        {["NBA", "NFL", "MLB"].map((league) => (
          <TouchableOpacity
            key={league}
            onPress={() => setSelectedLeague(league)}
          >
            <Text
              style={[
                styles.league,
                selectedLeague === league && styles.activeTab,
              ]}
            >
              {league}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dateRow}
      >
        {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
          <TouchableOpacity key={day} onPress={() => setSelectedDay(day)}>
            <Text
              style={[styles.date, selectedDay === day && styles.activeTab]}
            >
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Game Cards */}
      <ScrollView>
        <TouchableOpacity onPress={() => router.push("/game/[id]")}>
          <View style={styles.card}>
            <Text style={styles.cardText}>Lakers vs Warriors</Text>
            <Text style={styles.cardText}>102 - 98</Text>
            <Text style={styles.cardSub}>Final</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/game/[id]")}>
          <View style={styles.card}>
            <Text style={styles.cardText}>Celtics vs Heat</Text>
            <Text style={styles.cardText}>88 - 90</Text>
            <Text style={styles.cardSub}>Q4</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0B",
    paddingTop: 50,
  },

  leagueRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
  },

  league: {
    color: "white",
    fontSize: 18,
  },

  activeTab: {
    color: "#00FFAA",
    fontWeight: "bold",
  },

  dateRow: {
    paddingVertical: 10,
    paddingLeft: 10,
  },

  date: {
    color: "gray",
    marginRight: 15,
    fontSize: 16,
  },

  card: {
    backgroundColor: "#1A1A1A",
    margin: 10,
    padding: 15,
    borderRadius: 10,
  },

  cardText: {
    color: "white",
    fontSize: 16,
  },

  cardSub: {
    color: "gray",
  },
});
