import { createClient } from '@supabase/supabase-js';

// Ambil maklumat dari fail .env.local
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cipta dan eksport sambungan Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);