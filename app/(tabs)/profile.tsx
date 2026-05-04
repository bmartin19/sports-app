import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../services/supabase";

export default function ProfileScreen() {
  const [username, setUsername] = useState("");
  const [birthday, setBirthday] = useState("");

  const [currentUsername, setCurrentUsername] = useState("");
  const [currentBirthday, setCurrentBirthday] = useState("");

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile();
  }, []);

  async function getProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("username, birthday")
      .eq("id", user.id)
      .single();

    if (data) {
      setCurrentUsername(data.username || "");
      setCurrentBirthday(data.birthday || "");
    }

    setLoading(false);
  }

  async function saveProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert("Error", "You are not logged in.");
      return;
    }

    const updates: {
      username?: string;
      birthday?: string;
    } = {};

    if (username.trim()) {
      updates.username = username.trim();
    }

    if (birthday.trim()) {
      updates.birthday = birthday.trim();
    }

    if (Object.keys(updates).length === 0) {
      Alert.alert("Nothing to save", "Enter a new username or birthday.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      Alert.alert("Error", error.message);
      return;
    }

    // update placeholders
    if (updates.username) {
      setCurrentUsername(updates.username);
    }

    if (updates.birthday) {
      setCurrentBirthday(updates.birthday);
    }

    // clear inputs
    setUsername("");
    setBirthday("");

    Alert.alert("Saved!", "Your profile has been updated.");
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.label}>Username</Text>
      <TextInput
        style={styles.input}
        value={username}
        onChangeText={setUsername}
        placeholder={
          currentUsername ? `Current: ${currentUsername}` : "Enter username"
        }
      />

      <Text style={styles.label}>Birthday</Text>
      <TextInput
        style={styles.input}
        value={birthday}
        onChangeText={setBirthday}
        placeholder={
          currentBirthday ? `Current: ${currentBirthday}` : "YYYY-MM-DD"
        }
      />

      <TouchableOpacity style={styles.button} onPress={saveProfile}>
        <Text style={styles.buttonText}>Save Changes</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 32,
    marginTop: 24,
  },

  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },

  button: {
    backgroundColor: "#000",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },

  logoutButton: {
    padding: 14,
    alignItems: "center",
  },

  logoutText: {
    color: "red",
  },
});
