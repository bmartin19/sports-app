import { router } from "expo-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar,
  colors,
  MarketAsset,
  money,
  pct,
  toAsset,
} from "../../lib/market";
import { supabase } from "../../services/supabase";

type Mover = MarketAsset & { change_pct: number };

function AssetRow({
  a,
  rank,
  change,
}: {
  a: MarketAsset;
  rank?: number;
  change?: number;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.row}
      onPress={() => router.push(`/asset/${a.asset_id}` as any)}
    >
      {rank != null && <Text style={styles.rank}>{rank}</Text>}
      <Avatar uri={a.image_url} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.name} numberOfLines={1}>
          {a.name}
        </Text>
        {a.subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {a.subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.price}>{money(a.current_price)}</Text>
        {change != null && (
          <Text style={[styles.change, change >= 0 ? styles.up : styles.down]}>
            {pct(change)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function MarketScreen() {
  const insets = useSafeAreaInsets();
  const [players, setPlayers] = useState<MarketAsset[]>([]);
  const [teams, setTeams] = useState<MarketAsset[]>([]);
  const [risers, setRisers] = useState<Mover[]>([]);
  const [fallers, setFallers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketAsset[] | null>(null);

  const load = useCallback(async () => {
    const [p, t, m] = await Promise.all([
      supabase
        .from("market_assets")
        .select("*")
        .eq("asset_type", "player")
        .order("current_price", { ascending: false })
        .limit(10),
      supabase
        .from("market_assets")
        .select("*")
        .eq("asset_type", "team")
        .order("current_price", { ascending: false })
        .limit(5),
      supabase.rpc("market_movers", { p_days: 7 }),
    ]);

    if (p.error || t.error) {
      setError(
        "Couldn't load the market. Check your connection and try again.",
      );
    } else {
      setError("");
      setPlayers((p.data ?? []).map(toAsset));
      setTeams((t.data ?? []).map(toAsset));
    }

    const movers: Mover[] = ((m.data ?? []) as any[]).map((r) => ({
      ...toAsset(r),
      change_pct: Number(r.change_pct),
    }));
    setRisers(
      movers
        .filter((x) => x.change_pct > 0)
        .sort((a, b) => b.change_pct - a.change_pct)
        .slice(0, 5),
    );
    setFallers(
      movers
        .filter((x) => x.change_pct < 0)
        .sort((a, b) => a.change_pct - b.change_pct)
        .slice(0, 5),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Search players and teams by name
  useEffect(() => {
    const q = query.trim().replace(/[%,()]/g, "");
    if (q.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("market_assets")
        .select("*")
        .ilike("name", `%${q}%`)
        .order("current_price", { ascending: false })
        .limit(15);
      if (!cancelled) setResults((data ?? []).map(toAsset));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search players or teams"
          placeholderTextColor={colors.dim}
          style={styles.search}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.green}
            />
          }
        >
          <View style={styles.column}>
            {error ? <Text style={styles.empty}>{error}</Text> : null}

            {results !== null ? (
              <Section title="Search results">
                {results.length === 0 ? (
                  <Text style={styles.empty}>
                    No players or teams match "{query.trim()}".
                  </Text>
                ) : (
                  results.map((a) => <AssetRow key={a.asset_id} a={a} />)
                )}
              </Section>
            ) : (
              <>
                <Section title="Top 10 players">
                  {players.map((a, i) => (
                    <AssetRow key={a.asset_id} a={a} rank={i + 1} />
                  ))}
                </Section>

                <Section title="Top 5 teams">
                  {teams.map((a, i) => (
                    <AssetRow key={a.asset_id} a={a} rank={i + 1} />
                  ))}
                </Section>

                <Section title="Biggest risers this week">
                  {risers.length === 0 ? (
                    <Text style={styles.empty}>
                      No price changes yet. Prices move when people buy and
                      sell.
                    </Text>
                  ) : (
                    risers.map((a) => (
                      <AssetRow key={a.asset_id} a={a} change={a.change_pct} />
                    ))
                  )}
                </Section>

                <Section title="Biggest fallers this week">
                  {fallers.length === 0 ? (
                    <Text style={styles.empty}>No price drops yet.</Text>
                  ) : (
                    fallers.map((a) => (
                      <AssetRow key={a.asset_id} a={a} change={a.change_pct} />
                    ))
                  )}
                </Section>
              </>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 },
  search: {
    width: "100%",
    maxWidth: 520,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    backgroundColor: colors.card,
    color: "white",
    fontSize: 15,
  },
  column: { width: "100%", maxWidth: 720, paddingHorizontal: 12 },
  section: { marginTop: 20 },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginVertical: 3,
  },
  rank: { color: colors.dim, width: 22, fontSize: 13, fontWeight: "600" },
  name: { color: "white", fontSize: 15, fontWeight: "600" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  price: { color: "white", fontSize: 15, fontWeight: "700" },
  change: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  up: { color: colors.green },
  down: { color: colors.red },
  empty: {
    color: colors.muted,
    fontSize: 14,
    marginLeft: 4,
    marginVertical: 8,
  },
});
