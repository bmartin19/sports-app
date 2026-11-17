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

// asset + price change in percentage
type Mover = MarketAsset & { change_pct: number };

//count for the items listed for each section in the market
const TOP_PLAYERS_COUNT = 10;
const TOP_TEAMS_COUNT = 5;
const MOVERS_COUNT = 5;
const SEARCH_RESULT_LIMIT = 15;

//look back a week for the risers and fallers list
const MOVERS_DAYS = 7;

const SEARCH_DELAY_MS = 250;

function AssetRow({
  asset,
  rank,
  change,
}: {
  asset: MarketAsset;
  rank?: number;
  change?: number;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.row}
      onPress={() => router.push(`/asset/${asset.asset_id}` as any)}
    >
      {rank != null && <Text style={styles.rank}>{rank}</Text>}
      <Avatar uri={asset.image_url} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.name} numberOfLines={1}>
          {asset.name}
        </Text>
        {asset.subtitle ? (
          <Text style={styles.sub} numberOfLines={1}>
            {asset.subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.price}>{money(asset.current_price)}</Text>
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

  // data for the lists
  const [players, setPlayers] = useState<MarketAsset[]>([]);
  const [teams, setTeams] = useState<MarketAsset[]>([]);
  const [risers, setRisers] = useState<Mover[]>([]);
  const [fallers, setFallers] = useState<Mover[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // search box, null when the user hasn't searched
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<MarketAsset[] | null>(
    null,
  );

  // loads everything from Supabase
  const load = useCallback(async () => {
    // send all requests at once so it loads faster
    const [playersResult, teamsResult, moversResult] = await Promise.all([
      supabase
        .from("market_assets")
        .select("*")
        .eq("asset_type", "player")
        .order("current_price", { ascending: false })
        .limit(TOP_PLAYERS_COUNT),
      supabase
        .from("market_assets")
        .select("*")
        .eq("asset_type", "team")
        .order("current_price", { ascending: false })
        .limit(TOP_TEAMS_COUNT),
      supabase.rpc("market_movers", { p_days: MOVERS_DAYS }),
    ]);

    if (playersResult.error || teamsResult.error) {
      setErrorMessage(
        "Couldn't load the market. Check your connection and try again.",
      );
    } else {
      setErrorMessage("");
      setPlayers((playersResult.data ?? []).map(toAsset));
      setTeams((teamsResult.data ?? []).map(toAsset));
    }

    // turn the raw rows into assets that also have a change_pct number
    const moverRows = (moversResult.data ?? []) as any[];
    const allMovers: Mover[] = moverRows.map((row) => ({
      ...toAsset(row),
      change_pct: Number(row.change_pct),
    }));

    // risers
    const rising = allMovers.filter((m) => m.change_pct > 0);
    rising.sort((a, b) => b.change_pct - a.change_pct);
    setRisers(rising.slice(0, MOVERS_COUNT));

    // fallers
    const falling = allMovers.filter((m) => m.change_pct < 0);
    falling.sort((a, b) => a.change_pct - b.change_pct);
    setFallers(falling.slice(0, MOVERS_COUNT));

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // search for players
  useEffect(() => {
    // remove characters that could mess up the search
    const cleanText = searchText.trim().replace(/[%,()]/g, "");

    if (cleanText.length < 2) {
      setSearchResults(null);
      return;
    }

    let isOutdated = false;

    const delayTimer = setTimeout(async () => {
      const { data } = await supabase
        .from("market_assets")
        .select("*")
        .ilike("name", `%${cleanText}%`)
        .order("current_price", { ascending: false })
        .limit(SEARCH_RESULT_LIMIT);

      if (!isOutdated) {
        setSearchResults((data ?? []).map(toAsset));
      }
    }, SEARCH_DELAY_MS);

    return () => {
      isOutdated = true;
      clearTimeout(delayTimer);
    };
  }, [searchText]);
  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
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
            {errorMessage ? (
              <Text style={styles.empty}>{errorMessage}</Text>
            ) : null}

            {searchResults !== null ? (
              // show results for the search
              <Section title="Search results">
                {searchResults.length === 0 ? (
                  <Text style={styles.empty}>
                    No players or teams match "{searchText.trim()}".
                  </Text>
                ) : (
                  searchResults.map((asset) => (
                    <AssetRow key={asset.asset_id} asset={asset} />
                  ))
                )}
              </Section>
            ) : (
              <>
                <Section title={`Top ${TOP_PLAYERS_COUNT} players`}>
                  {players.map((asset, index) => (
                    <AssetRow
                      key={asset.asset_id}
                      asset={asset}
                      rank={index + 1}
                    />
                  ))}
                </Section>

                <Section title={`Top ${TOP_TEAMS_COUNT} teams`}>
                  {teams.map((asset, index) => (
                    <AssetRow
                      key={asset.asset_id}
                      asset={asset}
                      rank={index + 1}
                    />
                  ))}
                </Section>

                <Section title="Biggest risers this week">
                  {risers.length === 0 ? (
                    <Text style={styles.empty}>
                      No price changes yet. Prices move when people buy and
                      sell.
                    </Text>
                  ) : (
                    risers.map((asset) => (
                      <AssetRow
                        key={asset.asset_id}
                        asset={asset}
                        change={asset.change_pct}
                      />
                    ))
                  )}
                </Section>

                <Section title="Biggest fallers this week">
                  {fallers.length === 0 ? (
                    <Text style={styles.empty}>No price drops yet.</Text>
                  ) : (
                    fallers.map((asset) => (
                      <AssetRow
                        key={asset.asset_id}
                        asset={asset}
                        change={asset.change_pct}
                      />
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
