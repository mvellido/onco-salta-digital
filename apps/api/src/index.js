import 'dotenv/config.js';
import Fastify from 'fastify';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { validatePatientFormatted } from './validator.js';
import cors from '@fastify/cors';

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

// POST /patients - Crear paciente CON VALIDACIÓN Y LOGS
fastify.post('/patients', async (request, reply) => {
  console.log('🔍 1. POST /patients recibido');
  
  if (!supabase) {
    console.log('❌ Supabase no configurado');
    return reply.code(500).send({ error: 'Supabase no está configurado' });
  }
  console.log('✅ Supabase configurado');

  try {
    console.log('🔍 2. Iniciando validación...');
    const validation = validatePatientFormatted(request.body);
    console.log('🔍 3. Validación completada:', validation);
    
    if (!validation.isValid) {
      console.log('❌ Validación fallida');
      return reply.code(400).send({
        error: 'Datos del paciente inválidos según el esquema IA Core',
        details: validation.errorsFormatted
      });
    }
    console.log('✅ Validación exitosa');

    const { datos_generales, historia_tumoral } = request.body;
    console.log('🔍 4. Insertando en Supabase...');

    const { data, error } = await supabase
      .from('patients')
      .insert([{
        full_name: datos_generales.nombre_completo,
        dni: datos_generales.dni || null,
        birth_date: datos_generales.fecha_nacimiento || null,
        gender: datos_generales.sexo || 'No especificado',
        contact: datos_generales.contacto || null,
        diagnosis_summary: historia_tumoral?.diagnostico_resumen || '',
        tumor_location: historia_tumoral?.ubicacion || null,
        tumor_stage: historia_tumoral?.estadio || null,
        molecular_markers: historia_tumoral?.marcadores_moleculares || {},
      }])
      .select();

    if (error) {
      console.log('❌ Error en Supabase:', error);
      return reply.code(500).send({ error: error.message });
    }
    console.log('✅ Paciente creado en Supabase');

    return reply.code(201).send({
      message: 'Paciente creado correctamente con validación IA Core',
      patient: data?.[0] || {}
    });
  } catch (err) {
    console.log('❌ Excepción en POST /patients:', err);
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

// POST /ia/consult - Endpoint para consultar IA Core (con Gemini real)
fastify.post('/ia/consult', async (request, reply) => {
  try {
    const { patientData, question } = request.body;

    if (!patientData || !question) {
      return reply.code(400).send({
        error: 'Se requiere patientData y question para consultar IA Core'
      });
    }

    // Importar Gemini SDK
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    // Usar la API Key desde .env.local
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Configurar el modelo
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    // Construir el prompt con los datos del paciente
    const prompt = `
      Eres un asistente médico especializado en oncología.
      Analiza el siguiente caso clínico y responde la pregunta del médico.

      DATOS DEL PACIENTE:
      - Nombre: ${patientData.datos_generales.nombre_completo}
      - Edad: ${patientData.datos_generales.edad || 'No especificada'}
      - Diagnóstico: ${patientData.historia_tumoral.diagnostico_resumen}
      - Estadio: ${patientData.historia_tumoral.estadio || 'No especificado'}
      - Marcadores moleculares: ${JSON.stringify(patientData.historia_tumoral.marcadores_moleculares, null, 2)}

      PREGUNTA DEL MÉDICO:
      ${question}

      Responde de forma clara y basada en evidencia médica.
    `;

    // Generar respuesta
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const answer = response.text();

    return reply.code(200).send({
      message: 'IA Core - Gemini real',
      patient: patientData.datos_generales.nombre_completo,
      question: question,
      answer: answer
    });

  } catch (err) {
    console.error('Exception in POST /ia/consult:', err);
    return reply.code(500).send({ error: err.message });
  }
});

// Habilitar CORS para todas las rutas
fastify.register(cors, {
  origin: true, // Permite cualquier origen (para desarrollo)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// PUT /patients/:id - Actualizar paciente
fastify.put('/patients/:id', async (request, reply) => {
  if (!supabase) {
    return reply.code(500).send({ error: 'Supabase no está configurado' });
  }

  const { id } = request.params;
  const { 
    full_name, 
    diagnosis_summary, 
    status, 
    dni, 
    birth_date, 
    gender, 
    contact,
    tumor_location,
    tumor_stage,
    molecular_markers
  } = request.body || {};

  try {
    const { data, error } = await supabase
      .from('patients')
      .update({
        full_name,
        diagnosis_summary,
        status,
        dni,
        birth_date,
        gender,
        contact,
        tumor_location,
        tumor_stage,
        molecular_markers,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error updating patient:', error);
      return reply.code(500).send({ error: error.message });
    }

    if (!data || data.length === 0) {
      return reply.code(404).send({ error: 'Paciente no encontrado' });
    }

    return reply.code(200).send(data[0]);
  } catch (err) {
    console.error('Exception in PUT /patients/:id:', err);
    return reply.code(500).send({ error: err.message });
  }
});

// DELETE /patients/:id - Eliminar paciente
fastify.delete('/patients/:id', async (request, reply) => {
  if (!supabase) {
    return reply.code(500).send({ error: 'Supabase no está configurado' });
  }

  const { id } = request.params;

  try {
    const { data, error } = await supabase
      .from('patients')
      .delete()
      .eq('id', id)
      .select();

    if (error) {
      console.error('Error deleting patient:', error);
      return reply.code(500).send({ error: error.message });
    }

    if (!data || data.length === 0) {
      return reply.code(404).send({ error: 'Paciente no encontrado' });
    }

    return reply.code(200).send({ 
      message: 'Paciente eliminado correctamente',
      deleted: data[0]
    });
  } catch (err) {
    console.error('Exception in DELETE /patients/:id:', err);
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
