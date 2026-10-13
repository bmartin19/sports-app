import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  LOGIN_ROUTE,
  MarketAsset,
  money,
  pct,
  toAsset,
} from "../../lib/market";
import { supabase } from "../../services/supabase";

// These must match the numbers inside execute_trade() in Supabase.
// They are only used to show an estimate before the user confirms.
const LIQUIDITY = 500;
const MAX_ORDER = 100;

export default function AssetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [asset, setAsset] = useState<MarketAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [cash, setCash] = useState<number | null>(null);
  const [owned, setOwned] = useState(0);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qtyText, setQtyText] = useState("1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  const load = useCallback(async () => {
    const { data: a } = await supabase
      .from("market_assets")
      .select("*")
      .eq("asset_id", id)
      .maybeSingle();
    setAsset(a ? toAsset(a) : null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    setSignedIn(Boolean(session));

    if (session) {
      const [prof, hold] = await Promise.all([
        supabase
          .from("profiles")
          .select("cash_balance")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase
          .from("holdings")
          .select("quantity")
          .eq("user_id", session.user.id)
          .eq("asset_id", id)
          .maybeSingle(),
      ]);
      setCash(prof.data ? Number(prof.data.cash_balance) : null);
      setOwned(hold.data ? Number(hold.data.quantity) : 0);
    } else {
      setCash(null);
      setOwned(0);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const qty = Math.floor(Number(qtyText));
  const validQty = Number.isFinite(qty) && qty >= 1 && qty <= MAX_ORDER;

  // Cost along the price curve, same math as the database (so it matches exactly)
  let estimate: number | null = null;
  if (asset && validQty) {
    const p = asset.current_price;
    estimate =
      side === "buy"
        ? p * LIQUIDITY * (Math.exp(qty / LIQUIDITY) - 1)
        : p * LIQUIDITY * (1 - Math.exp(-qty / LIQUIDITY));
  }

  function bump(delta: number) {
    const next = Math.min(MAX_ORDER, Math.max(1, (validQty ? qty : 1) + delta));
    setQtyText(String(next));
  }

  async function trade() {
    if (!signedIn) {
      router.push(LOGIN_ROUTE as any);
      return;
    }
    if (!asset || !validQty) {
      setMessage({
        text: `Enter a whole number of shares from 1 to ${MAX_ORDER}.`,
        ok: false,
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.rpc("execute_trade", {
      p_asset_id: asset.asset_id,
      p_side: side,
      p_quantity: qty,
    });
    setBusy(false);
    if (error) {
      setMessage({ text: error.message, ok: false });
    } else {
      setMessage({
        text: `${side === "buy" ? "Bought" : "Sold"} ${qty} share${qty === 1 ? "" : "s"}.`,
        ok: true,
      });
      await load();
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/market" as any);
  }

  const sinceStart =
    asset && asset.initial_price
      ? ((asset.current_price - asset.initial_price) / asset.initial_price) *
        100
      : null;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.7}
          style={styles.back}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.green} />
        </View>
      ) : !asset ? (
        <View style={styles.center}>
          <Text style={{ color: "white" }}>
            This player or team isn't available.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.column}>
            <View style={styles.top}>
              <Avatar uri={asset.image_url} size={88} />
              <Text style={styles.title}>{asset.name}</Text>
              {asset.subtitle ? (
                <Text style={styles.sub}>{asset.subtitle}</Text>
              ) : null}
              <Text style={styles.bigPrice}>{money(asset.current_price)}</Text>
              {sinceStart != null && (
                <Text
                  style={[
                    styles.sinceStart,
                    sinceStart >= 0 ? styles.up : styles.down,
                  ]}
                >
                  {pct(sinceStart)} since launch (
                  {money(asset.initial_price ?? 0)})
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.toggleRow}>
                {(["buy", "sell"] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => {
                      setSide(s);
                      setMessage(null);
                    }}
                    style={[styles.toggle, side === s && styles.toggleActive]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        side === s && styles.toggleTextActive,
                      ]}
                    >
                      {s === "buy" ? "Buy" : "Sell"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Shares</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => bump(-1)}
                >
                  <Text style={styles.stepText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  value={qtyText}
                  onChangeText={(t) => setQtyText(t.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  style={styles.qtyInput}
                />
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => bump(1)}
                >
                  <Text style={styles.stepText}>+</Text>
                </TouchableOpacity>
              </View>

              {estimate != null && (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.line}>
                    {side === "buy" ? "Cost" : "Payout"}:{" "}
                    <Text style={styles.lineStrong}>{money(estimate)}</Text>
                  </Text>
                </View>
              )}

              {signedIn && (
                <Text style={[styles.lineDim, { marginTop: 10 }]}>
                  Cash: {cash == null ? "—" : money(cash)} · You own {owned}{" "}
                  share
                  {owned === 1 ? "" : "s"}
                </Text>
              )}

              {message && (
                <Text
                  style={[styles.message, message.ok ? styles.up : styles.down]}
                >
                  {message.text}
                </Text>
              )}

              <TouchableOpacity
                style={[styles.action, busy && { opacity: 0.6 }]}
                onPress={trade}
                disabled={busy}
                activeOpacity={0.8}
              >
                <Text style={styles.actionText}>
                  {!signedIn
                    ? "Log in to trade"
                    : busy
                      ? "Working..."
                      : side === "buy"
                        ? `Buy ${validQty ? qty : ""} share${qty === 1 ? "" : "s"}`.replace(
                            "  ",
                            " ",
                          )
                        : `Sell ${validQty ? qty : ""} share${qty === 1 ? "" : "s"}`.replace(
                            "  ",
                            " ",
                          )}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 12, paddingBottom: 4 },
  back: { paddingVertical: 8, paddingHorizontal: 4, alignSelf: "flex-start" },
  backText: { color: colors.green, fontSize: 16, fontWeight: "600" },
  column: { width: "100%", maxWidth: 520, paddingHorizontal: 16 },
  top: { alignItems: "center", marginTop: 8 },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "800",
    marginTop: 12,
    textAlign: "center",
  },
  sub: { color: colors.muted, fontSize: 14, marginTop: 4 },
  bigPrice: { color: "white", fontSize: 40, fontWeight: "800", marginTop: 12 },
  sinceStart: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  up: { color: colors.green },
  down: { color: colors.red },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
  },
  toggleRow: { flexDirection: "row", marginBottom: 16 },
  toggle: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#333",
    marginRight: 8,
  },
  toggleActive: { backgroundColor: colors.green },
  toggleText: { color: "#aaaaaa", fontWeight: "700" },
  toggleTextActive: { color: "#000" },
  label: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  qtyRow: { flexDirection: "row", alignItems: "center" },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: "white", fontSize: 22, fontWeight: "600" },
  qtyInput: {
    flex: 1,
    height: 44,
    marginHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#2a2a2c",
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  line: { color: "white", fontSize: 15 },
  lineStrong: { fontWeight: "700" },
  lineDim: { color: colors.muted, fontSize: 12, marginTop: 2 },
  message: { fontSize: 14, fontWeight: "600", marginTop: 12 },
  action: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  actionText: { color: "#000", fontSize: 16, fontWeight: "800" },
});
