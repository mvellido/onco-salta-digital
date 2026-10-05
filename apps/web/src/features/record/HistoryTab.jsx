import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '../../app/supabaseClient';

const STORAGE_BUCKET = 'medical-history';

function getStorageErrorMessage(error) {
  const message = error?.message || '';
  if (/bucket not found|Bucket not found|bucket.*not.*found/i.test(message)) {
    return `Bucket de almacenamiento '${STORAGE_BUCKET}' no encontrado. Crea el bucket en Supabase Storage o revisa la configuración.`;
  }

  if (/permission denied|forbidden|not authorized|authorization/i.test(message)) {
    return `No tienes permiso para acceder al bucket '${STORAGE_BUCKET}'. Revisa las políticas de Supabase Storage y la configuración de RLS.`;
  }

  return `Error de almacenamiento: ${message || 'Operación de storage fallida.'}`;
}

function getTableNotFoundErrorMessage(error, tableName) {
  const message = error?.message || '';
  if (/could not find the table|table .* does not exist|relation .* does not exist|No se encontró.*tabla|tabla .* no existe/i.test(message)) {
    return `La tabla '${tableName}' no existe en la base de datos de Supabase. Ejecuta el SQL de ${tableName}.sql o crea la tabla en el esquema público.`;
  }

  return null;
}

function isPreviewableImageAttachment(attachment) {
  const contentType = attachment?.content_type || '';
  return contentType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(attachment?.file_name || '');
}

async function getSignedUrlForAttachment(attachment) {
  if (!isPreviewableImageAttachment(attachment)) {
    return null;
  }

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(attachment.storage_path, 3600);
  if (error) {
    return null;
  }

  return data?.signedUrl || null;
}

function getFriendlyErrorMessage(error, fallback, resourceName) {
  if (!error) {
    return fallback;
  }

  const message = error?.message || '';
  const tableMessage = resourceName ? getTableNotFoundErrorMessage(error, resourceName) : null;
  if (tableMessage) {
    return tableMessage;
  }

  const isStorageError = /bucket not found|Bucket not found|bucket.*not.*found|permission denied|forbidden|not authorized|authorization/i.test(message);

  return isStorageError ? getStorageErrorMessage(error) : message || fallback;
}

// Historia clínica del paciente: eventos con adjuntos. Lee y escribe directo en
// Supabase con la sesión del usuario (RLS: treatment_history / event_attachments).
function HistoryTab({ patientId, user, canWrite = true, initialEvents = null, onEventsChange }) {
  const [events, setEvents] = useState(initialEvents || []);
  const [attachmentsByEvent, setAttachmentsByEvent] = useState({});
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  const [loading, setLoading] = useState(!initialEvents);
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

  // Usar ref para evitar múltiples llamadas simultáneas
  const loadingRef = useRef(false);

  const loadAttachmentThumbnails = useCallback(async (attachments) => {
    const urls = {};

    await Promise.all(
      attachments.map(async (attachment) => {
        if (!isPreviewableImageAttachment(attachment)) {
          return;
        }

        const url = await getSignedUrlForAttachment(attachment);
        if (url) {
          urls[attachment.id] = url;
        }
      })
    );

    setThumbnailUrls((current) => ({ ...current, ...urls }));
  }, []);

  const loadPatientAndEvents = useCallback(async () => {
    // Evitar múltiples llamadas simultáneas
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    try {
      const { data: eventData, error: eventsError } = await supabase
        .from('treatment_history')
        .select('*')
        .eq('patient_id', patientId)
        .order('event_date', { ascending: false });

      if (eventsError) {
        const isMissingTable = /relation .*treatment_history|does not exist|not found/i.test(eventsError.message || '');
        setMessage({
          type: 'error',
          text: isMissingTable
            ? 'El historial clínico aún no está creado en Supabase. Ejecuta el SQL de treatment_history.sql en el editor SQL de Supabase.'
            : eventsError.message || 'No se pudo cargar el historial.',
        });
      }

      setEvents(eventData || []);

      const attachments = {};
      if (eventData?.length) {
        const { data: attachmentData, error: attachmentError } = await supabase
          .from('event_attachments')
          .select('*')
          .in('event_id', eventData.map((event) => event.id));

        if (attachmentError) {
          setMessage({
            type: 'error',
            text: getFriendlyErrorMessage(
              attachmentError,
              'No se pudieron cargar los adjuntos.',
              'event_attachments'
            ),
          });
        } else {
          attachmentData?.forEach((attachment) => {
            attachments[attachment.event_id] = [...(attachments[attachment.event_id] || []), attachment];
          });
        }
      }

      setAttachmentsByEvent(attachments);

      const allAttachments = Object.values(attachments).flat();
      if (allAttachments.length) {
        await loadAttachmentThumbnails(allAttachments);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'No se pudo cargar el historial clínico.' });
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [patientId, loadAttachmentThumbnails]);

  useEffect(() => {
    if (initialEvents) {
      setLoading(false);
      return;
    }

    if (patientId && !loadingRef.current) {
      loadPatientAndEvents();
    }
  }, [patientId, loadPatientAndEvents]);

  useEffect(() => {
    onEventsChange?.(events);
  }, [events, onEventsChange]);

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

  // Debe coincidir con las políticas de storage.objects: patients/<patient_id>/...
  const buildAttachmentPath = (eventId, fileName) => {
    const safeName = fileName.replace(/[^\w.-]+/g, '-').toLowerCase();
    return `patients/${patientId}/event_${eventId}/${Date.now()}-${safeName}`;
  };

  const uploadAttachments = async (eventId) => {
    if (!selectedFiles.length) {
      return [];
    }

    const uploadedAttachments = [];
    for (const file of selectedFiles) {
      const path = buildAttachmentPath(eventId, file.name);
      const { data: uploadData, error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });

      if (uploadError) {
        throw new Error(getStorageErrorMessage(uploadError));
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
        throw new Error(
          getFriendlyErrorMessage(
            attachmentError,
            'No se pudo guardar el registro del adjunto.',
            'event_attachments'
          )
        );
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

          const imageUploads = uploaded.filter(isPreviewableImageAttachment);
          if (imageUploads.length) {
            await loadAttachmentThumbnails(imageUploads);
          }
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
      setMessage({ type: 'error', text: getFriendlyErrorMessage(error, 'No se pudo guardar el evento.') });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (attachment) => {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(attachment.storage_path, 3600);
    if (error) {
      setMessage({ type: 'error', text: getStorageErrorMessage(error) });
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
      setMessage({ type: 'error', text: getFriendlyErrorMessage(error, 'No se pudo previsualizar el archivo.', 'event_attachments') });
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
      setMessage({ type: 'error', text: getFriendlyErrorMessage(error, 'No se pudo eliminar el adjunto.', 'event_attachments') });
    }
  };

  const isPreviewableAttachment = (attachment) => {
    const contentType = attachment.content_type || '';
    return contentType.startsWith('image/') || contentType === 'application/pdf' || /\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(attachment.file_name || '');
  };

  if (loading) {
    return <div className="patient-detail patient-detail--loading">Cargando historial clínico…</div>;
  }

  return (
    <div className="patient-detail">
      <div className="detail-grid">
        <section className="timeline-card">
          <div className="timeline-toolbar">
            <div>
              <h2 style={{ margin: 0 }}>Historial clínico</h2>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>Eventos y adjuntos del paciente.</p>
            </div>
            <div className="timeline-filters">
              <label>
                Buscar por fecha o tipo
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por fecha o tipo"
                />
              </label>
              <label>
                Filtrar por tipo
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">Todos</option>
                  {eventTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {message.text && message.type ? (
            <div className={`message message--${message.type === 'success' ? 'success' : 'error'}`}>
              {message.text}
            </div>
          ) : null}

          {previewAttachment ? (
            <div className="preview-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <strong>Vista previa</strong>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>{previewAttachment.file_name}</p>
                </div>
                <button type="button" onClick={() => { setPreviewAttachment(null); setPreviewUrl(''); }} className="secondary">
                  Cerrar
                </button>
              </div>
              {previewAttachment.content_type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(previewAttachment.file_name || '') ? (
                <img src={previewUrl} alt={previewAttachment.file_name} className="preview-media" />
              ) : (
                <iframe src={previewUrl} title={previewAttachment.file_name} className="preview-media" />
              )}
            </div>
          ) : null}

          {filteredEvents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Sin eventos registrados.</p>
          ) : (
            <div className="event-list">
              {filteredEvents.map((event) => (
                <div key={event.id} className="event-card">
                  <div className="event-card__header">
                    <strong>{event.event_type}</strong>
                    <span className="event-card__date">{event.event_date}</span>
                  </div>
                  <div className="event-card__meta">
                    <p className="event-note">{event.description}</p>
                    {event.outcome_note ? <p className="event-note"><em>Nota:</em> {event.outcome_note}</p> : null}
                  </div>

                  {(attachmentsByEvent[event.id] || []).length > 0 ? (
                    <div>
                      <strong>Adjuntos</strong>
                      <ul className="attachment-list">
                        {(attachmentsByEvent[event.id] || []).map((attachment) => (
                          <li key={attachment.id} className="attachment-item">
                            {thumbnailUrls[attachment.id] ? (
                              <img src={thumbnailUrls[attachment.id]} alt={attachment.file_name} className="attachment-thumb" />
                            ) : (
                              <div className="attachment-thumb" aria-hidden="true" />
                            )}
                            <div className="attachment-meta">
                              <span className="attachment-name">{attachment.file_name}</span>
                              <span className="attachment-type">{attachment.content_type || 'Archivo'}</span>
                            </div>
                            <div className="attachment-actions">
                              <button type="button" onClick={() => handleDownload(attachment)} className="secondary">
                                Descargar
                              </button>
                              {isPreviewableAttachment(attachment) ? (
                                <button type="button" onClick={() => handlePreviewAttachment(attachment)} className="secondary">
                                  Ver
                                </button>
                              ) : null}
                              {canWrite ? (
                                <button type="button" onClick={() => handleDeleteAttachment(event.id, attachment)} className="ghost">
                                  Eliminar
                                </button>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {canWrite ? (
                    <div className="event-card__actions">
                      <button type="button" onClick={() => handleEdit(event)} className="secondary">
                        Editar
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {canWrite ? (
        <section className="detail-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{editingEventId ? 'Editar evento' : 'Agregar evento'}</h2>
            {editingEventId ? (
              <button type="button" className="secondary" onClick={resetForm}>
                Cancelar edición
              </button>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12, marginTop: 8 }}>
            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Fecha del evento
              <input type="date" value={formData.event_date} onChange={(e) => setFormData({ ...formData, event_date: e.target.value })} />
            </label>

            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Tipo de evento
              <select value={formData.event_type} onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}>
                {eventTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </label>

            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Descripción detallada
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} />
            </label>

            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Resultado o nota del médico
              <textarea value={formData.outcome_note} onChange={(e) => setFormData({ ...formData, outcome_note: e.target.value })} rows={3} />
            </label>

            <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
              Adjuntar documentos
              <input type="file" multiple onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))} style={{ padding: '8px 0' }} />
            </label>

            <button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : editingEventId ? 'Guardar cambios' : 'Agregar evento'}
            </button>
          </form>
        </section>
        ) : null}
      </div>
    </div>
  );
}

export default HistoryTab;
