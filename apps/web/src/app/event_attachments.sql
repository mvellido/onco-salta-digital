CREATE TABLE IF NOT EXISTS event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES treatment_history(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT,
  size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctors_can_view_attachments_for_their_patients"
ON event_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM treatment_history th
    JOIN patients p ON p.id = th.patient_id
    WHERE th.id = event_attachments.event_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

CREATE POLICY "doctors_can_insert_attachments_for_their_patients"
ON event_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM treatment_history th
    JOIN patients p ON p.id = th.patient_id
    WHERE th.id = event_attachments.event_id
      AND p.assigned_doctor_id = auth.uid()
  )
);

CREATE POLICY "doctors_can_delete_attachments_for_their_patients"
ON event_attachments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM treatment_history th
    JOIN patients p ON p.id = th.patient_id
    WHERE th.id = event_attachments.event_id
      AND p.assigned_doctor_id = auth.uid()
  )
);
