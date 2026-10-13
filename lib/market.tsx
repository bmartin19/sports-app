import { Image, StyleSheet, View } from "react-native";

// Where "log in" buttons send people. Change this to your login screen's route.
export const LOGIN_ROUTE = "/login";

export type MarketAsset = {
  asset_id: number;
  asset_type: "player" | "team";
  name: string;
  subtitle: string | null;
  image_url: string | null;
  current_price: number;
  initial_price: number | null;
};

// Supabase can hand numbers back as strings; make sure they are numbers.
export function toAsset(r: any): MarketAsset {
  return {
    ...r,
    current_price: Number(r.current_price),
    initial_price: r.initial_price == null ? null : Number(r.initial_price),
  };
}

export const money = (n: number) =>
  `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export function Avatar({
  uri,
  size = 40,
}: {
  uri: string | null;
  size?: number;
}) {
  const box = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.avatar, box]}>
      {uri ? <Image source={{ uri }} style={box} resizeMode="contain" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: "#2a2a2c", overflow: "hidden" },
});

export const colors = {
  card: "#1c1c1e",
  muted: "#9a9a9f",
  dim: "#6b6b70",
  green: "#16fd16",
  red: "#ff4d4d",
};
