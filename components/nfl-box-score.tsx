import { router } from "expo-router";
import { useState } from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

/*
 * NFL box score, laid out like CBS Sports:
 *   - "Players" view: one table per stat group (passing, rushing, ...)
 *   - "Team" view: both teams' totals side by side
 */

// The player tables to show, in order. groupName is the name ESPN uses for
// that group of stats. To add another table (like Kicking), add a line here.
const SECTIONS = [
  { title: "Passing", groupName: "passing" },
  { title: "Rushing", groupName: "rushing" },
  { title: "Receiving", groupName: "receiving" },
  { title: "Defense", groupName: "defensive" },
  { title: "Punting", groupName: "punting" },
  { title: "Kickoff Returns", groupName: "kickReturns" },
  { title: "Punt Returns", groupName: "puntReturns" },
];

// Sizes for the player tables
const NAME_WIDTH = 100;
const SIDE_PADDING = 12;
const MIN_COL_WIDTH = 32;
const MAX_COL_WIDTH = 56;

type BoxView = "players" | "team";

/* ------------------------------------------------------------------ */
/* One player table (like "Passing")                                   */
/* ------------------------------------------------------------------ */

function StatTable({
  title,
  group,
  leagueName,
}: {
  title: string;
  group: any;
  leagueName: string;
}) {
  const { width: screenWidth } = useWindowDimensions();

  // ESPN tells us the column names for this group (like "C/ATT", "YDS", "TD")
  const labels: string[] = group.labels ?? group.names ?? [];

  // Share the space left after the name column between the stat columns
  const spaceForStats = screenWidth - SIDE_PADDING * 2 - NAME_WIDTH;
  const sharedWidth = Math.floor(spaceForStats / Math.max(labels.length, 1));
  const colWidth = Math.min(
    MAX_COL_WIDTH,
    Math.max(MIN_COL_WIDTH, sharedWidth),
  );

  return (
    <View style={styles.table}>
      {/* Title */}
      <Text style={styles.tableTitle}>{title}</Text>

      {/* Column names */}
      <View style={styles.tableRow}>
        <Text style={[styles.nameCell, styles.gray]}>Player</Text>
        {labels.map((label, index) => (
          <Text
            key={index}
            style={[styles.statCell, styles.gray, { width: colWidth }]}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* One row per player */}
      {(group.athletes ?? []).map((playerData: any) => {
        const athlete = playerData.athlete;
        const values: string[] = playerData.stats ?? [];
        const headshotUrl = `https://a.espncdn.com/i/headshots/${leagueName}/players/full/${athlete.id}.png`;

        return (
          <View key={athlete.id} style={styles.tableRow}>
            {/* Tapping the name opens the player's profile */}
            <TouchableOpacity
              style={styles.nameCell}
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
              <Text style={[styles.white, styles.nameText]} numberOfLines={1}>
                {athlete.shortName ?? athlete.displayName}
              </Text>
            </TouchableOpacity>

            {labels.map((label, index) => (
              <Text
                key={index}
                style={[styles.statCell, styles.white, { width: colWidth }]}
              >
                {values[index] ?? "-"}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Team comparison                                                     */
/* ------------------------------------------------------------------ */

// Both teams' stats side by side: away value | stat name | home value
function TeamComparison({ statTeams }: { statTeams: any[] }) {
  // Pick out the away and home teams (falls back to the order ESPN gives)
  const awayTeam = statTeams.find((t) => t.homeAway === "away") ?? statTeams[0];
  const homeTeam = statTeams.find((t) => t.homeAway === "home") ?? statTeams[1];

  if (!awayTeam || !homeTeam) {
    return (
      <Text style={[styles.gray, { padding: 20 }]}>No team stats yet.</Text>
    );
  }

  const awayStats: any[] = awayTeam.statistics ?? [];
  const homeStats: any[] = homeTeam.statistics ?? [];

  return (
    <View style={styles.table}>
      {/* Team names */}
      <View style={styles.compareRow}>
        <Text style={[styles.compareValue, styles.white, styles.bold]}>
          {awayTeam.team?.abbreviation}
        </Text>
        <Text style={styles.compareLabel} />
        <Text style={[styles.compareValue, styles.white, styles.bold]}>
          {homeTeam.team?.abbreviation}
        </Text>
      </View>

      {awayStats.map((awayStat) => {
        // Find the same stat for the home team
        const homeStat = homeStats.find((s) => s.name === awayStat.name);

        // Skip stats that don't have a name we can show
        if (!awayStat.label) return null;

        return (
          <View key={awayStat.name} style={styles.compareRow}>
            <Text style={[styles.compareValue, styles.white]}>
              {awayStat.displayValue ?? "-"}
            </Text>
            <Text style={styles.compareLabel}>{awayStat.label}</Text>
            <Text style={[styles.compareValue, styles.white]}>
              {homeStat?.displayValue ?? "-"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Main box score                                                      */
/* ------------------------------------------------------------------ */

export default function NflBoxScore({
  playerTeams,
  statTeams,
  leagueName,
  selectedTeam,
  onSelectTeam,
}: {
  playerTeams: any[]; // gameData.boxscore.players (player stats for each team)
  statTeams: any[]; // gameData.boxscore.teams (team totals for each team)
  leagueName: string;
  selectedTeam: number;
  onSelectTeam: (index: number) => void;
}) {
  const [view, setView] = useState<BoxView>("players");

  if (playerTeams.length === 0 && statTeams.length === 0) {
    return (
      <Text style={[styles.gray, { padding: 20 }]}>No box score yet.</Text>
    );
  }

  // The stat groups for the selected team (passing, rushing, ...)
  const groups: any[] = playerTeams[selectedTeam]?.statistics ?? [];

  return (
    <View>
      {/* Switch between Players and Team */}
      <View style={styles.switchRow}>
        {(["players", "team"] as const).map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => setView(option)}
            style={[styles.switchBtn, view === option && styles.switchActive]}
          >
            <Text
              style={[
                styles.switchText,
                view === option && styles.switchActiveText,
              ]}
            >
              {option === "players" ? "Players" : "Team"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === "team" ? (
        <TeamComparison statTeams={statTeams} />
      ) : (
        <View>
          {/* Buttons to switch between the two teams */}
          <View style={styles.switchRow}>
            {playerTeams.map((team, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => onSelectTeam(index)}
                style={[
                  styles.switchBtn,
                  selectedTeam === index && styles.switchActive,
                ]}
              >
                <Text
                  style={[
                    styles.switchText,
                    selectedTeam === index && styles.switchActiveText,
                  ]}
                >
                  {team.team?.abbreviation}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* One table for each section that has players in it */}
          {SECTIONS.map((section) => {
            const group = groups.find((g) => g.name === section.groupName);
            if (!group || !group.athletes || group.athletes.length === 0) {
              return null;
            }
            return (
              <StatTable
                key={section.groupName}
                title={section.title}
                group={group}
                leagueName={leagueName}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  white: { color: "white" },
  gray: { color: "#666" },
  bold: { fontWeight: "700" },

  // Players / Team switch and team buttons
  switchRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  switchBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#222",
  },
  switchActive: { backgroundColor: "#16fd16" },
  switchText: { color: "#888", fontWeight: "600" },
  switchActiveText: { color: "#000" },

  // Player tables
  table: { marginTop: 16, paddingHorizontal: SIDE_PADDING },
  tableTitle: {
    color: "#16fd16",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  nameCell: { width: NAME_WIDTH, fontSize: 12 },
  nameText: { fontSize: 12 },
  statCell: { textAlign: "center", fontSize: 11 },

  // Team comparison
  compareRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  compareValue: { width: 80, textAlign: "center", fontSize: 14 },
  compareLabel: {
    flex: 1,
    color: "#888",
    textAlign: "center",
    fontSize: 12,
  },
});
