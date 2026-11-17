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
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function logIn() {
    //clear inputs from previous attempts
    setErrorMessage("");
    setSuccessMessage("");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setErrorMessage(authError.message);
      return;
    }

    //short pause so the user can see the message
    // replace() so that the back button doesn't take the user to the log in page
    setSuccessMessage("Login successful...");
    setTimeout(() => {
      router.replace("/(tabs)/sports" as any);
    }, 1000);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sportfolio</Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {successMessage ? (
        <Text style={styles.success}>{successMessage}</Text>
      ) : null}

      {/* Input Boxes*/}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {/* hovered on web for sign up link */}
      <Pressable
        style={styles.signupLinkWrap}
        onPress={() => router.push("/signup")}
      >
        {({ hovered }) => (
          <Text style={[styles.signupLink, hovered && styles.signupLinkHover]}>
            Don&apos;t have an account? Sign up
          </Text>
        )}
      </Pressable>

      <TouchableOpacity style={styles.button} onPress={logIn}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: {
    fontSize: 28,
    color: "#ffffff",
    fontWeight: "bold",
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#1e1e1e",
    color: "#ffffff",
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
  signupLinkWrap: { alignSelf: "center", marginTop: 12 },
  signupLink: { color: "#007bff", fontWeight: "600" },
  signupLinkHover: { color: "#0056b3" }, // darker blue on hover
});
