import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function GameScreen() {
  const { id } = useLocalSearchParams();
  const [tab, setTab] = useState("feed");

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B0B", padding: 20 }}>
      <Text style={{ color: "white", fontSize: 20, marginBottom: 20 }}>
        Game {id}
      </Text>

      {/* Tabs */}
      <View style={{ flexDirection: "row", marginBottom: 20 }}>
        <TouchableOpacity onPress={() => setTab("feed")}>
          <Text
            style={{
              color: tab === "feed" ? "#00FFAA" : "white",
              marginRight: 20,
              fontSize: 16,
            }}
          >
            Feed
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setTab("box")}>
          <Text
            style={{
              color: tab === "box" ? "#00FFAA" : "white",
              fontSize: 16,
            }}
          >
            Box Score
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {tab === "feed" ? (
        <Text style={{ color: "white" }}>
          Live play-by-play feed will go here...
        </Text>
      ) : (
        <Text style={{ color: "white" }}>Box score stats will go here...</Text>
      )}
    </View>
  );
}
