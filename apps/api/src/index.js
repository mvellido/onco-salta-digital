import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { buildApp } from './app.js';

// En desarrollo las variables vienen de apps/api/.env.local; en Render, del panel.
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. En desarrollo, definilas en apps/api/.env.local.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = buildApp({
  supabase,
  allowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'medical-history',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  appUrl: (process.env.APP_URL || '').replace(/\/$/, ''),
});

const port = Number(process.env.PORT || 3001);

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
