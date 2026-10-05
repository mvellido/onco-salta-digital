import { useEffect, useState } from 'react';
import { apiJson } from '../lib/api';
import AIAssistantPanel from '../features/ai/AIAssistantPanel';

export default function AIPage() {
  const [patients, setPatients] = useState([]);
  const [iaPatientId, setIaPatientId] = useState('');
  const [iaQuestion, setIaQuestion] = useState('');
  const [iaAnswer, setIaAnswer] = useState('');
  const [iaError, setIaError] = useState('');
  const [iaLoading, setIaLoading] = useState(false);
  const [documentReference, setDocumentReference] = useState('');
  const [documentRawText, setDocumentRawText] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState('');

  useEffect(() => {
    apiJson('/patients').then(setPatients).catch((error) => setIaError(error.message));
  }, []);

  const ask = async (path, body, pick) => {
    setIaError('');
    setIaAnswer('');
    if (!iaPatientId) return setIaError('Elegí un paciente para consultar la IA.');
    if (!iaQuestion.trim()) return setIaError('Escribí una pregunta para la IA.');

    setIaLoading(true);
    try {
      const result = await apiJson(path, { method: 'POST', body: JSON.stringify(body) });
      setIaAnswer(pick(result) || 'La IA no devolvió respuesta.');
    } catch (error) {
      setIaError(error.message);
    } finally {
      setIaLoading(false);
    }
  };

  const handleIngest = async () => {
    setIaError('');
    setIngestResult('');
    if (!iaPatientId) return setIaError('Elegí un paciente para la ingesta documental.');
    if (!documentReference.trim() && !documentRawText.trim()) {
      return setIaError('Ingresá una referencia de documento o el texto a procesar.');
    }

    setIngestLoading(true);
    try {
      const result = await apiJson('/ai/ingest', {
        method: 'POST',
        body: JSON.stringify({
          patientId: iaPatientId,
          documentReference: documentReference.trim() || undefined,
          rawText: documentRawText.trim() || undefined,
        }),
      });
      setIngestResult(result.parsedSummary || 'Documento procesado sin resumen.');
    } catch (error) {
      setIaError(error.message);
    } finally {
      setIngestLoading(false);
    }
  };

  return (
    <AIAssistantPanel
      patients={patients}
      iaPatientId={iaPatientId}
      setIaPatientId={setIaPatientId}
      iaQuestion={iaQuestion}
      setIaQuestion={setIaQuestion}
      iaAnswer={iaAnswer}
      iaError={iaError}
      iaLoading={iaLoading}
      onAskRecommendations={(event) => {
        event.preventDefault();
        ask('/ai/recommendations', { patientId: iaPatientId, clinicalQuestion: iaQuestion }, (r) => r.recommendations);
      }}
      onAskChat={() => ask('/ai/chat', { patientId: iaPatientId, message: iaQuestion, history: [] }, (r) => r.answer)}
      documentReference={documentReference}
      setDocumentReference={setDocumentReference}
      documentRawText={documentRawText}
      setDocumentRawText={setDocumentRawText}
      ingestLoading={ingestLoading}
      ingestResult={ingestResult}
      onIngestDocument={handleIngest}
    />
  );
}
