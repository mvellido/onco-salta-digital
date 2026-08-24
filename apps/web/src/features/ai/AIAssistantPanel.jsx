export default function AIAssistantPanel({
  patients,
  iaPatientId,
  setIaPatientId,
  iaQuestion,
  setIaQuestion,
  iaAnswer,
  iaError,
  iaLoading,
  onAskRecommendations,
  onAskChat,
  documentReference,
  setDocumentReference,
  documentRawText,
  setDocumentRawText,
  ingestLoading,
  ingestResult,
  onIngestDocument,
}) {
  return (
    <section className="section-card">
      <h2>IA</h2>
      <p style={{ color: 'var(--text-muted)' }}>Usá la IA para ingesta documental, recomendaciones terapéuticas y consulta conversacional.</p>

      <form onSubmit={onAskRecommendations} style={{ display: 'grid', gap: 16, marginTop: 18 }}>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <label>
            Paciente
            <select value={iaPatientId} onChange={(e) => setIaPatientId(e.target.value)}>
              <option value="">Selecciona un paciente</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </label>

          <label>
            Referencia de documento
            <input
              type="text"
              placeholder="Ej. studies/biopsia_2026_08.pdf"
              value={documentReference}
              onChange={(e) => setDocumentReference(e.target.value)}
            />
          </label>
        </div>

        <label>
          Texto OCR o resumen del documento
          <textarea
            rows="4"
            placeholder="Pegá aquí texto clínico para ingesta IA"
            value={documentRawText}
            onChange={(e) => setDocumentRawText(e.target.value)}
          />
        </label>

        <button
          type="button"
          className="secondary"
          onClick={onIngestDocument}
          disabled={ingestLoading || !iaPatientId || (!documentReference.trim() && !documentRawText.trim())}
        >
          {ingestLoading ? 'Procesando documento…' : 'Procesar documento (ingest)'}
        </button>

        {ingestResult ? (
          <div role="status" aria-live="polite" style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0c4a6e' }}>
            <strong>Resultado de ingesta</strong>
            <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{ingestResult}</p>
          </div>
        ) : null}

        <label>
          Consulta clínica
          <textarea
            rows="4"
            placeholder="Ej. ¿Cuál es el siguiente paso terapéutico para este caso?"
            value={iaQuestion}
            onChange={(e) => setIaQuestion(e.target.value)}
          />
        </label>

        {iaError ? (
          <div role="alert" aria-live="assertive" style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid #fca5a5', background: '#fef2f2', color: '#b91c1c' }}>
            {iaError}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="submit" className="primary" disabled={iaLoading || !iaPatientId || !iaQuestion.trim()}>
            {iaLoading ? 'Consultando…' : 'Recomendaciones IA'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={onAskChat}
            disabled={iaLoading || !iaPatientId || !iaQuestion.trim()}
          >
            {iaLoading ? 'Consultando…' : 'Chat IA'}
          </button>
        </div>

        {iaAnswer ? (
          <div role="status" aria-live="polite" style={{ marginTop: 20, padding: '18px', borderRadius: 18, background: '#f8fafc', border: '1px solid rgba(37, 99, 235, 0.14)', color: '#0f172a' }}>
            <strong>Respuesta de IA</strong>
            <p style={{ margin: '10px 0 0', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{iaAnswer}</p>
          </div>
        ) : null}
      </form>
    </section>
  );
}
