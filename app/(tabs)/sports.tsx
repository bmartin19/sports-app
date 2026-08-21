import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../services/supabase";

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
  const [gamesLoading, setGamesLoading] = useState(false);
  const [datesLoading, setDatesLoading] = useState(true);
  const [league, setLeague] = useState("nba");
  const [selectedDate, setSelectedDate] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const sports = {
    nba: { sport: "basketball", league: "nba" },
    nfl: { sport: "football", league: "nfl" },
    mlb: { sport: "baseball", league: "mlb" },
    wnba: { sport: "basketball", league: "wnba" },
    nhl: { sport: "hockey", league: "nhl" },
  };

  function formatDateParameters(date: Date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}${m}${d}`;
  }

  function formatDateLabel(dateStr: string) {
    const todayStr = formatDateParameters(new Date());
    if (dateStr === todayStr) return "Today";
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    const date = new Date(`${year}-${month}-${day}T12:00:00`);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function fetchAvailableDates(selected: {
    sport: string;
    league: string;
  }) {
    setDatesLoading(true);
    try {
      const todayStr = formatDateParameters(new Date());

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const pastStr = formatDateParameters(pastDate);
      const futureStr = formatDateParameters(futureDate);

      const res = await fetch(
        `http://site.api.espn.com/apis/site/v2/sports/${selected.sport}/${selected.league}/scoreboard?dates=${pastStr}-${futureStr}&limit=500`,
      );
      const data = await res.json();

      //ESPN calendar dates returned
      const calendarDates: string[] = [];

      //method 1
      if (data.events && data.events.length > 0) {
        data.events.forEach((event: any) => {
          if (event.date) {
            calendarDates.push(formatDateParameters(new Date(event.date)));
          }
        });
      }

      console.log("dates found:", calendarDates.length, calendarDates);

      //remove duplicates
      const unique = [...new Set(calendarDates)].sort();

      //10 after, 10 before

      if (unique.length === 0) {
        setAvailableDates([todayStr]);
        setSelectedDate(todayStr);
        setDatesLoading(false);
        return;
      }

      setAvailableDates(unique);

      //default to today or closest dates
      if (unique.includes(todayStr)) {
        setSelectedDate(todayStr);
      } else {
        const closest = unique.reduce((prev, curr) =>
          Math.abs(parseInt(curr) - parseInt(todayStr)) <
          Math.abs(parseInt(prev) - parseInt(todayStr))
            ? curr
            : prev,
        );
        setSelectedDate(closest);
      }
    } catch (e) {
      console.log("fetchAvailableDates error:", e);
      const todayStr = formatDateParameters(new Date());
      const dates = [];
      for (let i = -10; i <= 10; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        dates.push(formatDateParameters(d));
      }

      setAvailableDates(dates);
      setSelectedDate(todayStr);
    }
    setDatesLoading(false);
  }

  useEffect(() => {
    const selected = sports[league as keyof typeof sports];
    setGames([]);
    setAvailableDates([]);
    setSelectedDate("");
    fetchAvailableDates(selected);
  }, [league]);

  useEffect(() => {
    if (!selectedDate) return;
    const selected = sports[league as keyof typeof sports];

    async function fetchGames() {
      try {
        const res = await fetch(
          `http://site.api.espn.com/apis/site/v2/sports/${selected.sport}/${selected.league}/scoreboard?dates=${selectedDate}`,
        );
        const data = await res.json();
        console.log(
          "games fetched: ",
          data.events?.length,
          "for date:",
          selectedDate,
        );
        setGames(data.events || []);
      } catch (e) {
        console.log("fetchGames error:", e);
        setGames([]);
      }
      setGamesLoading(false);
    }

    fetchGames();
    const interval = setInterval(fetchGames, 30000);
    return () => clearInterval(interval);
  }, [selectedDate, league]);

  return (
    <View style={{ flex: 1 }}>
      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      {/* League Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {Object.keys(sports).map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => setLeague(key)}
              style={[styles.leagueTab, league === key && styles.activeTab]}
            >
              <Text
                style={[
                  styles.leagueTabText,
                  league === key && styles.activeTabText,
                ]}
              >
                {key.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Scrollable Date bar */}
      <View style={styles.dateWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {availableDates.map((dateStr) => {
            const isSelected = selectedDate === dateStr;
            return (
              <TouchableOpacity
                key={dateStr}
                onPress={() => setSelectedDate(dateStr)}
                style={[styles.dateTab, isSelected && styles.activeDateTab]}
              >
                <Text
                  style={[
                    styles.dateTabText,
                    isSelected && styles.activeDateTabText,
                  ]}
                >
                  {formatDateLabel(dateStr)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Games List */}
      {gamesLoading ? (
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#16fd16" />
        </View>
      ) : games.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: "white" }}>No games on this date</Text>
        </View>
      ) : (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  logoutButton: {
    backgroundColor: "#000",
    padding: 12,
    margin: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  logoutText: { color: "white", fontWeight: "bold" },

  card: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#ccc" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  team: { fontSize: 16, color: "white" },
  score: { fontSize: 16, color: "white", fontWeight: "bold" },
  status: { fontSize: 12, color: "green", marginTop: 10 },

  //league tabs
  tabsWrapper: { height: 64, justifyContent: "center" },
  tabsContent: { alignItems: "center", paddingHorizontal: 12 },
  leagueTab: {
    width: 64,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    borderRadius: 18,
    backgroundColor: "#333",
  },
  leagueTabText: { fontSize: 13, fontWeight: "600", color: "#aaaaaa" },

  //date tabs
  dateWrapper: { height: 44, justifyContent: "center" },
  dateTab: {
    width: 56,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
    borderRadius: 14,
    backgroundColor: "#222",
  },
  activeDateTab: { backgroundColor: "#16fd16" },
  dateTabText: { fontSize: 11, fontWeight: "600", color: "#888" },
  activeDateTabText: { color: "#000" },

  activeTab: { backgroundColor: "#16fd16" },
  activeTabText: { color: "#ffffff" },
});
