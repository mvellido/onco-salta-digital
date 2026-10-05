export const EMPTY_PATIENT_FORM = {
  full_name: '',
  dni: '',
  birth_date: '',
  gender: 'No especificado',
  contact: '',
  diagnosis_summary: '',
  assigned_doctor_id: '',
};

export default function PatientRegistrationForm({ formData, setFormData, onSubmit, savingPatient, doctors = null }) {
  const set = (field) => (event) => setFormData({ ...formData, [field]: event.target.value });
  const needsDoctor = Array.isArray(doctors);
  const formIsValid = formData.full_name.trim().length > 0 && (!needsDoctor || formData.assigned_doctor_id);

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
      <div className="form-grid">
        <label>
          Nombre completo <span style={{ color: 'var(--danger)' }}>*</span>
          <input id="new-full-name" autoFocus placeholder="Nombre y apellido" value={formData.full_name} onChange={set('full_name')} />
        </label>
        <label>
          DNI
          <input id="new-dni" inputMode="numeric" placeholder="Sin puntos" value={formData.dni} onChange={set('dni')} />
        </label>
        <label>
          Fecha de nacimiento
          <input id="new-birth-date" type="date" value={formData.birth_date} onChange={set('birth_date')} />
        </label>
        <label>
          Sexo
          <select id="new-gender" value={formData.gender} onChange={set('gender')}>
            <option value="No especificado">No especificado</option>
            <option value="Femenino">Femenino</option>
            <option value="Masculino">Masculino</option>
            <option value="Otro">Otro</option>
          </select>
        </label>
        <label>
          Contacto
          <input id="new-contact" placeholder="Teléfono o email" value={formData.contact} onChange={set('contact')} />
        </label>
        {needsDoctor ? (
          <label>
            Médico/a responsable <span style={{ color: 'var(--danger)' }}>*</span>
            <select id="new-doctor" value={formData.assigned_doctor_id} onChange={set('assigned_doctor_id')}>
              <option value="">Elegí un médico</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>{doctor.full_name || doctor.email}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <label>
        Motivo de consulta o diagnóstico presuntivo
        <textarea id="new-diagnosis" rows="2" placeholder="Ej.: nódulo pulmonar en estudio" value={formData.diagnosis_summary} onChange={set('diagnosis_summary')} />
      </label>

      <p style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
        Al crear el paciente se abre su ficha para cargar el tumor, el estadio y los tratamientos.
      </p>

      <button type="submit" disabled={savingPatient || !formIsValid}>
        {savingPatient ? 'Guardando paciente…' : 'Crear paciente y abrir ficha'}
      </button>
    </form>
  );
}
