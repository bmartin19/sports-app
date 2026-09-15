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

export default function GameScreen() {
  const { id } = useLocalSearchParams();
  const { width: screenWidth } = useWindowDimensions();

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
          `http://site.api.espn.com/apis/site/v2/sports/basketball/wnba/summary?event=${id}`,
        );

        const data = await res.json();
        setGameData(data);
      } catch (e) {
        console.log("error:", e);
      }

      setLoading(false);
    }

    fetchGame();
  }, [id]);

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

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.green}>← Back</Text>
      </TouchableOpacity>

      {/* Score Header */}
      <View style={styles.header}>
        <View style={styles.teamBlock}>
          <Text style={styles.abbrev}>{away?.team?.abbreviation}</Text>

          <Text style={styles.bigScore}>{away?.score ?? "-"}</Text>
        </View>

        <Text style={styles.statusText}>
          {competition?.status?.type?.shortDetail ?? ""}
        </Text>

        <View style={styles.teamBlock}>
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
                  <View style={{ width: screenWidth }}>
                    {/* Stat Header */}
                    <View
                      style={[styles.statHeaderRow, { width: screenWidth }]}
                    >
                      <Text style={[styles.nameCol, styles.gray]}>Player</Text>

                      {[
                        "MIN",
                        "PTS",
                        "REB",
                        "AST",
                        "STL",
                        "BLK",
                        "FG",
                        "3FG",
                        "FT",
                        "TO",
                        "PF",
                        "TS%",
                      ].map((h) => (
                        <Text key={h} style={[styles.statCol, styles.gray]}>
                          {h}
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
                          headshotUrl = `https://a.espncdn.com/i/headshots/wnba/players/full/${p.id}.png`;
                        }

                        return (
                          <View
                            key={p.id}
                            style={[styles.playerRow, { width: screenWidth }]}
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
                                style={[styles.nameCol, styles.white]}
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
                                  },
                                } as any)
                              }
                            >
                              <View style={styles.statsRow}>
                                {[
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
                                ].map((val, i) => (
                                  <Text
                                    key={i}
                                    style={[styles.statCol, styles.white]}
                                  >
                                    {val}
                                  </Text>
                                ))}
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

  back: {
    padding: 16,
    paddingBottom: 4,
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
    paddingHorizontal: 12,
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
    paddingHorizontal: 12,
  },

  playerInfo: {
    width: 120,
    flexDirection: "row",
    alignItems: "center",
  },

  headshot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
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
    width: 120,
    fontSize: 12,
  },

  statCol: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
  },
});
