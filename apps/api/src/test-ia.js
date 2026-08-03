import { validatePatientFormatted } from './validator.js';

// Paciente ficticio para probar la validación
const pacienteFicticio = {
  datos_generales: {
    nombre_completo: "Juan Carlos Ramírez",
    dni: "25.987.654",
    fecha_nacimiento: "1982-11-23",
    sexo: "Masculino",
    contacto: "+54 9 387 555-7890"
  },
  historia_tumoral: {
    ubicacion: "Pulmón derecho, lóbulo superior",
    estadio: "IV (T2N3M1c)",
    marcadores_moleculares: {
      EGFR: "Negativo",
      ALK: "Negativo",
      PD_L1: "> 50%"
    },
    diagnostico_resumen: "Adenocarcinoma de pulmón no microcítico con metástasis cerebrales y óseas."
  },
  tratamientos_medicacion: [
    {
      medicamento: "Pembrolizumab",
      dosis: "200 mg",
      frecuencia: "Cada 3 semanas",
      fecha_inicio: "2026-01-15",
      estado: "activo"
    }
  ]
};

// Ejecutar validación
console.log('\n🔍 Validando paciente ficticio...\n');
const resultado = validatePatientFormatted(pacienteFicticio);

if (resultado.isValid) {
  console.log('✅ ¡Paciente válido! El esquema está correcto.\n');
  console.log('📋 Datos del paciente validado:');
  console.log(`- Nombre: ${pacienteFicticio.datos_generales.nombre_completo}`);
  console.log(`- DNI: ${pacienteFicticio.datos_generales.dni}`);
  console.log(`- Diagnóstico: ${pacienteFicticio.historia_tumoral.diagnostico_resumen}`);
  console.log(`- Tratamiento: ${pacienteFicticio.tratamientos_medicacion[0].medicamento} (${pacienteFicticio.tratamientos_medicacion[0].estado})`);
  console.log('\n✅ Flujo Clínica → IA Core listo para continuar.');
} else {
  console.log('❌ Errores de validación encontrados:');
  resultado.errorsFormatted.forEach(err => {
    console.log(`  - Campo: ${err.campo} → ${err.mensaje} (Valor: ${err.valor})`);
  });
}

// Caso de prueba con datos incompletos (para verificar que el validador detecta errores)
console.log('\n🧪 Probando caso con datos incompletos...\n');
const pacienteIncompleto = {
  datos_generales: {
    // nombre_completo está vacío (debería fallar)
    dni: "11.111.111"
  }
};

const resultadoIncompleto = validatePatientFormatted(pacienteIncompleto);
if (!resultadoIncompleto.isValid) {
  console.log('✅ El validador detectó correctamente el error:');
  resultadoIncompleto.errorsFormatted.forEach(err => {
    console.log(`  - Campo: ${err.campo} → ${err.mensaje}`);
  });
}