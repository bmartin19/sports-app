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

//turns date to YYYY-MM-DD using the user's local time
function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function SignUpScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  //web birthday inputs bc mobile has date picker
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [birthdayInput, setBirthdayInput] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function createAccount() {
    // clear previous attempts
    setErrorMessage("");
    setSuccessMessage("");

    // create the login (username + password)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      { email, password },
    );

    if (signUpError) {
      setErrorMessage(signUpError.message);
      return;
    }

    // create the matching row in supabase
    if (signUpData.user) {
      const birthdayValue =
        Platform.OS === "web"
          ? birthdayInput || null
          : birthday
            ? toDateString(birthday)
            : null;

      const { error: profileError } = await supabase.from("profiles").insert({
        id: signUpData.user.id,
        username,
        birthday: birthdayValue,
      });

      if (profileError) {
        setErrorMessage(profileError.message);
        return;
      }
    }

    // short pause for the message, then go to login screen
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
        placeholderTextColor="#888"
        value={username}
        onChangeText={setUsername}
      />

      {/* Birthday: text box on web, date picker on mobile */}
      {Platform.OS === "web" ? (
        <TextInput
          style={styles.input}
          placeholder="Birthday (YYYY-MM-DD)"
          placeholderTextColor="#888"
          value={birthdayInput}
          onChangeText={setBirthdayInput}
        />
      ) : (
        <>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={birthday ? styles.dateText : styles.datePlaceholder}>
              {birthday ? toDateString(birthday) : "Select Birthday"}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={birthday || new Date(2000, 0, 1)}
              mode="date"
              display="default"
              onChange={(_event, pickedDate) => {
                setShowDatePicker(false);
                if (pickedDate) setBirthday(pickedDate);
              }}
            />
          )}
        </>
      )}

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

      <TouchableOpacity style={styles.button} onPress={createAccount}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      {/* howver for web */}
      <Pressable
        style={styles.loginLinkWrap}
        onPress={() => router.push("/login")}
      >
        {({ hovered }) => (
          <Text style={[styles.loginLink, hovered && styles.loginLinkHover]}>
            Already have an account? Log in
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#000000",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 24,
    textAlign: "center",
    color: "#ffffff",
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
  dateText: { color: "#ffffff" },
  datePlaceholder: { color: "#888" },
  button: {
    backgroundColor: "#7d68da",
    padding: 15,
    borderRadius: 10,
    marginTop: 8,
  },
  buttonText: { color: "white", textAlign: "center", fontWeight: "bold" },
  error: { color: "red", marginBottom: 12, textAlign: "center" },
  success: { color: "green", marginBottom: 12, textAlign: "center" },
  loginLinkWrap: { alignSelf: "center", marginTop: 12 },
  loginLink: { color: "#007bff", fontWeight: "500" },
  loginLinkHover: { color: "#0056b3" },
});
