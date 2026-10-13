import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Avatar,
  colors,
  LOGIN_ROUTE,
  MarketAsset,
  money,
  pct,
  toAsset,
} from "../../lib/market";
import { supabase } from "../../services/supabase";

type Holding = {
  quantity: number;
  avg_cost: number;
  asset: MarketAsset;
  value: number; // quantity x current price
  profit: number; // vs. what the user paid
};

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [cash, setCash] = useState(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    setSignedIn(true);

    const [prof, rows] = await Promise.all([
      supabase
        .from("profiles")
        .select("cash_balance")
        .eq("id", session.user.id)
        .maybeSingle(),
      supabase
        .from("holdings")
        .select("asset_id, quantity, avg_cost")
        .eq("user_id", session.user.id),
    ]);
    setCash(Number(prof.data?.cash_balance ?? 0));

    const held = rows.data ?? [];
    let assets: MarketAsset[] = [];
    if (held.length) {
      const { data } = await supabase
        .from("market_assets")
        .select("*")
        .in(
          "asset_id",
          held.map((h) => h.asset_id),
        );
      assets = (data ?? []).map(toAsset);
    }

    const list: Holding[] = [];
    for (const h of held) {
      const asset = assets.find((a) => a.asset_id === h.asset_id);
      if (!asset) continue;
      const quantity = Number(h.quantity);
      const avg_cost = Number(h.avg_cost);
      list.push({
        quantity,
        avg_cost,
        asset,
        value: quantity * asset.current_price,
        profit: (asset.current_price - avg_cost) * quantity,
      });
    }
    list.sort((a, b) => b.value - a.value);
    setHoldings(list);
    setLoading(false);
  }, []);

  // Reload every time this tab is opened (e.g. after making a trade)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const invested = holdings.reduce((sum, h) => sum + h.value, 0);
  const netWorth = cash + invested;
  const totalProfit = holdings.reduce((sum, h) => sum + h.profit, 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Portfolio</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : !signedIn ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Log in to see your portfolio.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push(LOGIN_ROUTE as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Log in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.green}
            />
          }
        >
          <View style={styles.column}>
            <View style={styles.summary}>
              <Text style={styles.label}>Net worth</Text>
              <Text style={styles.netWorth}>{money(netWorth)}</Text>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.label}>Cash</Text>
                  <Text style={styles.summaryValue}>{money(cash)}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Invested</Text>
                  <Text style={styles.summaryValue}>{money(invested)}</Text>
                </View>
                <View>
                  <Text style={styles.label}>Profit / loss</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      totalProfit >= 0 ? styles.up : styles.down,
                    ]}
                  >
                    {totalProfit >= 0 ? "+" : "-"}
                    {money(Math.abs(totalProfit))}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Your holdings</Text>
            {holdings.length === 0 ? (
              <View style={{ alignItems: "center", marginTop: 12 }}>
                <Text style={styles.empty}>You don't own any shares yet.</Text>
                <TouchableOpacity
                  style={styles.button}
                  onPress={() => router.push("/market" as any)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonText}>Browse the market</Text>
                </TouchableOpacity>
              </View>
            ) : (
              holdings.map((h) => {
                const cost = h.avg_cost * h.quantity;
                const profitPct = cost > 0 ? (h.profit / cost) * 100 : 0;
                return (
                  <TouchableOpacity
                    key={h.asset.asset_id}
                    activeOpacity={0.7}
                    style={styles.row}
                    onPress={() =>
                      router.push(`/asset/${h.asset.asset_id}` as any)
                    }
                  >
                    <Avatar uri={h.asset.image_url} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {h.asset.name}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {h.quantity} share{h.quantity === 1 ? "" : "s"} · avg{" "}
                        {money(h.avg_cost)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.price}>{money(h.value)}</Text>
                      <Text
                        style={[
                          styles.change,
                          h.profit >= 0 ? styles.up : styles.down,
                        ]}
                      >
                        {pct(profitPct)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  title: { color: "white", fontSize: 24, fontWeight: "800" },
  column: { width: "100%", maxWidth: 720, paddingHorizontal: 12 },
  summary: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  label: { color: colors.muted, fontSize: 12 },
  netWorth: { color: "white", fontSize: 36, fontWeight: "800", marginTop: 2 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  summaryValue: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 24,
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
  name: { color: "white", fontSize: 15, fontWeight: "600" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  price: { color: "white", fontSize: 15, fontWeight: "700" },
  change: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  up: { color: colors.green },
  down: { color: colors.red },
  empty: { color: colors.muted, fontSize: 14, marginBottom: 12 },
  button: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#000", fontWeight: "800", fontSize: 15 },
});
