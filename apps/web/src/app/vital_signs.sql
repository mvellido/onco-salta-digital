-- ==========================================
-- Estructura de la tabla vital_signs
-- ==========================================

CREATE TABLE IF NOT EXISTS vital_signs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  blood_pressure_systolic INTEGER, -- Presión arterial sistólica (ej. 120)
  blood_pressure_diastolic INTEGER, -- Presión arterial diastólica (ej. 80)
  heart_rate INTEGER, -- Frecuencia cardíaca (ej. 75)
  temperature NUMERIC(4, 2), -- Temperatura (ej. 36.50)
  weight NUMERIC(5, 2), -- Peso en kg (ej. 70.20)
  height NUMERIC(5, 2), -- Altura en cm o m (ej. 175.50)
  oxygen_saturation INTEGER, -- Saturación de oxígeno (ej. 98)
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- Fecha y hora de registro
);

-- ==========================================
-- Habilitar Row Level Security (RLS)
-- ==========================================

ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Políticas RLS para vital_signs
-- ==========================================

-- 1. Los médicos pueden consultar los signos vitales de sus propios pacientes
CREATE POLICY "doctors_can_view_their_patients_vital_signs"
ON vital_signs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = vital_signs.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

-- 2. Los médicos pueden registrar signos vitales de sus propios pacientes
CREATE POLICY "doctors_can_insert_their_patients_vital_signs"
ON vital_signs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = vital_signs.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

-- 3. Los médicos pueden actualizar signos vitales de sus propios pacientes
CREATE POLICY "doctors_can_update_their_patients_vital_signs"
ON vital_signs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = vital_signs.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = vital_signs.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

-- 4. Los médicos pueden eliminar signos vitales de sus propios pacientes
CREATE POLICY "doctors_can_delete_their_patients_vital_signs"
ON vital_signs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = vital_signs.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);
