import { router } from "expo-router";
import { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

// stat sections to display for NFL data. Inspired by CBS Sports
const SECTIONS = [
  { title: "Passing", groupName: "passing" },
  { title: "Rushing", groupName: "rushing" },
  { title: "Receiving", groupName: "receiving" },
  { title: "Defense", groupName: "defensive" },
  { title: "Punting", groupName: "punting" },
  { title: "Kickoff Returns", groupName: "kickReturns" },
  { title: "Punt Returns", groupName: "puntReturns" },
];

// sizes for player tables
const NAME_WIDTH = 112;
const SIDE_PADDING = 12;
const MIN_COL_WIDTH = 30;
const MAX_COL_WIDTH = 56;

function getHeadshotUrl(athlete: any, leagueName: string) {
  if (typeof athlete?.headshot === "string") {
    return athlete.headshot;
  }
  if (athlete?.headshot?.href) {
    return athlete.headshot.href;
  }
  return `https://a.espncdn.com/i/headshots/${leagueName}/players/full/${athlete.id}.png`;
}

type BoxView = "players" | "team";

//stat section function
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

  // ESPN tells us stat section (column) names
  const labels: string[] = group.labels ?? group.names ?? [];

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

      {/* one row per player */}
      {(group.athletes ?? []).map((playerData: any) => {
        const athlete = playerData.athlete;
        const values: string[] = playerData.stats ?? [];
        const headshotUrl = getHeadshotUrl(athlete, leagueName);

        return (
          <View key={athlete.id} style={styles.tableRow}>
            {/* pressing the name opens the player's profile */}
            <TouchableOpacity
              style={styles.nameButton}
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

// team stats tab to compare how the teams performed in the game
function TeamComparison({ statTeams }: { statTeams: any[] }) {
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

      {awayStats.map((awayStat, index) => {
        // Match by position first, since names like "interceptions" repeat
        let homeStat = homeStats[index];
        if (homeStat?.name !== awayStat.name) {
          homeStat = homeStats.find((s) => s.name === awayStat.name);
        }

        if (!awayStat.label) return null;

        return (
          <View key={`${awayStat.name}-${index}`} style={styles.compareRow}>
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

//Main box score
export default function NflBoxScore({
  playerTeams,
  statTeams,
  leagueName,
  selectedTeam,
  onSelectTeam,
}: {
  playerTeams: any[];
  statTeams: any[];
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

  // The stat sections for the selected team
  const groups: any[] = playerTeams[selectedTeam]?.statistics ?? [];

  return (
    <View>
      {/* tabs to switch between player and team stats */}
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
          {/* tabs to switch between teams */}
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
  nameButton: {
    width: NAME_WIDTH,
    flexDirection: "row",
    alignItems: "center",
  },
  nameText: { flex: 1, fontSize: 12 },
  headshot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
    backgroundColor: "#333",
  },
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
