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

// Must match c_liquidity in execute_trade() in Supabase.
const LIQUIDITY = 500;

// Name of the timestamp column on the transactions table.
// Change this if yours is called something else.
const TX_DATE_COLUMN = "created_at";

// How many rows to load, and how many to show before "Show all".
const TX_LOAD_LIMIT = 500;
const DIVIDEND_LOAD_LIMIT = 200;
const HISTORY_PREVIEW_COUNT = 10;

// What you would actually receive if you sold `q` shares at spot price `p`.
// (Selling in several smaller orders gives the same total, so this is the
// true cash-out value of a position.)
const exitValue = (p: number, q: number) =>
  p * LIQUIDITY * (1 - Math.exp(-q / LIQUIDITY));

const signedMoney = (n: number) => `${n >= 0 ? "+" : "-"}${money(Math.abs(n))}`;

// "Oct 28" (adds the year if it's not this year), optionally with the time
function formatDate(iso: string, withTime = false) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  if (!withTime) return date;
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

const sharesLabel = (n: number) => `${n} share${n === 1 ? "" : "s"}`;

type Holding = {
  quantity: number;
  avg_cost: number;
  asset: MarketAsset;
  value: number; // what the position would pay out if sold
  profit: number; // value minus what the user paid
  lastBought: string | null; // date of the most recent buy
};

// One line in the history list: a buy, a sell, or a dividend payout
type Activity = {
  key: string;
  kind: "buy" | "sell" | "dividend";
  detail: string; // e.g. "5 shares @ 12.40", "5 shares · 31.5 fantasy pts" or "5 shares · won by 12"
  total: number;
  date: string;
  asset: MarketAsset | null;
  asset_id: string;
};

const BADGE_TEXT = { buy: "BUY", sell: "SELL", dividend: "MATCH" } as const;

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [cash, setCash] = useState(0);
  const [dividends, setDividends] = useState(0);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [history, setHistory] = useState<Activity[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

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

    const [prof, rows, txRows, divRows] = await Promise.all([
      supabase
        .from("profiles")
        .select("cash_balance, dividends_earned")
        .eq("id", session.user.id)
        .maybeSingle(),
      supabase
        .from("holdings")
        .select("asset_id, quantity, avg_cost")
        .eq("user_id", session.user.id),
      supabase
        .from("transactions")
        .select(
          `id, asset_id, side, quantity, unit_price, total, ${TX_DATE_COLUMN}`,
        )
        .eq("user_id", session.user.id)
        .order(TX_DATE_COLUMN, { ascending: false })
        .limit(TX_LOAD_LIMIT),
      supabase
        .from("dividend_payments")
        .select(
          "id, asset_id, shares, fantasy_points, margin, amount, created_at",
        )
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(DIVIDEND_LOAD_LIMIT),
    ]);
    setCash(Number(prof.data?.cash_balance ?? 0));
    setDividends(Number(prof.data?.dividends_earned ?? 0));

    const held = rows.data ?? [];
    const txData = (txRows.data ?? []) as any[];
    const divData = (divRows.data ?? []) as any[];

    // Load every asset we need to show a name for (held, traded, or paid a dividend)
    const assetIds = [
      ...new Set([
        ...held.map((h) => h.asset_id),
        ...txData.map((t) => t.asset_id),
        ...divData.map((d) => d.asset_id),
      ]),
    ];
    let assets: MarketAsset[] = [];
    if (assetIds.length) {
      const { data } = await supabase
        .from("market_assets")
        .select("*")
        .in("asset_id", assetIds);
      assets = (data ?? []).map(toAsset);
    }
    const assetById = new Map(assets.map((a) => [String(a.asset_id), a]));

    // Transactions are newest first, so the first buy we see per asset
    // is the most recent one.
    const lastBuy = new Map<string, string>();
    for (const t of txData) {
      const key = String(t.asset_id);
      if (t.side === "buy" && !lastBuy.has(key)) {
        lastBuy.set(key, t[TX_DATE_COLUMN]);
      }
    }

    const list: Holding[] = [];
    for (const h of held) {
      const asset = assetById.get(String(h.asset_id));
      if (!asset) continue;
      const quantity = Number(h.quantity);
      const avg_cost = Number(h.avg_cost);
      const value = exitValue(asset.current_price, quantity);
      list.push({
        quantity,
        avg_cost,
        asset,
        value,
        profit: value - avg_cost * quantity,
        lastBought: lastBuy.get(String(h.asset_id)) ?? null,
      });
    }
    list.sort((a, b) => b.value - a.value);
    setHoldings(list);

    // Merge trades and dividends into one list, newest first
    const activity: Activity[] = [
      ...txData.map((t) => ({
        key: `tx-${t.id}`,
        kind: t.side as "buy" | "sell",
        detail: `${sharesLabel(Number(t.quantity))} @ ${money(Number(t.unit_price))}`,
        total: Number(t.total),
        date: t[TX_DATE_COLUMN] as string,
        asset: assetById.get(String(t.asset_id)) ?? null,
        asset_id: String(t.asset_id),
      })),
      ...divData.map((d) => ({
        key: `div-${d.id}`,
        kind: "dividend" as const,
        // Team payouts have a margin of victory, player payouts have fantasy points
        detail:
          d.margin != null
            ? `${sharesLabel(Number(d.shares))} · won by ${Number(d.margin)}`
            : `${sharesLabel(Number(d.shares))} · ${Number(d.fantasy_points)} fantasy pts`,
        total: Number(d.amount),
        date: d.created_at as string,
        asset: assetById.get(String(d.asset_id)) ?? null,
        asset_id: String(d.asset_id),
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setHistory(activity);
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

  // Dividends are already inside `cash`, so net worth doesn't add them again
  const invested = holdings.reduce((sum, h) => sum + h.value, 0);
  const netWorth = cash + invested;
  // Gain on shares still held, plus every dividend paid so far
  const holdingsProfit = holdings.reduce((sum, h) => sum + h.profit, 0);
  const totalProfit = holdingsProfit + dividends;

  const visibleHistory = showAllHistory
    ? history
    : history.slice(0, HISTORY_PREVIEW_COUNT);

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
                  <Text style={styles.label}>Belief Points</Text>
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
                    {signedMoney(totalProfit)}
                  </Text>
                </View>
              </View>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.label}>Match earnings</Text>
                  <Text style={[styles.summaryValue, styles.up]}>
                    {signedMoney(dividends)}
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
                        {sharesLabel(h.quantity)} · avg {money(h.avg_cost)}
                      </Text>
                      {h.lastBought ? (
                        <Text style={styles.sub} numberOfLines={1}>
                          Last bought {formatDate(h.lastBought)}
                        </Text>
                      ) : null}
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

            <Text style={styles.sectionTitle}>History</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyLeft}>No activity yet.</Text>
            ) : (
              <>
                {visibleHistory.map((a) => (
                  <TouchableOpacity
                    key={a.key}
                    activeOpacity={0.7}
                    style={styles.row}
                    disabled={!a.asset}
                    onPress={() => router.push(`/asset/${a.asset_id}` as any)}
                  >
                    <View
                      style={[
                        styles.badge,
                        a.kind === "buy" && styles.buyBadge,
                        a.kind === "sell" && styles.sellBadge,
                        a.kind === "dividend" && styles.dividendBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          a.kind === "dividend" && styles.badgeTextLight,
                        ]}
                      >
                        {BADGE_TEXT[a.kind]}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {a.asset?.name ?? "Unknown asset"}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {a.detail}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {formatDate(a.date, true)}
                      </Text>
                    </View>
                    <Text style={styles.price}>
                      {a.kind === "buy" ? "-" : "+"}
                      {money(a.total)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {history.length > HISTORY_PREVIEW_COUNT && (
                  <TouchableOpacity
                    onPress={() => setShowAllHistory((v) => !v)}
                    activeOpacity={0.7}
                    style={styles.showMore}
                  >
                    <Text style={styles.showMoreText}>
                      {showAllHistory
                        ? "Show less"
                        : `Show all (${history.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
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
  emptyLeft: {
    color: colors.muted,
    fontSize: 14,
    marginLeft: 4,
    marginVertical: 8,
  },
  button: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#000", fontWeight: "800", fontSize: 15 },
  badge: {
    width: 58,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buyBadge: { backgroundColor: colors.green },
  sellBadge: { backgroundColor: colors.red },
  dividendBadge: { backgroundColor: "#7d68da" },
  badgeText: { color: "#000", fontSize: 11, fontWeight: "800" },
  badgeTextLight: { color: "#fff" },
  showMore: { alignItems: "center", paddingVertical: 12 },
  showMoreText: { color: colors.green, fontSize: 14, fontWeight: "600" },
});
