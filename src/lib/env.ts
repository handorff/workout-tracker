const fallbackUrl = "https://example.supabase.co";
const fallbackAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder.placeholder";

export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? fallbackUrl,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? fallbackAnonKey,
  isSupabaseConfigured:
    Boolean(import.meta.env.VITE_SUPABASE_URL) &&
    Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
};
