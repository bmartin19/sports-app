import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Team = {
  homeAway: "home" | "away";
  winner?: boolean;
  score: string;
  team: { displayName: string; abbreviation: string; logo?: string };
  records?: { type?: string; summary: string }[];
};

type Game = {
  id: string;
  date: string;
  status: {
    type: {
      description: string;
      detail: string;
      shortDetail: string;
      state: string;
    };
  };
  competitions: { competitors: Team[] }[];
};

function formatGameTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRecord(t: Team) {
  return (
    (t.records?.find((r) => r.type === "total") ?? t.records?.[0])?.summary ??
    ""
  );
}

function TeamBadge({
  t,
  big,
  showRecord,
}: {
  t: Team;
  big: boolean;
  showRecord: boolean;
}) {
  return (
    <View style={styles.teamCol}>
      {t.team.logo ? (
        <Image
          source={{ uri: t.team.logo }}
          style={big ? styles.logoBig : styles.logo}
          resizeMode="contain"
        />
      ) : (
        <View style={big ? styles.logoBig : styles.logo} />
      )}
      <Text style={styles.teamName} numberOfLines={1}>
        {t.team.abbreviation}
      </Text>
      {showRecord && (
        <Text style={styles.teamRecord} numberOfLines={1}>
          {getRecord(t)}
        </Text>
      )}
    </View>
  );
}

function SideValue({
  t,
  isPre,
  isPost,
  big,
}: {
  t: Team;
  isPre: boolean;
  isPost: boolean;
  big: boolean;
}) {
  if (isPre) {
    return (
      <View style={styles.valueCol}>
        <Text style={styles.record} numberOfLines={1} adjustsFontSizeToFit>
          {getRecord(t)}
        </Text>
      </View>
    );
  }
  const lost = isPost && t.winner === false;
  return (
    <View style={styles.valueCol}>
      <Text
        style={[styles.score, big && styles.scoreBig, lost && styles.scoreLost]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {t.score ?? "-"}
      </Text>
    </View>
  );
}

function GameCard({ game, league }: { game: Game; league: string }) {
  const { width } = useWindowDimensions();
  const big = width >= 800;

  const competitors = game.competitions[0].competitors;
  const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];

  const state = game.status.type.state; // "pre" | "in" | "post"
  const isPre = state === "pre";
  const isLive = state === "in";
  const isPost = state === "post";

  // pre: start time, live: "5:32 - 2nd" / "Top 5th" / "Halftime", post: "Final"
  const centerText = isPre
    ? formatGameTime(game.date)
    : game.status.type.shortDetail;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.card}
      onPress={() => router.push(`/game/${game.id}?league=${league}` as any)}
    >
      <TeamBadge t={away} big={big} showRecord={!isPre} />
      <SideValue t={away} isPre={isPre} isPost={isPost} big={big} />

      <View style={styles.centerCol}>
        <Text
          style={[
            styles.centerText,
            big && styles.centerTextBig,
            isLive && styles.centerTextLive,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {centerText}
        </Text>
      </View>

      <SideValue t={home} isPre={isPre} isPost={isPost} big={big} />
      <TeamBadge t={home} big={big} showRecord={!isPre} />
    </TouchableOpacity>
  );
}

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

  const dateScrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  function formatDateParameters(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
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

  async function fetchAvailableDates(selected: {
    sport: string;
    league: string;
  }) {
    setDatesLoading(true);
    try {
      const todayStr = formatDateParameters(new Date());

      // fetch current scoreboard with no date filter
      const res = await fetch(
        `http://site.api.espn.com/apis/site/v2/sports/${selected.sport}/${selected.league}/scoreboard`,
      );
      const data = await res.json();

      // get dates from today's events
      const calendarDates: string[] = [];
      if (data.events && data.events.length > 0) {
        data.events.forEach((event: any) => {
          if (event.date) {
            calendarDates.push(formatDateParameters(new Date(event.date)));
          }
        });
      }

      // always generate ±14 days around today regardless
      // this ensures the date bar always has dates to show
      for (let i = -14; i <= 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        calendarDates.push(formatDateParameters(d));
      }

      const unique = [...new Set(calendarDates)].sort();

      setAvailableDates(unique);
      setSelectedDate(todayStr);
    } catch (e) {
      console.log("fetchAvailableDates error:", e);
      const todayStr = formatDateParameters(new Date());
      const dates = [];
      for (let i = -14; i <= 14; i++) {
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
      setGamesLoading(true);
      try {
        const res = await fetch(
          `http://site.api.espn.com/apis/site/v2/sports/${selected.sport}/${selected.league}/scoreboard?dates=${selectedDate}`,
        );
        const data = await res.json();
        setGames(data.events || []);
      } catch (e) {
        console.log("fetchGames error:", e);
        setGames([]);
      }
      setGamesLoading(false);
    }

    fetchGames();

    // only poll if the selected date is today
    // no point refreshing past or future dates
    const todayStr = formatDateParameters(new Date());
    if (selectedDate !== todayStr) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `http://site.api.espn.com/apis/site/v2/sports/${selected.sport}/${selected.league}/scoreboard?dates=${selectedDate}`,
        );
        const data = await res.json();
        const events = data.events || [];

        // only update state if there are live games on this sport/tab
        const hasLiveGames = events.some(
          (event: any) => event.status?.type?.state === "in",
        );

        if (hasLiveGames) {
          setGames(events);
        }
      } catch (e) {
        console.log("polling error:", e);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedDate, league]);

  useEffect(() => {
    if (availableDates.length === 0) return;

    const todayStr = formatDateParameters(new Date());
    const index = availableDates.indexOf(todayStr);
    if (index === -1) return;

    // each tab is 56 wide + 6 margin = 62, plus 12 of left padding
    const tabCenter = 12 + index * 62 + 28;
    const x = Math.max(0, tabCenter - screenWidth / 2);

    // small delay so the tabs have rendered before we scroll
    const timer = setTimeout(() => {
      dateScrollRef.current?.scrollTo({ x, animated: false });
    }, 50);

    return () => clearTimeout(timer);
  }, [availableDates, screenWidth]);

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.appName}>Sportfolio</Text>
        <TouchableOpacity
          onPress={() => router.push("/profile" as any)}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>U</Text>
          </View>
        </TouchableOpacity>
      </View>
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
          ref={dateScrollRef}
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
          renderItem={({ item }) => <GameCard game={item} league={league} />}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  logoBig: { width: 72, height: 72 },
  scoreBig: { fontSize: 40 },
  centerTextBig: { fontSize: 18 },
  teamRecord: { color: "#6b6b70", fontSize: 11, marginTop: 1 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c1c1e",
    borderRadius: 14,
    marginHorizontal: 12,
    marginVertical: 5,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  teamCol: { width: 64, alignItems: "center" },
  logo: { width: 48, height: 48 },
  teamName: { color: "#9a9a9f", fontSize: 12, fontWeight: "600", marginTop: 4 },

  valueCol: { flex: 1, alignItems: "center", justifyContent: "center" },
  score: { color: "white", fontSize: 30, fontWeight: "700" },
  scoreLost: { color: "#6b6b70" },
  record: { color: "#9a9a9f", fontSize: 14 },

  centerCol: { flex: 1.3, alignItems: "center", justifyContent: "center" },
  centerText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  centerTextLive: { color: "#ff4d4d" },

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

  statusLive: { color: "#ff4d4d", fontWeight: "600" },
  statusPre: { color: "#888" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  appName: { color: "white", fontSize: 24, fontWeight: "800" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#16fd16",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#000", fontWeight: "700", fontSize: 16 },
});
