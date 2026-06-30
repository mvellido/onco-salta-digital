# API Contracts: Onco-Salta Digital

## Authentication

### POST /auth/sign-in
- Accepts email and password.
- Returns access token and profile metadata.
- Requires 2FA challenge when enabled.

### POST /auth/verify-2fa
- Accepts the temporary session and TOTP code.
- Returns an authenticated session for authorized users.

## Patients

### GET /patients/:id
- Returns the patient profile, tumor details, treatments, and timeline summary.
- Requires role-based access to patient records.

### POST /patients
- Creates a new patient record.
- Accepts general profile, tumor data, and initial treatment metadata.

### PATCH /patients/:id
- Updates patient information and linked clinical data.
- Triggers audit logging for sensitive changes.

## Clinical Documents

### POST /patients/:id/documents
- Uploads a clinical document or image to Supabase Storage.
- Stores OCR metadata and document type information.

### GET /patients/:id/documents
- Lists documents associated with the patient.

## AI Assistant

### POST /ai/ingest
- Accepts a document reference and triggers OCR and indexing.
- Returns extracted content and confidence metadata.

### POST /ai/recommendations
- Receives patient context and returns evidence-based therapeutic suggestions.
- Uses RAG against NCCN and ESMO references when available.

### POST /ai/chat
- Accepts a user prompt and patient context.
- Returns a conversational response grounded in the case context.

## Billing

### GET /billing/reports
- Returns financial summaries and state-of-account information.

### POST /billing/conciliate
- Processes billing records and returns reconciliation results.

## Secretariat

### GET /appointments
- Lists appointments for the current scope.

### POST /appointments
- Creates a new appointment and checks for conflicts.

### PATCH /appointments/:id
- Updates appointment status or assignment.

## Audit

### GET /audit/logs
- Returns recent audit events for authorized users.
- Supports filtering by actor, resource, or action type.
