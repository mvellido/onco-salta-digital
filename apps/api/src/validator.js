import Ajv from 'ajv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import addFormats from 'ajv-formats';

// Obtener la ruta absoluta al archivo JSON
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔧 CORREGIDO: Subir 3 niveles desde apps/api/src/ hasta la raíz del proyecto
const schemaPath = path.join(__dirname, '../../../specs/001-onco-salta-digital/patient-schema.json');

console.log('📂 Buscando schema en:', schemaPath);

// Leer el archivo JSON
const patientSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

// Inicializar Ajv y agregar soporte para formatos (como 'date')
const ajv = new Ajv();
addFormats(ajv); // ← 🔧 NUEVO: Agrega soporte para formatos como 'date'

const validate = ajv.compile(patientSchema);

/**
 * Valida los datos de un paciente contra el esquema definido.
 * @param {Object} data - Datos del paciente a validar.
 * @returns {Object} - { valid: boolean, errors: array|null }
 */
export const validatePatient = (data) => {
  const valid = validate(data);
  if (!valid) {
    console.error('❌ Errores de validación:', validate.errors);
    return { valid: false, errors: validate.errors };
  }
  console.log('✅ Paciente válido según el esquema.');
  return { valid: true, errors: null };
};

/**
 * Función auxiliar para validar y formatear errores de forma legible.
 * @param {Object} data - Datos del paciente.
 * @returns {Object} - { isValid, errorsFormatted }
 */
export const validatePatientFormatted = (data) => {
  const result = validatePatient(data);
  if (result.valid) {
    return { isValid: true, errorsFormatted: null };
  }
  
  // Formatear errores para mostrarlos de manera amigable
  const errorsFormatted = result.errors.map(err => ({
    campo: err.instancePath.replace('/', ''),
    mensaje: err.message,
    valor: err.params?.value || err.data || 'N/A'
  }));
  
  return { isValid: false, errorsFormatted: errorsFormatted };
};