import 'dotenv/config.js';
import Fastify from 'fastify';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Cargar variables de .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

// Configuración de puerto
const port = Number(process.env.PORT || 3001);

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error(
    'Error: Variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY no están configuradas. En desarrollo, usa .env.local'
  );
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Crear cliente Supabase
const supabase = supabaseUrl && supabaseServiceRoleKey 
  ? createSupabaseClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

// Crear servidor Fastify
const fastify = Fastify({ logger: true });

// Health check
fastify.get('/health', async () => ({ status: 'ok' }));

// GET /patients - Listar pacientes
fastify.get('/patients', async (request, reply) => {
  if (!supabase) {
    return reply.code(500).send({ error: 'Supabase no está configurado' });
  }

  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching patients:', error);
      return reply.code(500).send({ error: error.message });
    }

    return data || [];
  } catch (err) {
    console.error('Exception in GET /patients:', err);
    return reply.code(500).send({ error: err.message });
  }
});

// POST /patients - Crear paciente
fastify.post('/patients', async (request, reply) => {
  if (!supabase) {
    return reply.code(500).send({ error: 'Supabase no está configurado' });
  }

  const { full_name, diagnosis_summary, status = 'active', assigned_doctor_id } = request.body || {};

  if (!full_name) {
    return reply.code(400).send({ error: 'full_name es requerido' });
  }

  try {
    const { data, error } = await supabase
      .from('patients')
      .insert([
        {
          full_name,
          diagnosis_summary,
          status,
          assigned_doctor_id,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.error('Error creating patient:', error);
      return reply.code(500).send({ error: error.message });
    }

    return reply.code(201).send(data?.[0] || {});
  } catch (err) {
    console.error('Exception in POST /patients:', err);
    return reply.code(500).send({ error: err.message });
  }
});

// GET /patients/:id - Obtener paciente por ID
fastify.get('/patients/:id', async (request, reply) => {
  if (!supabase) {
    return reply.code(500).send({ error: 'Supabase no está configurado' });
  }

  const { id } = request.params;

  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching patient:', error);
      return reply.code(500).send({ error: error.message });
    }

    if (!data) {
      return reply.code(404).send({ error: 'Paciente no encontrado' });
    }

    return data;
  } catch (err) {
    console.error('Exception in GET /patients/:id:', err);
    return reply.code(500).send({ error: err.message });
  }
});

// Iniciar servidor
fastify.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`API listening on http://0.0.0.0:${port}`);
  console.log(`Health check: GET http://0.0.0.0:${port}/health`);
});
