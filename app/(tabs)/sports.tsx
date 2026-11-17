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

// ESPN data for a team in a game
type Competitor = {
  homeAway: "home" | "away";
  winner?: boolean;
  score: string;
  team: { displayName: string; abbreviation: string; logo?: string };
  records?: { type?: string; summary: string }[];
};

// ESPN's data for one game
type Game = {
  id: string;
  date: string;
  status: {
    type: {
      description: string;
      detail: string;
      shortDetail: string;
      state: string; //pre, live, post
    };
  };
  competitions: { competitors: Competitor[] }[];
};

type LeagueInfo = { sport: string; league: string };

// leagues
const LEAGUES: Record<string, LeagueInfo> = {
  nba: { sport: "basketball", league: "nba" },
  nfl: { sport: "football", league: "nfl" },
  mlb: { sport: "baseball", league: "mlb" },
  wnba: { sport: "basketball", league: "wnba" },
  nhl: { sport: "hockey", league: "nhl" },
};

const DAYS_AROUND_TODAY = 14;

// live scores refresh
const REFRESH_INTERVAL_MS = 30000;

const TABS_SIDE_PADDING = 12;
const DATE_TAB_WIDTH = 56;
const DATE_TAB_MARGIN = 6;

// turns a Date into the format ESPN wants
function dateToApiString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

//formats dates into a readable format
function formatDateLabel(dateStr: string) {
  if (dateStr === dateToApiString(new Date())) return "Today";

  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const date = new Date(`${year}-${month}-${day}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// list of dates for the date bar
function getDatesAroundToday() {
  const dates: string[] = [];
  for (let offset = -DAYS_AROUND_TODAY; offset <= DAYS_AROUND_TODAY; offset++) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    dates.push(dateToApiString(date));
  }
  return dates;
}

// ESPN scoreboard
function getScoreboardUrl(leagueInfo: LeagueInfo, date?: string) {
  const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${leagueInfo.sport}/${leagueInfo.league}/scoreboard`;
  return date ? `${baseUrl}?dates=${date}` : baseUrl;
}

// get list of games for a league
async function fetchGames(leagueInfo: LeagueInfo, date: string) {
  const response = await fetch(getScoreboardUrl(leagueInfo, date));
  const data = await response.json();
  return (data.events || []) as Game[];
}

function formatGameTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// get's a team's record
function getRecord(competitor: Competitor) {
  const records = competitor.records ?? [];
  const totalRecord = records.find((r) => r.type === "total") ?? records[0];
  return totalRecord?.summary ?? "";
}

function TeamBadge({
  competitor,
  big,
  showRecord,
}: {
  competitor: Competitor;
  big: boolean;
  showRecord: boolean;
}) {
  return (
    <View style={styles.teamCol}>
      {competitor.team.logo ? (
        <Image
          source={{ uri: competitor.team.logo }}
          style={big ? styles.logoBig : styles.logo}
          resizeMode="contain"
        />
      ) : (
        <View style={big ? styles.logoBig : styles.logo} />
      )}
      <Text style={styles.teamName} numberOfLines={1}>
        {competitor.team.abbreviation}
      </Text>
      {showRecord && (
        <Text style={styles.teamRecord} numberOfLines={1}>
          {getRecord(competitor)}
        </Text>
      )}
    </View>
  );
}

function SideValue({
  competitor,
  isPre,
  isPost,
  big,
}: {
  competitor: Competitor;
  isPre: boolean;
  isPost: boolean;
  big: boolean;
}) {
  if (isPre) {
    return (
      <View style={styles.valueCol}>
        <Text style={styles.record} numberOfLines={1} adjustsFontSizeToFit>
          {getRecord(competitor)}
        </Text>
      </View>
    );
  }

  const lost = isPost && competitor.winner === false;
  return (
    <View style={styles.valueCol}>
      <Text
        style={[styles.score, big && styles.scoreBig, lost && styles.scoreLost]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {competitor.score ?? "-"}
      </Text>
    </View>
  );
}

function GameCard({ game, league }: { game: Game; league: string }) {
  const { width } = useWindowDimensions();
  const big = width >= 800;

  const competitors = game.competitions[0].competitors;
  const awayTeam =
    competitors.find((c) => c.homeAway === "away") ?? competitors[1];
  const homeTeam =
    competitors.find((c) => c.homeAway === "home") ?? competitors[0];

  const state = game.status.type.state;
  const isPre = state === "pre";
  const isLive = state === "in";
  const isPost = state === "post";

  // game time or if the game is finished, then "Final"
  const centerText = isPre
    ? formatGameTime(game.date)
    : game.status.type.shortDetail;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.card}
      onPress={() => router.push(`/game/${game.id}?league=${league}` as any)}
    >
      <TeamBadge competitor={awayTeam} big={big} showRecord={!isPre} />
      <SideValue
        competitor={awayTeam}
        isPre={isPre}
        isPost={isPost}
        big={big}
      />

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

      <SideValue
        competitor={homeTeam}
        isPre={isPre}
        isPost={isPost}
        big={big}
      />
      <TeamBadge competitor={homeTeam} big={big} showRecord={!isPre} />
    </TouchableOpacity>
  );
}

export default function SportsScreen() {
  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [league, setLeague] = useState("nba");
  const [selectedDate, setSelectedDate] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const dateScrollRef = useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // builds date bar and selects today
  async function loadDates(leagueInfo: LeagueInfo) {
    // include dates around today so the bar isn't empty
    const dates = getDatesAroundToday();

    try {
      // includes dates ESPN has
      const response = await fetch(getScoreboardUrl(leagueInfo));
      const data = await response.json();
      for (const event of data.events ?? []) {
        if (event.date) {
          dates.push(dateToApiString(new Date(event.date)));
        }
      }
    } catch (error) {
      console.log("loadDates error:", error);
    }

    // remove duplicates and sort by date
    const uniqueDates = [...new Set(dates)].sort();
    setAvailableDates(uniqueDates);
    setSelectedDate(dateToApiString(new Date()));
  }

  // reload when user changes league
  useEffect(() => {
    setGames([]);
    setAvailableDates([]);
    setSelectedDate("");
    loadDates(LEAGUES[league]);
  }, [league]);

  useEffect(() => {
    if (!selectedDate) return;
    const leagueInfo = LEAGUES[league];

    async function loadGames() {
      setGamesLoading(true);
      try {
        setGames(await fetchGames(leagueInfo, selectedDate));
      } catch (error) {
        console.log("loadGames error:", error);
        setGames([]);
      }
      setGamesLoading(false);
    }

    loadGames();

    //only refresh when looking at today
    if (selectedDate !== dateToApiString(new Date())) return;

    const refreshTimer = setInterval(async () => {
      try {
        const latestGames = await fetchGames(leagueInfo, selectedDate);

        // only update screen if a game is live
        const anyLive = latestGames.some(
          (game) => game.status?.type?.state === "in",
        );
        if (anyLive) {
          setGames(latestGames);
        }
      } catch (error) {
        console.log("refresh error:", error);
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(refreshTimer);
  }, [selectedDate, league]);

  // have today be in the middle of the date bar
  useEffect(() => {
    if (availableDates.length === 0) return;

    const todayIndex = availableDates.indexOf(dateToApiString(new Date()));
    if (todayIndex === -1) return;

    const tabWidthWithMargin = DATE_TAB_WIDTH + DATE_TAB_MARGIN;
    const todayCenter =
      TABS_SIDE_PADDING + todayIndex * tabWidthWithMargin + DATE_TAB_WIDTH / 2;
    const scrollX = Math.max(0, todayCenter - screenWidth / 2);

    const scrollTimer = setTimeout(() => {
      dateScrollRef.current?.scrollTo({ x: scrollX, animated: false });
    }, 50);

    return () => clearTimeout(scrollTimer);
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

      {/* League tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {Object.keys(LEAGUES).map((leagueName) => (
            <TouchableOpacity
              key={leagueName}
              onPress={() => setLeague(leagueName)}
              style={[
                styles.leagueTab,
                league === leagueName && styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.leagueTabText,
                  league === leagueName && styles.activeTabText,
                ]}
              >
                {leagueName.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Scrollable date bar */}
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

      {/* Games list */}
      {gamesLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16fd16" />
        </View>
      ) : games.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: "white" }}>No games on this date</Text>
        </View>
      ) : (
        <FlatList
          data={games}
          keyExtractor={(game) => game.id}
          renderItem={({ item }) => <GameCard game={item} league={league} />}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 32 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Header
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

  // League tabs
  tabsWrapper: { height: 64, justifyContent: "center" },
  tabsContent: { alignItems: "center", paddingHorizontal: TABS_SIDE_PADDING },
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
  activeTab: { backgroundColor: "#16fd16" },
  activeTabText: { color: "#ffffff" },

  // Date tabs
  dateWrapper: { height: 44, justifyContent: "center" },
  dateTab: {
    width: DATE_TAB_WIDTH,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: DATE_TAB_MARGIN,
    borderRadius: 14,
    backgroundColor: "#222",
  },
  activeDateTab: { backgroundColor: "#16fd16" },
  dateTabText: { fontSize: 11, fontWeight: "600", color: "#888" },
  activeDateTabText: { color: "#000" },

  // Game card
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
  logoBig: { width: 72, height: 72 },
  teamName: { color: "#9a9a9f", fontSize: 12, fontWeight: "600", marginTop: 4 },
  teamRecord: { color: "#6b6b70", fontSize: 11, marginTop: 1 },

  valueCol: { flex: 1, alignItems: "center", justifyContent: "center" },
  score: { color: "white", fontSize: 30, fontWeight: "700" },
  scoreBig: { fontSize: 40 },
  scoreLost: { color: "#6b6b70" },
  record: { color: "#9a9a9f", fontSize: 14 },

  centerCol: { flex: 1.3, alignItems: "center", justifyContent: "center" },
  centerText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  centerTextBig: { fontSize: 18 },
  centerTextLive: { color: "#ff4d4d" },
});
