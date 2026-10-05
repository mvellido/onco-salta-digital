// Reglas que el esquema JSON no puede expresar solo.

export function validateTreatmentRules(treatment) {
  if (treatment.start_date && treatment.end_date && treatment.end_date < treatment.start_date) {
    return 'La fecha de fin no puede ser anterior a la de inicio.';
  }

  if (
    treatment.cycles_planned != null
    && treatment.cycles_done != null
    && treatment.cycles_done > treatment.cycles_planned
  ) {
    return 'Los ciclos realizados no pueden superar a los planificados.';
  }

  if (treatment.status === 'suspended' && !treatment.suspension_reason?.trim()) {
    return 'Indicá el motivo de la suspensión.';
  }

  return null;
}

// Primera letra en mayúscula, el resto como lo escribió el médico: t2a → T2a, n1mi → N1mi.
export function normalizeTnm(value) {
  if (value == null) return value;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function normalizeTumorInput(body) {
  const row = { ...body };
  for (const field of ['t_category', 'n_category', 'm_category']) {
    if (field in row) row[field] = normalizeTnm(row[field]);
  }
  if ('stage_group' in row && row.stage_group) row.stage_group = row.stage_group.trim().toUpperCase();
  return row;
}
