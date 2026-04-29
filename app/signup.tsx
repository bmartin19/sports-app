import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../services/supabase";

export default function SignUpScreen() {
  const [username, setUsername] = useState("");
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [birthdayText, setBirthdayText] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function formatDate(date: Date) {
    return date.toISOString().split("T")[0];
  }

  async function handleSignUp() {
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        username,
        birthday:
          Platform.OS === "web"
            ? birthdayText || null
            : birthday
              ? formatDate(birthday)
              : null,
      });

      if (profileError) {
        setErrorMessage(profileError.message);
        return;
      }
    }

    setSuccessMessage("Account created! Redirecting to login...");

    setTimeout(() => {
      router.replace("/login");
    }, 1000);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {successMessage ? (
        <Text style={styles.success}>{successMessage}</Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
      />

      {Platform.OS === "web" ? (
        <TextInput
          style={styles.input}
          placeholder="Birthday (YYYY-MM-DD)"
          value={birthdayText}
          onChangeText={(text) => {
            setBirthdayText(text);

            const date = new Date(text);
            if (!isNaN(date.getTime())) {
              setBirthday(date);
            } else {
              setBirthday(null);
            }
          }}
        />
      ) : (
        <>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(true)}
          >
            <Text>{birthday ? formatDate(birthday) : "Select Birthday"}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={birthday || new Date(2000, 0, 1)}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);

                if (selectedDate) {
                  setBirthday(selectedDate);
                }
              }}
            />
          )}
        </>
      )}

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

      <TouchableOpacity style={styles.button} onPress={handleSignUp}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <Pressable
        style={styles.linkContainer}
        onPress={() => router.push("/login")}
      >
        {({ hovered }) => (
          <Text style={[styles.link, hovered && styles.linkHover]}>
            Already have an account? Log in
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: "red", marginBottom: 12, textAlign: "center" },
  success: { color: "green", marginBottom: 12, textAlign: "center" },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  button: {
    backgroundColor: "#7d68da",
    padding: 15,
    borderRadius: 10,
    marginTop: 8,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
  },
  linkContainer: {
    alignSelf: "center",
    marginTop: 12,
  },

  link: {
    color: "#007bff",
    fontWeight: "500",
  },

  linkHover: {
    color: "#0056b3",
  },
});
