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

// liquidity constant that must match in Supabase
const LIQUIDITY = 500;

// number of rows to load from database
const TRADE_LOAD_LIMIT = 500;
const DIVIDEND_LOAD_LIMIT = 200;

// how many rows to show before "Show All" in transactions
const HISTORY_PREVIEW_COUNT = 10;

// holding on player or team the user has
type Holding = {
  quantity: number;
  avgCost: number; // average price paid per share
  asset: MarketAsset;
  value: number; // what the shares would pay out if sold right now
  profit: number; // value minus what the user paid
  lastBought: string | null; // date of the most recent buy
};

type ActivityKind = "buy" | "sell" | "dividend";

// activity in transaction history
type Activity = {
  key: string;
  kind: ActivityKind;
  detail: string;
  total: number;
  date: string;
  asset: MarketAsset | null;
  assetId: string;
};

// text for the badge in transaction section
const BADGE_LABELS: Record<ActivityKind, string> = {
  buy: "BUY",
  sell: "SELL",
  dividend: "MATCH",
};

// what user actually receives when they sell
function sellValue(price: number, shares: number) {
  return price * LIQUIDITY * (1 - Math.exp(-shares / LIQUIDITY));
}

// + or - sign to the amount
function signedMoney(amount: number) {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}${money(Math.abs(amount))}`;
}

function formatShares(count: number) {
  return `${count} ${count === 1 ? "share" : "shares"}`;
}

function formatDate(isoString: string, withTime = false) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  if (date.getFullYear() !== new Date().getFullYear()) {
    dateOptions.year = "numeric";
  }
  const dateText = date.toLocaleDateString("en-US", dateOptions);

  if (!withTime) return dateText;

  const timeText = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateText}, ${timeText}`;
}

//finds date of the last buy
function findLastBuyDates(tradeRows: any[]) {
  const lastBuyDates: Record<string, string> = {};
  for (const trade of tradeRows) {
    const key = String(trade.asset_id);
    if (trade.side === "buy" && !(key in lastBuyDates)) {
      lastBuyDates[key] = trade.created_at;
    }
  }
  return lastBuyDates;
}

function buildHoldings(
  holdingRows: any[],
  assetsById: Record<string, MarketAsset>,
  lastBuyDates: Record<string, string>,
) {
  const holdings: Holding[] = [];

  for (const row of holdingRows) {
    const key = String(row.asset_id);
    const asset = assetsById[key];
    if (!asset) continue; // skip if we couldn't find the player/team

    const quantity = Number(row.quantity);
    const avgCost = Number(row.avg_cost);
    const value = sellValue(asset.current_price, quantity);

    holdings.push({
      quantity,
      avgCost,
      asset,
      value,
      profit: value - avgCost * quantity,
      lastBought: lastBuyDates[key] ?? null,
    });
  }

  // most valuable holdings first
  holdings.sort((a, b) => b.value - a.value);
  return holdings;
}

// combines holdings and match payouts into one list
function buildHistory(
  tradeRows: any[],
  dividendRows: any[],
  assetsById: Record<string, MarketAsset>,
) {
  const history: Activity[] = [];

  for (const trade of tradeRows) {
    history.push({
      key: `trade-${trade.id}`,
      kind: trade.side, // "buy" or "sell"
      detail: `${formatShares(Number(trade.quantity))} @ ${money(Number(trade.unit_price))}`,
      total: Number(trade.total),
      date: trade.created_at,
      asset: assetsById[String(trade.asset_id)] ?? null,
      assetId: String(trade.asset_id),
    });
  }

  for (const dividend of dividendRows) {
    // payouts for match earnings
    //teams are based from margin of victory
    //players from fantasy points
    let detail = `${formatShares(Number(dividend.shares))} · ${Number(dividend.fantasy_points)} fantasy pts`;
    if (dividend.margin != null) {
      detail = `${formatShares(Number(dividend.shares))} · won by ${Number(dividend.margin)}`;
    }

    history.push({
      key: `dividend-${dividend.id}`,
      kind: "dividend",
      detail,
      total: Number(dividend.amount),
      date: dividend.created_at,
      asset: assetsById[String(dividend.asset_id)] ?? null,
      assetId: String(dividend.asset_id),
    });
  }

  history.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return history;
}
// a player or team the user holds
function HoldingItem({ holding }: { holding: Holding }) {
  const amountPaid = holding.avgCost * holding.quantity;
  const profitPercent =
    amountPaid > 0 ? (holding.profit / amountPaid) * 100 : 0;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.row}
      onPress={() => router.push(`/asset/${holding.asset.asset_id}` as any)}
    >
      <Avatar uri={holding.asset.image_url} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.name} numberOfLines={1}>
          {holding.asset.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {formatShares(holding.quantity)} · avg {money(holding.avgCost)}
        </Text>
        {holding.lastBought ? (
          <Text style={styles.sub} numberOfLines={1}>
            Last bought {formatDate(holding.lastBought)}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.price}>{money(holding.value)}</Text>
        <Text
          style={[styles.change, holding.profit >= 0 ? styles.up : styles.down]}
        >
          {pct(profitPercent)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// item in the transaction history
function HistoryItem({ item }: { item: Activity }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.row}
      disabled={!item.asset}
      onPress={() => router.push(`/asset/${item.assetId}` as any)}
    >
      <View
        style={[
          styles.badge,
          item.kind === "buy" && styles.buyBadge,
          item.kind === "sell" && styles.sellBadge,
          item.kind === "dividend" && styles.dividendBadge,
        ]}
      >
        <Text
          style={[
            styles.badgeText,
            item.kind === "dividend" && styles.badgeTextLight,
          ]}
        >
          {BADGE_LABELS[item.kind]}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.name} numberOfLines={1}>
          {item.asset?.name ?? "Unknown asset"}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {item.detail}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {formatDate(item.date, true)}
        </Text>
      </View>
      <Text style={styles.price}>
        {item.kind === "buy" ? "-" : "+"}
        {money(item.total)}
      </Text>
    </TouchableOpacity>
  );
}

//Screen layout

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [cash, setCash] = useState(0); // shown as "Belief Points"
  const [dividends, setDividends] = useState(0); // total match earnings
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [history, setHistory] = useState<Activity[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // loads portfolio from Supabase
  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // if not logged in
    if (!session) {
      setSignedIn(false);
      setLoading(false);
      return;
    }
    setSignedIn(true);
    const userId = session.user.id;

    // send requests together so it loads faster
    const [profileResult, holdingsResult, tradesResult, dividendsResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("cash_balance, dividends_earned")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("holdings")
          .select("asset_id, quantity, avg_cost")
          .eq("user_id", userId),
        supabase
          .from("transactions")
          .select("id, asset_id, side, quantity, unit_price, total, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(TRADE_LOAD_LIMIT),
        supabase
          .from("dividend_payments")
          .select(
            "id, asset_id, shares, fantasy_points, margin, amount, created_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(DIVIDEND_LOAD_LIMIT),
      ]);

    setCash(Number(profileResult.data?.cash_balance ?? 0));
    setDividends(Number(profileResult.data?.dividends_earned ?? 0));

    const holdingRows = (holdingsResult.data ?? []) as any[];
    const tradeRows = (tradesResult.data ?? []) as any[];
    const dividendRows = (dividendsResult.data ?? []) as any[];

    // collect ids of players and teams we need
    const assetIds = [
      ...new Set([
        ...holdingRows.map((row) => row.asset_id),
        ...tradeRows.map((row) => row.asset_id),
        ...dividendRows.map((row) => row.asset_id),
      ]),
    ];

    // load assets and store by id to make it easier to find
    const assetsById: Record<string, MarketAsset> = {};
    if (assetIds.length > 0) {
      const { data } = await supabase
        .from("market_assets")
        .select("*")
        .in("asset_id", assetIds);

      for (const asset of (data ?? []).map(toAsset)) {
        assetsById[String(asset.asset_id)] = asset;
      }
    }

    const lastBuyDates = findLastBuyDates(tradeRows);
    setHoldings(buildHoldings(holdingRows, assetsById, lastBuyDates));
    setHistory(buildHistory(tradeRows, dividendRows, assetsById));
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Pull-to-refresh
  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const invested = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const netWorth = cash + invested;
  const holdingsProfit = holdings.reduce(
    (sum, holding) => sum + holding.profit,
    0,
  );
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
            {/* Summary card */}
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

            {/* Holdings */}
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
              holdings.map((holding) => (
                <HoldingItem key={holding.asset.asset_id} holding={holding} />
              ))
            )}

            {/* Transaction History */}
            <Text style={styles.sectionTitle}>History</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyLeft}>No activity yet.</Text>
            ) : (
              <>
                {visibleHistory.map((item) => (
                  <HistoryItem key={item.key} item={item} />
                ))}
                {history.length > HISTORY_PREVIEW_COUNT && (
                  <TouchableOpacity
                    onPress={() => setShowAllHistory(!showAllHistory)}
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

  // Summary card
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

  // Rows
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

  // Empty states and buttons
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

  // History badges
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
