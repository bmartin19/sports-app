import NflBoxScore from "@/components/nfl-box-score";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ------------------------------------------------------------------ */
/* League config                                                      */
/* ------------------------------------------------------------------ */

// Leagues this screen can show, and the names ESPN uses for them
const LEAGUES: Record<string, { sport: string; league: string }> = {
  nba: { sport: "basketball", league: "nba" },
  wnba: { sport: "basketball", league: "wnba" },
  nfl: { sport: "football", league: "nfl" },
};

/* ------------------------------------------------------------------ */
/* Tabs                                                                */
/* ------------------------------------------------------------------ */

type TabName = "feed" | "quarters" | "boxscore";

const TAB_NAMES: TabName[] = ["feed", "quarters", "boxscore"];

const TAB_LABELS: Record<TabName, string> = {
  feed: "Feed",
  quarters: "By Quarter",
  boxscore: "Box Score",
};

/* ------------------------------------------------------------------ */
/* Box score layout                                                    */
/* ------------------------------------------------------------------ */

/*
 * "core" columns are the 7 that must fit on screen when the box score
 * loads. The rest sit off to the right and are reached by scrolling.
 */
const STAT_COLUMNS = [
  { key: "min", label: "MIN", core: true },
  { key: "pts", label: "PTS", core: true },
  { key: "reb", label: "REB", core: true },
  { key: "ast", label: "AST", core: true },
  { key: "stl", label: "STL", core: true },
  { key: "blk", label: "BLK", core: true },
  { key: "pm", label: "+/-", core: true },
  { key: "fpts", label: "FPTS", core: false },
  { key: "fg", label: "FG", core: false },
  { key: "threefg", label: "3FG", core: false },
  { key: "ft", label: "FT", core: false },
  { key: "to", label: "TO", core: false },
  { key: "pf", label: "PF", core: false },
  { key: "ts", label: "TS%", core: false },
];

const CORE_COUNT = STAT_COLUMNS.filter((col) => col.core).length;
const EXTRA_COUNT = STAT_COLUMNS.length - CORE_COUNT;

const NAME_COL_WIDTH = 112;
const ROW_PADDING = 16; // 8 left + 8 right
const MIN_CORE_COL_WIDTH = 30;
const MAX_CORE_COL_WIDTH = 48;
const EXTRA_COL_WIDTH = 46; // wide enough for "10-15" and "42.6"

type ColumnWidths = {
  core: number; // width of each core column
  extra: number; // width of each extra column
  table: number; // width of the whole table
};

// Works out how wide each column should be for this screen width
function getColumnWidths(screenWidth: number): ColumnWidths {
  /*
   * Phones: the 7 core columns share whatever space is left after the
   * name column, so they all fit on screen. The extra columns have a
   * fixed width and sit off-screen until the user scrolls.
   *
   * Wide screens: if every column can fit at its normal width, they all
   * share the space equally and no scrolling is needed.
   */
  const availableWidth = screenWidth - ROW_PADDING - NAME_COL_WIDTH;
  const widthIfAllFit = Math.floor(availableWidth / STAT_COLUMNS.length);
  const isWideScreen = widthIfAllFit >= EXTRA_COL_WIDTH;

  let core: number;
  let extra: number;
  if (isWideScreen) {
    core = widthIfAllFit;
    extra = widthIfAllFit;
  } else {
    const shareOfSpace = Math.floor(availableWidth / CORE_COUNT);
    // Keep core columns between the min and max width
    core = Math.min(
      MAX_CORE_COL_WIDTH,
      Math.max(MIN_CORE_COL_WIDTH, shareOfSpace),
    );
    extra = EXTRA_COL_WIDTH;
  }

  const table =
    ROW_PADDING + NAME_COL_WIDTH + CORE_COUNT * core + EXTRA_COUNT * extra;

  return { core, extra, table };
}

/* ------------------------------------------------------------------ */
/* Fantasy points                                                      */
/* ------------------------------------------------------------------ */

/*
 * Scoring (FanDuel-style). Change these numbers to use a different
 * scoring system.
 */
const FANTASY_WEIGHTS = {
  pts: 1,
  reb: 1.2,
  ast: 1.5,
  stl: 3,
  blk: 3,
  to: -1,
};

// Turns a stat string like "12" into a number (or 0 if it isn't a number)
function toNumber(text: string) {
  const num = parseFloat(text);
  return Number.isNaN(num) ? 0 : num;
}

function calcFantasyPoints(stats: Record<string, string>) {
  // Players who didn't play have "-" for everything
  if (Number.isNaN(parseFloat(stats.pts))) return "-";

  const total =
    toNumber(stats.pts) * FANTASY_WEIGHTS.pts +
    toNumber(stats.reb) * FANTASY_WEIGHTS.reb +
    toNumber(stats.ast) * FANTASY_WEIGHTS.ast +
    toNumber(stats.stl) * FANTASY_WEIGHTS.stl +
    toNumber(stats.blk) * FANTASY_WEIGHTS.blk +
    toNumber(stats.to) * FANTASY_WEIGHTS.to;

  // Round to 1 decimal place
  return (Math.round(total * 10) / 10).toFixed(1);
}

/* ------------------------------------------------------------------ */
/* Stat helpers                                                        */
/* ------------------------------------------------------------------ */

// Shows plus/minus with a + sign for positive numbers, like "+5"
function formatPlusMinus(value: string) {
  const num = parseInt(value, 10);
  if (Number.isNaN(num)) return value;
  return num > 0 ? `+${num}` : String(num);
}

// Green for positive, red for negative, no color change for zero or "-"
function plusMinusStyle(value: string) {
  const num = parseInt(value, 10);
  if (Number.isNaN(num) || num === 0) return undefined;
  return num > 0 ? styles.positive : styles.negative;
}

// ESPN sometimes uses slightly different names for the same stat
// (like "3PT" or "3P"). This returns the first name that has a value.
function findStat(statMap: Record<string, string>, possibleNames: string[]) {
  for (const name of possibleNames) {
    if (statMap[name] !== undefined) {
      return statMap[name];
    }
  }
  return "-";
}

// True shooting percentage, like "58%". Returns "-" if it can't be worked out.
function calcTrueShooting(fg: string, ft: string, points: string) {
  // FG looks like "5-13" (made-attempted) and FT looks like "2-2"
  const fgParts = fg.split("-");
  const ftParts = ft.split("-");
  if (fgParts.length !== 2 || ftParts.length !== 2) return "-";

  const fieldGoalsAttempted = parseInt(fgParts[1], 10) || 0;
  const freeThrowsAttempted = parseInt(ftParts[1], 10) || 0;
  const pointsScored = parseInt(points, 10) || 0;

  const shootingPlays = fieldGoalsAttempted + 0.44 * freeThrowsAttempted;
  if (shootingPlays <= 0) return "-";

  return `${Math.round((pointsScored / (2 * shootingPlays)) * 100)}%`;
}

/*
 * Builds every stat for one player, keyed to match STAT_COLUMNS.
 *
 * ESPN gives us a list of stat names (statNames) and a list of values
 * (statValues) in the same order, for example:
 *   statNames  = ["MIN", "FG", "3PT", "FT", "REB", ...]
 *   statValues = ["28", "5-13", "2-6", "0-0", "7", ...]
 * We match them up by position instead of guessing which index is which.
 */
function buildPlayerStats(statNames: string[], statValues: string[]) {
  // Build something like { MIN: "28", FG: "5-13", PTS: "12", ... }
  const statMap: Record<string, string> = {};
  statNames.forEach((name, index) => {
    statMap[name] = statValues[index] ?? "-";
  });

  const stats: Record<string, string> = {
    min: findStat(statMap, ["MIN", "MINUTES"]),
    pts: findStat(statMap, ["PTS", "POINTS"]),
    reb: findStat(statMap, ["REB", "REBOUNDS"]),
    ast: findStat(statMap, ["AST", "ASSISTS"]),
    stl: findStat(statMap, ["STL", "STEALS"]),
    blk: findStat(statMap, ["BLK", "BLOCKS"]),
    pm: findStat(statMap, ["+/-", "PM"]),
    fg: findStat(statMap, ["FG", "FGM-FGA"]),
    threefg: findStat(statMap, ["3PT", "3P", "3FG"]),
    ft: findStat(statMap, ["FT", "FTM-FTA"]),
    to: findStat(statMap, ["TO", "TURNOVERS"]),
    pf: findStat(statMap, ["PF", "FOULS"]),
  };

  // These two are calculated from the stats above
  stats.ts = calcTrueShooting(stats.fg, stats.ft, stats.pts);
  stats.fpts = calcFantasyPoints(stats);

  return stats;
}

// Uses ESPN's headshot URL if it gives one, otherwise builds the URL ourselves
function getHeadshotUrl(athlete: any, leagueName: string) {
  if (typeof athlete?.headshot === "string") {
    return athlete.headshot;
  }
  if (athlete?.headshot?.href) {
    return athlete.headshot.href;
  }
  return `https://a.espncdn.com/i/headshots/${leagueName}/players/full/${athlete.id}.png`;
}

// A team's logo can be stored in two different places in ESPN's data
function getLogo(competitor: any) {
  return competitor?.team?.logo ?? competitor?.team?.logos?.[0]?.href;
}

// "Q1" to "Q4", then "OT", "2OT", and so on
function periodLabel(period?: number) {
  if (!period) return "";
  if (period <= 4) return `Q${period}`;
  if (period === 5) return "OT";
  return `${period - 4}OT`;
}

// Gets the list of plays for the feed.
// Basketball has one big list of plays. Football groups plays into drives,
// so we pull them all out of the drives and put them in one list.
function getPlays(gameData: any) {
  if (gameData.drives) {
    const allPlays: any[] = [];
    const drives = [...(gameData.drives.previous ?? [])];
    if (gameData.drives.current) {
      drives.push(gameData.drives.current);
    }
    for (const drive of drives) {
      allPlays.push(...(drive.plays ?? []));
    }
    return allPlays;
  }
  return gameData.plays ?? [];
}

/* ------------------------------------------------------------------ */
/* Tab: Feed                                                           */
/* ------------------------------------------------------------------ */

// Play-by-play, newest play first
function FeedTab({ plays }: { plays: any[] }) {
  if (plays.length === 0) {
    return (
      <Text style={[styles.gray, { padding: 20 }]}>No play data yet.</Text>
    );
  }

  // ESPN lists plays oldest first, so flip a copy of the list
  const newestFirst = [...plays].reverse();

  return (
    <View>
      {newestFirst.map((play, index) => (
        <View key={index} style={styles.playRow}>
          <Text style={styles.green}>
            {periodLabel(play.period?.number)} {play.clock?.displayValue}
          </Text>
          <Text style={styles.white}>{play.text}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: By Quarter                                                     */
/* ------------------------------------------------------------------ */

// A small table of each team's score in each quarter
function QuartersTab({ competition }: { competition: any }) {
  const competitors = competition?.competitors ?? [];
  const awayTeam = competitors.find((c: any) => c.homeAway === "away");
  const homeTeam = competitors.find((c: any) => c.homeAway === "home");

  // One entry per quarter for each team
  const awayScores = awayTeam?.linescores ?? [];
  const homeScores = homeTeam?.linescores ?? [];
  const quarterCount = Math.max(awayScores.length, homeScores.length);

  if (quarterCount === 0) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={styles.gray}>No quarter data yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 16 }}>
      {/* Header row: Team, Q1, Q2, ..., T */}
      <View style={styles.qRow}>
        <Text style={[styles.qTeam, styles.gray]}>Team</Text>
        {Array.from({ length: quarterCount }).map((_, index) => (
          <Text key={index} style={[styles.qCell, styles.gray]}>
            {periodLabel(index + 1)}
          </Text>
        ))}
        <Text style={[styles.qCell, styles.gray]}>T</Text>
      </View>

      {/* Away team */}
      <View style={styles.qRow}>
        <Text style={[styles.qTeam, styles.white]}>
          {awayTeam?.team?.abbreviation}
        </Text>
        {awayScores.map((quarter: any, index: number) => (
          <Text key={index} style={[styles.qCell, styles.white]}>
            {quarter.value}
          </Text>
        ))}
        <Text style={[styles.qCell, styles.white, { fontWeight: "bold" }]}>
          {awayTeam?.score}
        </Text>
      </View>

      {/* Home team */}
      <View style={styles.qRow}>
        <Text style={[styles.qTeam, styles.white]}>
          {homeTeam?.team?.abbreviation}
        </Text>
        {homeScores.map((quarter: any, index: number) => (
          <Text key={index} style={[styles.qCell, styles.white]}>
            {quarter.value}
          </Text>
        ))}
        <Text style={[styles.qCell, styles.white, { fontWeight: "bold" }]}>
          {homeTeam?.score}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Tab: Box Score                                                      */
/* ------------------------------------------------------------------ */

// One player's row in the box score
function PlayerRow({
  playerData,
  statNames,
  leagueName,
  widths,
}: {
  playerData: any;
  statNames: string[];
  leagueName: string;
  widths: ColumnWidths;
}) {
  const athlete = playerData.athlete;
  const stats = buildPlayerStats(statNames, playerData.stats ?? []);
  const headshotUrl = getHeadshotUrl(athlete, leagueName);

  return (
    <View style={[styles.playerRow, { width: widths.table }]}>
      {/* Tapping the name opens the player's profile */}
      <TouchableOpacity
        style={styles.playerInfo}
        onPress={() =>
          router.push({
            pathname: "/profile/[id]",
            params: {
              id: athlete.id,
              name: athlete.displayName,
              headshot: headshotUrl,
            },
          } as any)
        }
      >
        <Image source={{ uri: headshotUrl }} style={styles.headshot} />
        <Text style={[styles.playerName, styles.white]} numberOfLines={1}>
          {athlete.shortName ?? athlete.displayName}
        </Text>
      </TouchableOpacity>

      {/* Tapping the stats opens the player's game stats */}
      <TouchableOpacity
        style={styles.statsTouchable}
        onPress={() =>
          router.push({
            pathname: "/player/[id]",
            params: {
              id: athlete.id,
              name: athlete.displayName,
              headshot: headshotUrl,
              ...stats,
            },
          } as any)
        }
      >
        <View style={styles.statsRow}>
          {STAT_COLUMNS.map((col) => {
            const value = stats[col.key];
            const isPlusMinus = col.key === "pm";

            return (
              <Text
                key={col.key}
                style={[
                  styles.statCol,
                  styles.white,
                  { width: col.core ? widths.core : widths.extra },
                  isPlusMinus && plusMinusStyle(value),
                ]}
              >
                {isPlusMinus ? formatPlusMinus(value) : value}
              </Text>
            );
          })}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function BoxScoreTab({
  teams,
  leagueName,
  selectedTeam,
  onSelectTeam,
}: {
  teams: any[];
  leagueName: string;
  selectedTeam: number;
  onSelectTeam: (index: number) => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const widths = getColumnWidths(screenWidth);

  if (teams.length === 0) {
    return (
      <Text style={[styles.gray, { padding: 20 }]}>No box score yet.</Text>
    );
  }

  // Find the group of stats that has the list of players
  const teamData = teams[selectedTeam];
  const statGroup = teamData?.statistics?.find((group: any) =>
    Array.isArray(group.athletes),
  );
  const players = statGroup?.athletes ?? [];
  const statNames: string[] = statGroup?.names ?? statGroup?.labels ?? [];

  return (
    <View>
      {/* Buttons to switch between the two teams */}
      <View style={styles.teamSlider}>
        {teams.map((team, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => onSelectTeam(index)}
            style={[
              styles.teamSliderBtn,
              selectedTeam === index && styles.teamSliderActive,
            ]}
          >
            <Text
              style={[
                styles.teamSliderText,
                selectedTeam === index && styles.teamSliderActiveText,
              ]}
            >
              {team.team?.abbreviation}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* The table scrolls sideways when it's wider than the screen */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: widths.table }}>
          {/* Column headers */}
          <View style={[styles.statHeaderRow, { width: widths.table }]}>
            <Text style={[styles.nameCol, styles.gray]}>Player</Text>
            {STAT_COLUMNS.map((col) => (
              <Text
                key={col.key}
                style={[
                  styles.statCol,
                  styles.gray,
                  { width: col.core ? widths.core : widths.extra },
                ]}
              >
                {col.label}
              </Text>
            ))}
          </View>

          {/* One row per player */}
          {players.map((playerData: any) => (
            <PlayerRow
              key={playerData.athlete.id}
              playerData={playerData}
              statNames={statNames}
              leagueName={leagueName}
              widths={widths}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function GameScreen() {
  const { id: gameId, league } = useLocalSearchParams<{
    id: string;
    league?: string;
  }>();
  const insets = useSafeAreaInsets();

  // The league comes from the URL. Fall back to WNBA if there isn't one.
  const leagueName = (Array.isArray(league) ? league[0] : league) ?? "wnba";
  const leagueInfo = LEAGUES[leagueName] ?? LEAGUES.wnba;

  const [gameData, setGameData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>("feed");
  const [selectedTeam, setSelectedTeam] = useState(0);

  // Load the game's details from ESPN
  useEffect(() => {
    async function loadGame() {
      try {
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/${leagueInfo.sport}/${leagueInfo.league}/summary?event=${gameId}`,
        );
        const data = await response.json();
        setGameData(data);
      } catch (error) {
        console.log("error:", error);
      }
      setLoading(false);
    }

    loadGame();
  }, [gameId, leagueInfo.sport, leagueInfo.league]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Game" }} />
        <ActivityIndicator size="large" color="#16fd16" />
      </View>
    );
  }

  if (!gameData) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "Game" }} />
        <Text style={styles.white}>Could not load game.</Text>
      </View>
    );
  }

  const competition = gameData.header?.competitions?.[0];
  const homeTeam = competition?.competitors?.find(
    (c: any) => c.homeAway === "home",
  );
  const awayTeam = competition?.competitors?.find(
    (c: any) => c.homeAway === "away",
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title:
            awayTeam && homeTeam
              ? `${awayTeam.team?.abbreviation} @ ${homeTeam.team?.abbreviation}`
              : "Game",
        }}
      />

      {/* Score header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.teamBlock}>
          {getLogo(awayTeam) ? (
            <Image
              source={{ uri: getLogo(awayTeam) }}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.headerLogo} />
          )}
          <Text style={styles.abbrev}>{awayTeam?.team?.abbreviation}</Text>
          <Text style={styles.bigScore}>{awayTeam?.score ?? "-"}</Text>
        </View>

        <Text style={styles.statusText}>
          {competition?.status?.type?.shortDetail ?? ""}
        </Text>

        <View style={styles.teamBlock}>
          {getLogo(homeTeam) ? (
            <Image
              source={{ uri: getLogo(homeTeam) }}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.headerLogo} />
          )}
          <Text style={styles.abbrev}>{homeTeam?.team?.abbreviation}</Text>
          <Text style={styles.bigScore}>{homeTeam?.score ?? "-"}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TAB_NAMES.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
              ]}
            >
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content for the selected tab */}
      <ScrollView style={{ flex: 1 }}>
        {activeTab === "feed" && <FeedTab plays={getPlays(gameData)} />}

        {activeTab === "quarters" && <QuartersTab competition={competition} />}

        {activeTab === "boxscore" &&
          (leagueInfo.sport === "football" ? (
            <NflBoxScore
              playerTeams={gameData.boxscore?.players ?? []}
              statTeams={gameData.boxscore?.teams ?? []}
              leagueName={leagueInfo.league}
              selectedTeam={selectedTeam}
              onSelectTeam={setSelectedTeam}
            />
          ) : (
            <BoxScoreTab
              teams={gameData.boxscore?.players ?? []}
              leagueName={leagueInfo.league}
              selectedTeam={selectedTeam}
              onSelectTeam={setSelectedTeam}
            />
          ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  green: {
    color: "#16fd16",
    fontSize: 15,
  },

  white: {
    color: "white",
  },

  gray: {
    color: "#666",
  },

  positive: {
    color: "#16fd16",
  },

  negative: {
    color: "#ff4d4d",
  },

  /* Score header */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },

  teamBlock: {
    alignItems: "center",
  },

  headerLogo: {
    width: 56,
    height: 56,
    marginBottom: 4,
  },

  abbrev: {
    color: "#aaa",
    fontSize: 13,
    marginBottom: 4,
  },

  bigScore: {
    color: "white",
    fontSize: 42,
    fontWeight: "bold",
  },

  statusText: {
    color: "#aaa",
    fontSize: 12,
    textAlign: "center",
    maxWidth: 100,
  },

  /* Tabs */

  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },

  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },

  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#16fd16",
  },

  tabText: {
    color: "#555",
    fontSize: 13,
    fontWeight: "600",
  },

  activeTabText: {
    color: "#16fd16",
  },

  /* Feed */

  playRow: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },

  /* Quarters */

  qRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },

  qTeam: {
    width: 50,
    fontSize: 13,
  },

  qCell: {
    width: 36,
    textAlign: "center",
    fontSize: 13,
  },

  /* Team selector */

  teamSlider: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },

  teamSliderBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#222",
  },

  teamSliderActive: {
    backgroundColor: "#16fd16",
  },

  teamSliderText: {
    color: "#888",
    fontWeight: "600",
  },

  teamSliderActiveText: {
    color: "#000",
  },

  /* Box score */

  statHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: ROW_PADDING / 2,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },

  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingVertical: 8,
    paddingHorizontal: ROW_PADDING / 2,
  },

  playerInfo: {
    width: NAME_COL_WIDTH,
    flexDirection: "row",
    alignItems: "center",
  },

  headshot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 6,
    backgroundColor: "#333",
  },

  statsTouchable: {
    flex: 1,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  nameCol: {
    width: NAME_COL_WIDTH,
    fontSize: 12,
  },

  playerName: {
    flex: 1,
    fontSize: 12,
  },

  statCol: {
    textAlign: "center",
    fontSize: 12,
  },
});
