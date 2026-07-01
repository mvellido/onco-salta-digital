import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('example') || supabaseAnonKey.includes('example-anon-key')) {
  console.error(
    'Faltan variables de entorno de Supabase. Asegúrate de definir VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el panel de Vercel.'
  );
}

// Usar globalThis como almacenamiento único
const SUPABASE_KEY = '__ONCO_SUPABASE_CLIENT__';

let supabase;

if (!globalThis[SUPABASE_KEY]) {
  supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  globalThis[SUPABASE_KEY] = supabase;
} else {
  supabase = globalThis[SUPABASE_KEY];
}

export { supabase };
