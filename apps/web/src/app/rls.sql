-- Habilitar RLS en las tablas
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para patients
CREATE POLICY "doctors_can_view_their_patients"
ON patients
FOR SELECT
TO authenticated
USING (assigned_doctor_id = auth.uid());

CREATE POLICY "doctors_can_insert_their_patients"
ON patients
FOR INSERT
TO authenticated
WITH CHECK (assigned_doctor_id = auth.uid());

CREATE POLICY "doctors_can_update_their_patients"
ON patients
FOR UPDATE
TO authenticated
USING (assigned_doctor_id = auth.uid())
WITH CHECK (assigned_doctor_id = auth.uid());

CREATE POLICY "doctors_can_delete_their_patients"
ON patients
FOR DELETE
TO authenticated
USING (assigned_doctor_id = auth.uid());

-- Políticas para audit_logs
CREATE POLICY "doctors_can_view_their_patient_logs"
ON audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = audit_logs.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

CREATE POLICY "doctors_can_insert_logs_for_their_patients"
ON audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = audit_logs.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

CREATE POLICY "doctors_can_update_their_patient_logs"
ON audit_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = audit_logs.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = audit_logs.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

CREATE POLICY "doctors_can_delete_their_patient_logs"
ON audit_logs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM patients p
    WHERE p.id = audit_logs.patient_id
      AND p.assigned_doctor_id = auth.uid()
  )
);
