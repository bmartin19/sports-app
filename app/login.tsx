import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../services/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleLogin = async () => {
    setError("");
    setSuccessMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setSuccessMessage("Login successful...");

    setTimeout(() => {
      router.replace("/(tabs)/sports" as any);
    }, 1000);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sportfolio</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {successMessage ? (
        <Text style={styles.success}>{successMessage}</Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable
        style={styles.linkContainer}
        onPress={() => router.push("/signup")}
      >
        {({ hovered }) => (
          <Text style={[styles.link, hovered && styles.linkHover]}>
            Don&apos;t have an account? Sign up
          </Text>
        )}
      </Pressable>

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#7d68da",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 12,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "red", marginBottom: 12, textAlign: "center" },
  success: { color: "green", marginBottom: 12, textAlign: "center" },

  linkText: {
    textAlign: "center",
    marginTop: 12,
    color: "#444",
  },

  link: {
    color: "#007bff",
    fontWeight: "600",
  },

  linkContainer: {
    alignSelf: "center",
    marginTop: 12,
  },
  linkHover: {
    color: "#0056b3", // darker blue on hover
  },
});
