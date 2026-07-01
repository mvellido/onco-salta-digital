import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('example') || supabaseAnonKey.includes('example-anon-key')) {
  console.error(
    'Faltan variables de entorno de Supabase. Asegúrate de definir VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el panel de Vercel.'
  );
}

let supabase;

// Singleton: crear solo una instancia del cliente Supabase en todo el app
if (typeof window !== 'undefined') {
  if (!window.__ONCO_SUPABASE_CLIENT__) {
    window.__ONCO_SUPABASE_CLIENT__ = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  }
  supabase = window.__ONCO_SUPABASE_CLIENT__;
} else {
  // En servidor (SSR), crear una nueva instancia
  supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
