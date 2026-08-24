# Quickstart: Onco-Salta Digital

## Prerequisites
- Node.js 20+
- A Supabase project with Auth, PostgreSQL, and Storage enabled
- A Gemini API key
- Access to a deployment target for Vercel and Render

## Setup
1. Create the frontend and backend projects in a monorepo structure.
2. Configure Supabase environment variables for URL, anon key, service role, and storage bucket names.
3. Configure Gemini credentials for OCR and RAG services.
4. Apply Supabase migrations for patients, documents, appointments, billing, and audit logging.

## Run locally
1. Start the API service.
2. Start the Next.js frontend.
3. Sign in with a test account that has mandatory 2FA enabled.
4. Create a sample patient and attach a document.
5. Submit an AI-assisted request and verify the returned recommendations.
6. Create a sample appointment and validate notification flow.

## Validation scenarios
- Create a patient record and confirm the timeline view updates.
- Upload a PDF and verify that OCR text is stored and accessible.
- Request AI recommendations and confirm a contextual response appears.
- Reconcile a billing batch and review the resulting report.
- Verify that role-based access blocks unauthorized users.

## Validation run log (2026-08-24)
- Frontend automated checks passed with Vitest: 3 files, 5 tests.
- AI UI flow implemented and connected to `/ai/ingest`, `/ai/recommendations`, and `/ai/chat`.
- Billing report, billing record creation, and reconciliation endpoints wired end-to-end in API and web UI.
- Secretariat module now includes appointment conflict detection plus notification and role-permission endpoints.

## Follow-up fixes and pending items
- Mandatory 2FA enforcement remains pending by product decision and should be enabled before production release.
- Full E2E execution against a live Supabase project is still required to validate RLS policies and storage workflows.
- React Router v7 future-flag warnings appear in tests; no functional regression was observed, but migration should be scheduled.
