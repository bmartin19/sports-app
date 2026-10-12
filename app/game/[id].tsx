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
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ------------------------------------------------------------------ */
/* League config                                                       */
/* ------------------------------------------------------------------ */

const LEAGUES: Record<string, { sport: string; league: string }> = {
  nba: { sport: "basketball", league: "nba" },
  wnba: { sport: "basketball", league: "wnba" },
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

const CORE_COUNT = STAT_COLUMNS.filter((c) => c.core).length;
const EXTRA_COUNT = STAT_COLUMNS.length - CORE_COUNT;

const NAME_COL_WIDTH = 112;
const ROW_PADDING = 16; // 8 left + 8 right
const MIN_CORE_COL_WIDTH = 30;
const MAX_CORE_COL_WIDTH = 48;
const EXTRA_COL_WIDTH = 46; // wide enough for "10-15" and "42.6"

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

function calcFantasyPoints(v: Record<string, string>) {
  // Players who didn't play have "-" for everything
  if (Number.isNaN(parseFloat(v.pts))) return "-";

  const n = (x: string) => {
    const num = parseFloat(x);
    return Number.isNaN(num) ? 0 : num;
  };

  const total =
    n(v.pts) * FANTASY_WEIGHTS.pts +
    n(v.reb) * FANTASY_WEIGHTS.reb +
    n(v.ast) * FANTASY_WEIGHTS.ast +
    n(v.stl) * FANTASY_WEIGHTS.stl +
    n(v.blk) * FANTASY_WEIGHTS.blk +
    n(v.to) * FANTASY_WEIGHTS.to;

  return (Math.round(total * 10) / 10).toFixed(1);
}

/* ------------------------------------------------------------------ */
/* Plus/minus helpers                                                  */
/* ------------------------------------------------------------------ */

function formatPlusMinus(val: string) {
  const num = parseInt(val, 10);
  if (Number.isNaN(num)) return val;
  return num > 0 ? `+${num}` : String(num);
}

function plusMinusStyle(val: string) {
  const num = parseInt(val, 10);
  if (Number.isNaN(num) || num === 0) return undefined;
  return num > 0 ? styles.positive : styles.negative;
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function GameScreen() {
  const { id, league } = useLocalSearchParams<{
    id: string;
    league?: string;
  }>();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Falls back to WNBA if no league is passed in (the old behaviour)
  const leagueKey = (Array.isArray(league) ? league[0] : league) ?? "wnba";
  const cfg = LEAGUES[leagueKey] ?? LEAGUES.wnba;

  const [gameData, setGameData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"feed" | "quarters" | "boxscore">(
    "feed",
  );
  const [selectedTeam, setSelectedTeam] = useState(0);

  useEffect(() => {
    async function fetchGame() {
      try {
        const res = await fetch(
          `http://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/summary?event=${id}`,
        );

        const data = await res.json();
        setGameData(data);
      } catch (e) {
        console.log("error:", e);
      }

      setLoading(false);
    }

    fetchGame();
  }, [id, cfg.sport, cfg.league]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16fd16" />
      </View>
    );
  }

  if (!gameData) {
    return (
      <View style={styles.center}>
        <Text style={styles.white}>Could not load game.</Text>
      </View>
    );
  }

  const competition = gameData.header?.competitions?.[0];

  const home = competition?.competitors?.find(
    (c: any) => c.homeAway === "home",
  );

  const away = competition?.competitors?.find(
    (c: any) => c.homeAway === "away",
  );

  const teams = gameData.boxscore?.players ?? [];

  /*
   * Column sizing.
   *
   * Phones: the 7 core columns share whatever space is left after the
   * name column, so they all fit on screen. The extra columns have a
   * fixed width and sit off-screen until the user scrolls.
   *
   * Wide screens: if every column can fit at its normal width, they all
   * share the space equally and no scrolling is needed.
   */
  const availWidth = screenWidth - ROW_PADDING - NAME_COL_WIDTH;
  const fitAllWidth = Math.floor(availWidth / STAT_COLUMNS.length);
  const isWide = fitAllWidth >= EXTRA_COL_WIDTH;

  const coreColWidth = isWide
    ? fitAllWidth
    : Math.min(
        MAX_CORE_COL_WIDTH,
        Math.max(MIN_CORE_COL_WIDTH, Math.floor(availWidth / CORE_COUNT)),
      );
  const extraColWidth = isWide ? fitAllWidth : EXTRA_COL_WIDTH;

  const tableWidth =
    ROW_PADDING +
    NAME_COL_WIDTH +
    CORE_COUNT * coreColWidth +
    EXTRA_COUNT * extraColWidth;

  const colWidth = (core: boolean) => (core ? coreColWidth : extraColWidth);

  const getLogo = (c: any) => c?.team?.logo ?? c?.team?.logos?.[0]?.href;

  return (
    <View style={styles.container}>
      {/* Score Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.teamBlock}>
          {getLogo(away) ? (
            <Image
              source={{ uri: getLogo(away) }}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.headerLogo} />
          )}
          <Text style={styles.abbrev}>{away?.team?.abbreviation}</Text>

          <Text style={styles.bigScore}>{away?.score ?? "-"}</Text>
        </View>

        <Text style={styles.statusText}>
          {competition?.status?.type?.shortDetail ?? ""}
        </Text>

        <View style={styles.teamBlock}>
          {getLogo(home) ? (
            <Image
              source={{ uri: getLogo(home) }}
              style={styles.headerLogo}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.headerLogo} />
          )}
          <Text style={styles.abbrev}>{home?.team?.abbreviation}</Text>

          <Text style={styles.bigScore}>{home?.score ?? "-"}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(["feed", "quarters", "boxscore"] as const).map((tab) => (
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
              {tab === "feed"
                ? "Feed"
                : tab === "quarters"
                  ? "By Quarter"
                  : "Box Score"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }}>
        {/* Feed Tab */}
        {activeTab === "feed" && (
          <View>
            {!gameData.plays || gameData.plays.length === 0 ? (
              <Text style={[styles.gray, { padding: 20 }]}>
                No play data yet.
              </Text>
            ) : (
              [...(gameData.plays ?? [])]
                .reverse()
                .map((play: any, i: number) => (
                  <View key={i} style={styles.playRow}>
                    <Text style={styles.green}>
                      Q{play.period?.number} {play.clock?.displayValue}
                    </Text>

                    <Text style={styles.white}>{play.text}</Text>
                  </View>
                ))
            )}
          </View>
        )}

        {/* Quarters Tab */}
        {activeTab === "quarters" && (
          <View style={{ padding: 16 }}>
            {(() => {
              const comps = competition?.competitors ?? [];

              const awayComp = comps.find((c: any) => c.homeAway === "away");

              const homeComp = comps.find((c: any) => c.homeAway === "home");

              const awayLS = awayComp?.linescores ?? [];
              const homeLS = homeComp?.linescores ?? [];

              const periods = Math.max(awayLS.length, homeLS.length);

              if (periods === 0) {
                return <Text style={styles.gray}>No quarter data yet.</Text>;
              }

              return (
                <View>
                  {/* Header */}
                  <View style={styles.qRow}>
                    <Text style={[styles.qTeam, styles.gray]}>Team</Text>

                    {Array.from({ length: periods }).map((_, i) => (
                      <Text key={i} style={[styles.qCell, styles.gray]}>
                        Q{i + 1}
                      </Text>
                    ))}

                    <Text style={[styles.qCell, styles.gray]}>T</Text>
                  </View>

                  {/* Away */}
                  <View style={styles.qRow}>
                    <Text style={[styles.qTeam, styles.white]}>
                      {awayComp?.team?.abbreviation}
                    </Text>

                    {awayLS.map((ls: any, i: number) => (
                      <Text key={i} style={[styles.qCell, styles.white]}>
                        {ls.value}
                      </Text>
                    ))}

                    <Text
                      style={[
                        styles.qCell,
                        styles.white,
                        { fontWeight: "bold" },
                      ]}
                    >
                      {awayComp?.score}
                    </Text>
                  </View>

                  {/* Home */}
                  <View style={styles.qRow}>
                    <Text style={[styles.qTeam, styles.white]}>
                      {homeComp?.team?.abbreviation}
                    </Text>

                    {homeLS.map((ls: any, i: number) => (
                      <Text key={i} style={[styles.qCell, styles.white]}>
                        {ls.value}
                      </Text>
                    ))}

                    <Text
                      style={[
                        styles.qCell,
                        styles.white,
                        { fontWeight: "bold" },
                      ]}
                    >
                      {homeComp?.score}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>
        )}

        {/* Box Score Tab */}
        {activeTab === "boxscore" && (
          <View>
            {teams.length === 0 ? (
              <Text style={[styles.gray, { padding: 20 }]}>
                No box score yet.
              </Text>
            ) : (
              <View>
                {/* Team Slider */}
                <View style={styles.teamSlider}>
                  {teams.map((t: any, i: number) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setSelectedTeam(i)}
                      style={[
                        styles.teamSliderBtn,
                        selectedTeam === i && styles.teamSliderActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.teamSliderText,
                          selectedTeam === i && styles.teamSliderActiveText,
                        ]}
                      >
                        {t.team?.abbreviation}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Box Score */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ width: tableWidth }}>
                    {/* Stat Header */}
                    <View style={[styles.statHeaderRow, { width: tableWidth }]}>
                      <Text style={[styles.nameCol, styles.gray]}>Player</Text>

                      {STAT_COLUMNS.map((col) => (
                        <Text
                          key={col.key}
                          style={[
                            styles.statCol,
                            styles.gray,
                            { width: colWidth(col.core) },
                          ]}
                        >
                          {col.label}
                        </Text>
                      ))}
                    </View>

                    {/* Player Rows */}
                    {(() => {
                      const selectedTeamData = teams[selectedTeam];

                      const statGroup = selectedTeamData?.statistics?.find(
                        (group: any) => Array.isArray(group.athletes),
                      );

                      const players = statGroup?.athletes ?? [];

                      /*
                       * ESPN provides the names/labels for each
                       * value in the stats array.
                       *
                       * Example:
                       * names = ["MIN", "FG", "3PT", "FT",
                       *          "REB", "AST", ...]
                       *
                       * This lets us correctly match each value
                       * instead of relying on fixed indexes.
                       */
                      const statNames =
                        statGroup?.names ?? statGroup?.labels ?? [];

                      return players.map((pd: any) => {
                        const p = pd.athlete;
                        const s = pd.stats ?? [];

                        // Build a map such as:
                        // { MIN: "28", FG: "5-13", PTS: "12", ... }
                        const statMap: Record<string, string> = {};

                        statNames.forEach((name: string, index: number) => {
                          statMap[name] = s[index] ?? "-";
                        });

                        /*
                         * Get each statistic.
                         *
                         * ESPN can use slightly different names
                         * such as 3PT or 3P, so we check both.
                         */
                        const min = statMap["MIN"] ?? statMap["MINUTES"] ?? "-";

                        const pts = statMap["PTS"] ?? statMap["POINTS"] ?? "-";

                        const reb =
                          statMap["REB"] ?? statMap["REBOUNDS"] ?? "-";

                        const ast = statMap["AST"] ?? statMap["ASSISTS"] ?? "-";

                        const stl = statMap["STL"] ?? statMap["STEALS"] ?? "-";

                        const blk = statMap["BLK"] ?? statMap["BLOCKS"] ?? "-";

                        const pm = statMap["+/-"] ?? statMap["PM"] ?? "-";

                        const fg = statMap["FG"] ?? statMap["FGM-FGA"] ?? "-";

                        const threefg =
                          statMap["3PT"] ??
                          statMap["3P"] ??
                          statMap["3FG"] ??
                          "-";

                        const ft = statMap["FT"] ?? statMap["FTM-FTA"] ?? "-";

                        const to = statMap["TO"] ?? statMap["TURNOVERS"] ?? "-";

                        const pf = statMap["PF"] ?? statMap["FOULS"] ?? "-";

                        /*
                         * Calculate TS%.
                         *
                         * FG is normally formatted as:
                         * FGM-FGA
                         *
                         * FT is normally formatted as:
                         * FTM-FTA
                         */
                        let ts = "-";

                        const fgParts =
                          typeof fg === "string" ? fg.split("-") : [];

                        const ftParts =
                          typeof ft === "string" ? ft.split("-") : [];

                        if (fgParts.length === 2 && ftParts.length === 2) {
                          const fga = parseInt(fgParts[1], 10) || 0;

                          const fta = parseInt(ftParts[1], 10) || 0;

                          const points = parseInt(String(pts), 10) || 0;

                          const tsa = fga + 0.44 * fta;

                          if (tsa > 0) {
                            ts = `${Math.round((points / (2 * tsa)) * 100)}%`;
                          }
                        }

                        // Every value, keyed to match STAT_COLUMNS
                        const values: Record<string, string> = {
                          min,
                          pts,
                          reb,
                          ast,
                          stl,
                          blk,
                          pm,
                          fg,
                          threefg,
                          ft,
                          to,
                          pf,
                          ts,
                        };
                        values.fpts = calcFantasyPoints(values);

                        /*
                         * Use ESPN's headshot URL if it
                         * provides one.
                         */
                        let headshotUrl = "";

                        if (typeof p?.headshot === "string") {
                          headshotUrl = p.headshot;
                        } else if (p?.headshot?.href) {
                          headshotUrl = p.headshot.href;
                        } else {
                          headshotUrl = `https://a.espncdn.com/i/headshots/${cfg.league}/players/full/${p.id}.png`;
                        }

                        return (
                          <View
                            key={p.id}
                            style={[styles.playerRow, { width: tableWidth }]}
                          >
                            {/* Player */}
                            <TouchableOpacity
                              style={styles.playerInfo}
                              onPress={() =>
                                router.push({
                                  pathname: "/profile/[id]",
                                  params: {
                                    id: p.id,
                                    name: p.displayName,
                                    headshot: headshotUrl,
                                  },
                                } as any)
                              }
                            >
                              <Image
                                source={{
                                  uri: headshotUrl,
                                }}
                                style={styles.headshot}
                              />

                              <Text
                                style={[styles.playerName, styles.white]}
                                numberOfLines={1}
                              >
                                {p.shortName ?? p.displayName}
                              </Text>
                            </TouchableOpacity>

                            {/* Player Stats */}
                            <TouchableOpacity
                              style={styles.statsTouchable}
                              onPress={() =>
                                router.push({
                                  pathname: "/player/[id]",
                                  params: {
                                    id: p.id,
                                    name: p.displayName,
                                    headshot: headshotUrl,
                                    ...values,
                                  },
                                } as any)
                              }
                            >
                              <View style={styles.statsRow}>
                                {STAT_COLUMNS.map((col) => {
                                  const val = values[col.key];
                                  const isPm = col.key === "pm";

                                  return (
                                    <Text
                                      key={col.key}
                                      style={[
                                        styles.statCol,
                                        styles.white,
                                        { width: colWidth(col.core) },
                                        isPm && plusMinusStyle(val),
                                      ]}
                                    >
                                      {isPm ? formatPlusMinus(val) : val}
                                    </Text>
                                  );
                                })}
                              </View>
                            </TouchableOpacity>
                          </View>
                        );
                      });
                    })()}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        )}
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

  /* Score Header */

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

  /* Team Selector */

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

  /* Box Score */

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
