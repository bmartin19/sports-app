import { router } from "expo-router";
import { useState } from "react";
import {
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

  const handleLogin = async () => {
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    router.replace("/(tabs)/sports" as any);
  };

  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setError(error.message);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Sports App</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
      <TouchableOpacity onPress={() => router.push("/signup")}>
        <Text>Don&apos;t have an account? Sign up</Text>
      </TouchableOpacity>
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
    backgroundColor: "#000",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  link: { textAlign: "center", color: "#666" },
  error: { color: "red", marginBottom: 12, textAlign: "center" },
});
