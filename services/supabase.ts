import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = "https://nibcinxskjdmezazddln.supabase.co";
const supabaseKey = "sb_publishable_Z0t9OCLb4ZPlRfnRLgIu7g_x3VZytTE";

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
