-- 1) Crear la tabla treatment_history
CREATE TABLE IF NOT EXISTS treatment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  outcome_note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Habilitar RLS
ALTER TABLE treatment_history ENABLE ROW LEVEL SECURITY;

-- 3) Políticas para médicos autenticados
CREATE POLICY "doctors_can_view_history_for_their_patients"
ON treatment_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = treatment_history.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

CREATE POLICY "doctors_can_insert_history_for_their_patients"
ON treatment_history
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = treatment_history.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

CREATE POLICY "doctors_can_update_history_for_their_patients"
ON treatment_history
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = treatment_history.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = treatment_history.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

CREATE POLICY "doctors_can_delete_history_for_their_patients"
ON treatment_history
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = treatment_history.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);
