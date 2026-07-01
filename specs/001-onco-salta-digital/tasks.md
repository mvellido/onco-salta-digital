# Tasks: Onco-Salta Digital

**Input**: Design documents from `/specs/001-onco-salta-digital/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the monorepo structure and shared toolchain for web, API, and database work.

- [ ] T001 Create repository structure under apps/web/, apps/api/, and db/supabase/
- [ ] T002 Initialize the Next.js frontend app with Tailwind, shadcn/ui, and TypeScript in apps/web/
- [ ] T003 Initialize the Fastify/TypeScript backend app in apps/api/
- [ ] T004 [P] Configure linting, formatting, and shared environment management in apps/web/ and apps/api/
- [ ] T005 [P] Configure Supabase client setup, storage buckets, and environment variables for web and API

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared infrastructure that all user stories depend on.

- [ ] T006 Create Supabase migrations for patients, treatments, tumors, documents, appointments, billing, roles, and audit logs in db/supabase/migrations/
- [ ] T007 Implement authentication, session handling, and mandatory 2FA enforcement in apps/api/src/infra/ and apps/web/src/lib/
- [ ] T008 [P] Implement role-based access control and RLS-aware repository helpers in apps/api/src/modules/shared/
- [ ] T009 [P] Implement audit logging and sensitive-action middleware in apps/api/src/modules/shared/
- [ ] T010 [P] Implement document storage integration with Supabase Storage in apps/api/src/modules/shared/
- [ ] T011 Create shared API validation schemas and error handling utilities in apps/api/src/infra/

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Gestión integral del paciente (Priority: P1) 🎯 MVP

**Goal**: Deliver a complete patient record experience with clinical timeline, treatments, tumor details, and attachments.

**Independent Test**: A clinician can create a patient record, add treatment and tumor details, and review the case timeline without relying on other modules.

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create patient and clinical data models and validation schemas in apps/api/src/modules/patients/
- [ ] T013 [P] [US1] Create patient profile, treatment, tumor, and attachment UI components in apps/web/src/features/patients/
- [ ] T014 [US1] Implement patient CRUD endpoints and timeline aggregation in apps/api/src/modules/patients/
- [ ] T015 [US1] Implement patient repository and Supabase data access integration in apps/api/src/modules/patients/
- [X] T016 [US1] Implement patient record view, document attachment flow, and case timeline visualization in apps/web/src/app/ and apps/web/src/features/patients/
- [ ] T017 [US1] Add keyboard-first clinical navigation and shortcut support in apps/web/src/components/

**Checkpoint**: User Story 1 should be fully functional and independently testable.

---

## Phase 4: User Story 2 - Asistencia clínica impulsada por IA (Priority: P1)

**Goal**: Provide OCR ingestion, RAG-based recommendations, and a conversational AI assistant for case review.

**Independent Test**: A clinician can upload a clinical document, obtain extracted content, and request AI recommendations for the patient case.

### Implementation for User Story 2

- [ ] T018 [P] [US2] Create AI ingestion and RAG service interfaces in apps/api/src/modules/ai/
- [ ] T019 [US2] Implement Gemini OCR ingestion and document parsing workflow in apps/api/src/modules/ai/
- [ ] T020 [US2] Implement therapeutic recommendation and chat endpoints with patient context assembly in apps/api/src/modules/ai/
- [ ] T021 [P] [US2] Create AI assistant UI, document upload flow, and chat panel in apps/web/src/features/ai/
- [ ] T022 [US2] Integrate AI workflows with patient records and audit logging in apps/api/src/modules/ai/ and apps/api/src/modules/shared/

**Checkpoint**: User Stories 1 and 2 should both work independently.

---

## Phase 5: User Story 3 - Gestión financiera y conciliación (Priority: P2)

**Goal**: Support automated billing reconciliation and financial reporting for the oncology center.

**Independent Test**: A finance user can reconcile billing records and review income and account-state reports without depending on clinical modules.

### Implementation for User Story 3

- [ ] T023 [P] [US3] Create billing domain models and reconciliation schemas in apps/api/src/modules/billing/
- [ ] T024 [US3] Implement reconciliation engine and report aggregation in apps/api/src/modules/billing/
- [ ] T025 [P] [US3] Create finance dashboard and account-state UI in apps/web/src/features/billing/
- [ ] T026 [US3] Wire billing APIs, report generation, and state-of-account views in apps/web/src/features/billing/ and apps/api/src/modules/billing/

**Checkpoint**: User Story 3 should be independently functional.

---

## Phase 6: User Story 4 - Secretaría y coordinación de citas (Priority: P2)

**Goal**: Deliver scheduling, notifications, and role-permission management for the administrative team.

**Independent Test**: A secretary can create and update appointments, notify participants, and manage role-based permissions without impacting clinical workflows.

### Implementation for User Story 4

- [ ] T027 [P] [US4] Create appointment and role-permission models in apps/api/src/modules/secretary/
- [ ] T028 [US4] Implement agenda and appointment management endpoints in apps/api/src/modules/secretary/
- [ ] T029 [US4] Implement notification dispatch and permission administration in apps/api/src/modules/secretary/
- [ ] T030 [P] [US4] Create secretary UI for agenda, scheduling, notifications, and user management in apps/web/src/features/secretary/
- [ ] T031 [US4] Add scheduling conflict detection and audit logging in apps/api/src/modules/secretary/

**Checkpoint**: All user stories should now be independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improve quality, security, and deployment readiness across all modules.

- [ ] T032 [P] Update deployment configuration for Vercel and Render in apps/web/, apps/api/, and db/supabase/
- [ ] T033 [P] Harden security settings, secrets handling, and RLS policies in apps/api/src/infra/ and db/supabase/migrations/
- [ ] T034 [P] Review accessibility, keyboard navigation, and clinical usability across the web app in apps/web/src/
- [ ] T035 Run quickstart validation and document any follow-up fixes in specs/001-onco-salta-digital/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all stories.
- **User Stories (Phases 3-6)**: All depend on Foundational completion.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (US1)**: Can start after Foundational; no dependency on other stories.
- **User Story 2 (US2)**: Can start after Foundational and may integrate with US1 data.
- **User Story 3 (US3)**: Can start after Foundational and may integrate with patient and billing context.
- **User Story 4 (US4)**: Can start after Foundational and may integrate with patient and role data.

### Parallel Opportunities

- Setup tasks T004 and T005 can run in parallel.
- Foundational tasks T008, T009, T010, and T011 can run in parallel.
- User Story 1 tasks T012, T013 can be started in parallel.
- User Story 2 tasks T018 and T021 can be started in parallel.
- User Story 3 tasks T023 and T025 can be started in parallel.
- User Story 4 tasks T027 and T030 can be started in parallel.

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate the MVP independently before adding the remaining stories.

### Incremental Delivery

1. Deliver patient management first.
2. Add AI support as a second increment.
3. Add finance and secretariat capabilities as separate, independently testable increments.
