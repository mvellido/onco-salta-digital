import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'example-anon-key';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STORAGE_BUCKET = 'medical-history';

function PatientDetail({ user, initialPatient = null, initialEvents = [] }) {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(initialPatient);
  const [events, setEvents] = useState(initialEvents);
  const [attachmentsByEvent, setAttachmentsByEvent] = useState({});
  const [loading, setLoading] = useState(!initialPatient);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingEventId, setEditingEventId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [formData, setFormData] = useState({
    event_date: new Date().toISOString().slice(0, 10),
    event_type: 'Consulta de seguimiento',
    description: '',
    outcome_note: '',
  });

  const loadPatientAndEvents = async () => {
    setLoading(!initialPatient);
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .maybeSingle();

    if (patientError) {
      setMessage({ type: 'error', text: patientError.message || 'No se pudo cargar el paciente.' });
      setLoading(false);
      return;
    }

    const { data: eventData, error: eventsError } = await supabase
      .from('treatment_history')
      .select('*')
      .eq('patient_id', patientId)
      .order('event_date', { ascending: false });

    if (eventsError) {
      setMessage({ type: 'error', text: eventsError.message || 'No se pudo cargar el historial.' });
    }

    setPatient(patientData);
    setEvents(eventData || []);

    const attachments = {};
    if (eventData?.length) {
      const { data: attachmentData } = await supabase
        .from('event_attachments')
        .select('*')
        .in('event_id', eventData.map((event) => event.id));

      attachmentData?.forEach((attachment) => {
        attachments[attachment.event_id] = [...(attachments[attachment.event_id] || []), attachment];
      });
    }

    setAttachmentsByEvent(attachments);
    setLoading(false);
  };

  useEffect(() => {
    if (initialPatient && initialEvents) {
      setPatient(initialPatient);
      setEvents(initialEvents);
      setLoading(false);
      return;
    }

    if (patientId) {
      loadPatientAndEvents();
    }
  }, [patientId, initialPatient, initialEvents]);

  const eventTypes = useMemo(
    () => ['Diagnóstico', 'Quimioterapia', 'Radioterapia', 'Cirugía', 'Consulta de seguimiento', 'Otro'],
    []
  );

  const filteredEvents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return events.filter((event) => {
      const matchesType = !filterType || event.event_type === filterType;
      const matchesQuery =
        !normalizedQuery ||
        (event.event_date || '').toLowerCase().includes(normalizedQuery) ||
        (event.event_type || '').toLowerCase().includes(normalizedQuery) ||
        (event.description || '').toLowerCase().includes(normalizedQuery);

      return matchesType && matchesQuery;
    });
  }, [events, filterType, searchQuery]);

  const handleEdit = (event) => {
    setEditingEventId(event.id);
    setFormData({
      event_date: event.event_date || new Date().toISOString().slice(0, 10),
      event_type: event.event_type || 'Consulta de seguimiento',
      description: event.description || '',
      outcome_note: event.outcome_note || '',
    });
    setSelectedFiles([]);
    setMessage({ type: '', text: '' });
  };

  const resetForm = () => {
    setEditingEventId(null);
    setSelectedFiles([]);
    setFormData({
      event_date: new Date().toISOString().slice(0, 10),
      event_type: 'Consulta de seguimiento',
      description: '',
      outcome_note: '',
    });
  };

  const uploadAttachments = async (eventId) => {
    if (!selectedFiles.length) {
      return [];
    }

    const uploadedAttachments = [];
    for (const file of selectedFiles) {
      const safeName = file.name.replace(/\s+/g, '-').toLowerCase();
      const path = `${patientId}/${eventId}/${Date.now()}-${safeName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data: attachmentData, error: attachmentError } = await supabase
        .from('event_attachments')
        .insert([
          {
            event_id: eventId,
            file_name: file.name,
            storage_path: uploadData?.path || path,
            content_type: file.type || 'application/octet-stream',
            size: file.size,
          },
        ])
        .select();

      if (attachmentError) {
        throw attachmentError;
      }

      uploadedAttachments.push(attachmentData?.[0]);
    }

    return uploadedAttachments;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage({ type: '', text: '' });

    if (!formData.description.trim()) {
      setMessage({ type: 'error', text: 'La descripción del evento es obligatoria.' });
      return;
    }

    setSaving(true);

    try {
      let savedEvent;
      if (editingEventId) {
        const { data, error } = await supabase
          .from('treatment_history')
          .update({
            event_date: formData.event_date,
            event_type: formData.event_type,
            description: formData.description,
            outcome_note: formData.outcome_note,
          })
          .eq('id', editingEventId)
          .select();

        if (error) {
          throw error;
        }

        savedEvent = data?.[0];
      } else {
        const { data, error } = await supabase
          .from('treatment_history')
          .insert([
            {
              patient_id: patientId,
              event_date: formData.event_date,
              event_type: formData.event_type,
              description: formData.description,
              outcome_note: formData.outcome_note,
              created_by: user?.id,
            },
          ])
          .select();

        if (error) {
          throw error;
        }

        savedEvent = data?.[0];
      }

      if (savedEvent) {
        if (selectedFiles.length) {
          const uploaded = await uploadAttachments(savedEvent.id);
          setAttachmentsByEvent((current) => ({
            ...current,
            [savedEvent.id]: [...(current[savedEvent.id] || []), ...uploaded],
          }));
        }

        if (editingEventId) {
          setEvents((current) => current.map((item) => (item.id === savedEvent.id ? savedEvent : item)));
          setMessage({ type: 'success', text: 'Evento actualizado correctamente.' });
        } else {
          setEvents((current) => [savedEvent, ...current]);
          setMessage({ type: 'success', text: 'Evento agregado al historial clínico.' });
        }
      }

      resetForm();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo guardar el evento.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (attachment) => {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(attachment.storage_path, 3600);
    if (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo descargar el archivo.' });
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePreviewAttachment = async (attachment) => {
    try {
      const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(attachment.storage_path, 3600);
      if (error) {
        throw error;
      }

      setPreviewAttachment(attachment);
      setPreviewUrl(data.signedUrl);
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo previsualizar el archivo.' });
    }
  };

  const handleDeleteAttachment = async (eventId, attachment) => {
    const confirmed = window.confirm(`¿Deseas eliminar el adjunto ${attachment.file_name}?`);
    if (!confirmed) {
      return;
    }

    try {
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove([attachment.storage_path]);
      if (storageError) {
        throw storageError;
      }

      const { error: dbError } = await supabase.from('event_attachments').delete().eq('id', attachment.id);
      if (dbError) {
        throw dbError;
      }

      setAttachmentsByEvent((current) => ({
        ...current,
        [eventId]: (current[eventId] || []).filter((item) => item.id !== attachment.id),
      }));

      if (previewAttachment?.id === attachment.id) {
        setPreviewAttachment(null);
        setPreviewUrl('');
      }

      setMessage({ type: 'success', text: 'Adjunto eliminado correctamente.' });
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo eliminar el adjunto.' });
    }
  };

  const isPreviewableAttachment = (attachment) => {
    const contentType = attachment.content_type || '';
    return contentType.startsWith('image/') || contentType === 'application/pdf' || /\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(attachment.file_name || '');
  };

  if (loading) {
    return <div style={{ padding: 24 }}>Cargando historial clínico…</div>;
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: 1100, margin: '24px auto', padding: 24, background: '#f8fbff', borderRadius: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>Historial clínico</h1>
          <p style={{ margin: 0, color: '#475569' }}>{patient?.full_name || 'Paciente'}</p>
        </div>
        <button type="button" onClick={() => navigate('/')} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
          Volver a pacientes
        </button>
      </div>

      <div style={{ marginTop: 18, display: 'grid', gap: 16 }}>
        <section style={{ background: '#fff', padding: 20, borderRadius: 16, boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)' }}>
          <h2 style={{ marginTop: 0 }}>Datos generales</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div><strong>Nombre:</strong> {patient?.full_name || '—'}</div>
            <div><strong>Documento:</strong> {patient?.document_number || 'Sin registro'}</div>
            <div><strong>Estado:</strong> {patient?.status || '—'}</div>
            <div><strong>Diagnóstico:</strong> {patient?.diagnosis_summary || 'Sin diagnóstico'}</div>
          </div>
        </section>

        <section style={{ background: '#fff', padding: 20, borderRadius: 16, boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>Línea de tiempo</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                Buscar por fecha o tipo
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por fecha o tipo"
                  style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 10, minWidth: 220 }}
                />
              </label>
              <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
                Filtrar por tipo
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 10 }}>
                  <option value="">Todos</option>
                  {eventTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {message.text && message.type ? (
            <div style={{ marginTop: 12, marginBottom: 12, padding: '10px 12px', borderRadius: 10, background: message.type === 'success' ? '#f0fdf4' : '#fef2f2', color: message.type === 'success' ? '#166534' : '#b91c1c' }}>
              {message.text}
            </div>
          ) : null}

          {previewAttachment ? (
            <div style={{ marginTop: 12, border: '1px solid #dbeafe', borderRadius: 12, padding: 12, background: '#f8fbff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <strong>Vista previa: {previewAttachment.file_name}</strong>
                <button type="button" onClick={() => { setPreviewAttachment(null); setPreviewUrl(''); }} style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                  Cerrar
                </button>
              </div>
              {previewAttachment.content_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(previewAttachment.file_name || '') ? (
                <img src={previewUrl} alt={previewAttachment.file_name} style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 8 }} />
              ) : (
                <iframe src={previewUrl} title={previewAttachment.file_name} style={{ width: '100%', minHeight: 360, border: '1px solid #e2e8f0', borderRadius: 8 }} />
              )}
            </div>
          ) : null}

          {filteredEvents.length === 0 ? (
            <p style={{ color: '#64748b' }}>Sin eventos registrados.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {filteredEvents.map((event) => (
                <div key={event.id} style={{ borderLeft: '3px solid #2563eb', paddingLeft: 12, background: '#f8fafc', padding: 12, borderRadius: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{event.event_type}</strong>
                    <span style={{ color: '#64748b' }}>{event.event_date}</span>
                  </div>
                  <p style={{ margin: '8px 0 4px' }}>{event.description}</p>
                  {event.outcome_note ? <p style={{ margin: 0, color: '#475569' }}><em>Nota:</em> {event.outcome_note}</p> : null}

                  {(attachmentsByEvent[event.id] || []).length > 0 ? (
                    <div style={{ marginTop: 8 }}>
                      <strong>Adjuntos:</strong>
                      <ul style={{ margin: '6px 0 0 16px' }}>
                        {(attachmentsByEvent[event.id] || []).map((attachment) => (
                          <li key={attachment.id} style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button type="button" onClick={() => handleDownload(attachment)} style={{ background: 'none', border: 'none', color: '#2563eb', padding: 0, cursor: 'pointer' }}>
                                {attachment.file_name}
                              </button>
                              {isPreviewableAttachment(attachment) ? (
                                <button type="button" onClick={() => handlePreviewAttachment(attachment)} style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 8, padding: '2px 8px', cursor: 'pointer' }}>
                                  Ver
                                </button>
                              ) : null}
                              <button type="button" onClick={() => handleDeleteAttachment(event.id, attachment)} style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '2px 8px', cursor: 'pointer' }}>
                                Eliminar
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={{ marginTop: 10 }}>
                    <button type="button" onClick={() => handleEdit(event)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer' }}>
                      Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={{ background: '#fff', padding: 20, borderRadius: 16, boxShadow: '0 6px 20px rgba(15, 23, 42, 0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{editingEventId ? 'Editar evento' : 'Agregar evento'}</h2>
            {editingEventId ? (
              <button type="button" onClick={resetForm} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                Cancelar edición
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, marginTop: 8 }}>
            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Fecha del evento
              <input type="date" value={formData.event_date} onChange={(e) => setFormData({ ...formData, event_date: e.target.value })} style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10 }} />
            </label>

            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Tipo de evento
              <select value={formData.event_type} onChange={(e) => setFormData({ ...formData, event_type: e.target.value })} style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10 }}>
                {eventTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Descripción detallada
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10 }} />
            </label>

            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Resultado o nota del médico
              <textarea value={formData.outcome_note} onChange={(e) => setFormData({ ...formData, outcome_note: e.target.value })} rows={3} style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 10 }} />
            </label>

            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Adjuntar documentos
              <input type="file" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} style={{ padding: '8px 0' }} />
            </label>

            <button type="submit" disabled={saving} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: saving ? '#94a3b8' : '#2563eb', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontWeight: 700 }}>
              {saving ? 'Guardando...' : editingEventId ? 'Guardar cambios' : 'Agregar evento'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default PatientDetail;
