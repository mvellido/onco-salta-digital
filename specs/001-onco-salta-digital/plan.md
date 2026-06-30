# Implementation Plan: Onco-Salta Digital

**Branch**: `001-onco-salta-digital` | **Date**: 2026-06-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-onco-salta-digital/spec.md`

## Summary

Build a secure, modular oncology platform that centralizes patient management, AI-assisted clinical support, financial workflows, and secretariat operations. The implementation will use a Next.js frontend, a TypeScript backend, Supabase for storage and authentication, and Gemini for OCR and RAG-based assistance.

## Technical Context

**Language/Version**: TypeScript, Node.js 20 LTS, React 18, Next.js 14

**Primary Dependencies**: Next.js, React, shadcn/ui, Tailwind CSS, Fastify, Supabase JS, Gemini API SDK, Zod, Vitest, Playwright

**Storage**: Supabase PostgreSQL, Supabase Storage, object storage for clinical documents

**Testing**: Vitest for unit/integration tests, Supertest for API tests, Playwright for end-to-end flows

**Target Platform**: Web application for clinical staff, finance, and secretariat

**Project Type**: Web application with separate frontend and backend services

**Performance Goals**: Patient record views and appointment workflows should respond in under 2 seconds p95; initial AI document analysis should return a usable draft in under 5 seconds for typical files

**Constraints**: Strict medical-data privacy, mandatory 2FA, audit logging, role-based access, keyboard-first interactions, and compliance with data minimization requirements

**Scale/Scope**: Multi-role oncology center with patient records, AI-assisted workflows, billing reconciliation, scheduling, and role-based administration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Security and Privacy by Default**: PASS — the plan uses Supabase Auth with mandatory 2FA, Row Level Security, encrypted storage paths, and audit logging for sensitive actions.
- **Clinical-First Interaction**: PASS — the plan prioritizes keyboard-friendly, low-friction workflows for clinicians and includes clear clinical views for patient progression.
- **Modular and Scalable Architecture**: PASS — the work is organized by domain modules for patients, AI, billing, and secretariat with shared infrastructure services.
- **Clean Code and Automated Verification**: PASS — the plan requires automated tests for backend services, UI interactions, and regression scenarios before release.
- **Privacy Standards Compliance**: PASS — the plan includes data minimization, access control, retention awareness, and auditability as first-class concerns.

## Project Structure

### Documentation (this feature)

```text
specs/001-onco-salta-digital/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── web/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   └── lib/
│   └── tests/
└── api/
    ├── src/
    │   ├── modules/
    │   │   ├── patients/
    │   │   ├── ai/
    │   │   ├── billing/
    │   │   ├── secretary/
    │   │   └── shared/
    │   └── infra/
    └── tests/

db/
└── supabase/
    ├── migrations/
    └── seed/
```

**Structure Decision**: A monorepo with a dedicated web app and API service, backed by Supabase for database, auth, storage, and RLS enforcement.

## Complexity Tracking

No constitutional violations were identified; no complexity exceptions are required.
