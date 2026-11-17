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

//must match in Supabase
const LIQUIDITY = 500;
const MAX_ORDER = 100;

//same formula Supabase uses. If you buy shares, the price goes up. If you sell, it goes down.
function estimateBuyCost(price: number, shares: number) {
  return price * LIQUIDITY * (Math.exp(shares / LIQUIDITY) - 1);
}

function estimateSellPayout(price: number, shares: number) {
  return price * LIQUIDITY * (1 - Math.exp(-shares / LIQUIDITY));
}

export default function AssetScreen() {
  const { id: assetId } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  // the player or team being shown
  const [asset, setAsset] = useState<MarketAsset | null>(null);
  const [loading, setLoading] = useState(true);

  // info about the logged-in user
  const [signedIn, setSignedIn] = useState(false);
  const [cash, setCash] = useState<number | null>(null);
  const [sharesOwned, setSharesOwned] = useState(0);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [quantityText, setQuantityText] = useState("1");
  const [trading, setTrading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  const loadData = useCallback(async () => {
    const { data: assetRow } = await supabase
      .from("market_assets")
      .select("*")
      .eq("asset_id", assetId)
      .maybeSingle();
    setAsset(assetRow ? toAsset(assetRow) : null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    setSignedIn(Boolean(session));

    if (session) {
      // gets user information about how many belief points they have and shares
      const [profileResult, holdingResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("cash_balance")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase
          .from("holdings")
          .select("quantity")
          .eq("user_id", session.user.id)
          .eq("asset_id", assetId)
          .maybeSingle(),
      ]);
      setCash(
        profileResult.data ? Number(profileResult.data.cash_balance) : null,
      );
      setSharesOwned(
        holdingResult.data ? Number(holdingResult.data.quantity) : 0,
      );
    } else {
      setCash(null);
      setSharesOwned(0);
    }
    setLoading(false);
  }, [assetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const quantity = Math.floor(Number(quantityText));
  const quantityIsValid =
    Number.isFinite(quantity) && quantity >= 1 && quantity <= MAX_ORDER;

  // Estimated cost shown to the user before confirming
  let estimate: number | null = null;
  if (asset && quantityIsValid) {
    if (side === "buy") {
      estimate = estimateBuyCost(asset.current_price, quantity);
    } else {
      estimate = estimateSellPayout(asset.current_price, quantity);
    }
  }

  function changeQuantity(amount: number) {
    const current = quantityIsValid ? quantity : 1;
    const next = Math.min(MAX_ORDER, Math.max(1, current + amount));
    setQuantityText(String(next));
  }

  //function to handle buy/sell
  async function handleTrade() {
    if (!signedIn) {
      router.push(LOGIN_ROUTE as any);
      return;
    }
    if (!asset || !quantityIsValid) {
      setMessage({
        text: `Enter a whole number of shares from 1 to ${MAX_ORDER}.`,
        ok: false,
      });
      return;
    }

    setTrading(true);
    setMessage(null);

    // execute_trade is a function in Supabase that does the actual buy/sell
    const { error } = await supabase.rpc("execute_trade", {
      p_asset_id: asset.asset_id,
      p_side: side,
      p_quantity: quantity,
    });
    setTrading(false);

    if (error) {
      setMessage({ text: error.message, ok: false });
    } else {
      const action = side === "buy" ? "Bought" : "Sold";
      const shareWord = quantity === 1 ? "share" : "shares";
      setMessage({ text: `${action} ${quantity} ${shareWord}.`, ok: true });
      await loadData();
    }
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/market" as any);
    }
  }

  //percent change of an asset since launch
  let changeSinceLaunch: number | null = null;
  if (asset && asset.initial_price) {
    changeSinceLaunch =
      ((asset.current_price - asset.initial_price) / asset.initial_price) * 100;
  }

  let buttonText = "";
  if (!signedIn) {
    buttonText = "Log in to trade";
  } else if (trading) {
    buttonText = "Working...";
  } else {
    const verb = side === "buy" ? "Buy" : "Sell";
    if (quantityIsValid) {
      buttonText = `${verb} ${quantity} ${quantity === 1 ? "share" : "shares"}`;
    } else {
      buttonText = `${verb} shares`;
    }
  }

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
            {/* Name and price */}
            <View style={styles.top}>
              <Avatar uri={asset.image_url} size={88} />
              <Text style={styles.title}>{asset.name}</Text>
              {asset.subtitle ? (
                <Text style={styles.sub}>{asset.subtitle}</Text>
              ) : null}
              <Text style={styles.bigPrice}>{money(asset.current_price)}</Text>
              {changeSinceLaunch != null && (
                <Text
                  style={[
                    styles.sinceLaunch,
                    changeSinceLaunch >= 0 ? styles.up : styles.down,
                  ]}
                >
                  {pct(changeSinceLaunch)} since launch (
                  {money(asset.initial_price ?? 0)})
                </Text>
              )}
            </View>

            {/* Trade form */}
            <View style={styles.card}>
              <View style={styles.toggleRow}>
                {(["buy", "sell"] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => {
                      setSide(option);
                      setMessage(null);
                    }}
                    style={[
                      styles.toggle,
                      side === option && styles.toggleActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        side === option && styles.toggleTextActive,
                      ]}
                    >
                      {option === "buy" ? "Buy" : "Sell"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Shares</Text>
              <View style={styles.quantityRow}>
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => changeQuantity(-1)}
                >
                  <Text style={styles.stepText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  value={quantityText}
                  onChangeText={(text) =>
                    setQuantityText(text.replace(/[^0-9]/g, ""))
                  }
                  keyboardType="number-pad"
                  style={styles.quantityInput}
                />
                <TouchableOpacity
                  style={styles.stepButton}
                  onPress={() => changeQuantity(1)}
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
                  Cash: {cash == null ? "—" : money(cash)} · You own{" "}
                  {sharesOwned} {sharesOwned === 1 ? "share" : "shares"}
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
                style={[styles.action, trading && { opacity: 0.6 }]}
                onPress={handleTrade}
                disabled={trading}
                activeOpacity={0.8}
              >
                <Text style={styles.actionText}>{buttonText}</Text>
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

  // Name and price
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
  sinceLaunch: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  up: { color: colors.green },
  down: { color: colors.red },

  // Trade form
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
  quantityRow: { flexDirection: "row", alignItems: "center" },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: "white", fontSize: 22, fontWeight: "600" },
  quantityInput: {
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
