export default function PatientRegistrationForm({
  formData,
  setFormData,
  onSubmit,
  savingPatient,
  formIsValid,
}) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
      <div className="form-grid">
        <label>
          Nombre completo <span style={{ color: '#b91c1c' }}>*</span>
          <input
            autoFocus
            placeholder="Nombre y apellido"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          />
        </label>
        <label>
          DNI / Documento
          <input
            placeholder="Número de documento"
            value={formData.dni}
            onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
          />
        </label>
        <label>
          Fecha de nacimiento
          <input
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
          />
        </label>
        <label>
          Sexo
          <select
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
          >
            <option value="No especificado">No especificado</option>
            <option value="Masculino">Masculino</option>
            <option value="Femenino">Femenino</option>
            <option value="Otro">Otro</option>
          </select>
        </label>
        <label>
          Contacto
          <input
            placeholder="Ej. +54 387 1234567 o email"
            value={formData.contact}
            onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
          />
        </label>
        <label>
          Estado clínico
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="active">Activo</option>
            <option value="follow_up">Seguimiento</option>
            <option value="discharged">Alta</option>
            <option value="deceased">Fallecido</option>
          </select>
        </label>
      </div>

      <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label>
          Ubicación tumoral
          <input
            placeholder="Ej. Pulmón, mama, colon"
            value={formData.tumor_location || ''}
            onChange={(e) => setFormData({ ...formData, tumor_location: e.target.value })}
          />
        </label>
        <label>
          Estadio tumoral
          <input
            placeholder="Ej. IIA, III, IV"
            value={formData.tumor_stage || ''}
            onChange={(e) => setFormData({ ...formData, tumor_stage: e.target.value })}
          />
        </label>
      </div>

      <label>
        Marcadores moleculares (JSON opcional)
        <textarea
          rows="3"
          placeholder='Ej. {"ER":"positivo","HER2":"negativo"}'
          value={formData.molecular_markers || ''}
          onChange={(e) => setFormData({ ...formData, molecular_markers: e.target.value })}
        />
      </label>

      <label>
        Resumen del diagnóstico
        <textarea
          rows="3"
          placeholder="Resumen breve del diagnóstico o patología"
          value={formData.diagnosis_summary}
          onChange={(e) => setFormData({ ...formData, diagnosis_summary: e.target.value })}
        />
      </label>

      <button type="submit" className="primary" disabled={savingPatient || !formIsValid}>
        {savingPatient ? 'Guardando paciente…' : '➕ Crear paciente'}
      </button>
    </form>
  );
}
