# Research: Onco-Salta Digital

## Decision: Frontend stack
- **Decision**: Use Next.js with the App Router and React for the clinical interface.
- **Rationale**: It provides a strong developer experience, server/client separation, and straightforward deployment on Vercel.
- **Alternatives considered**: A pure React SPA and a traditional server-rendered MVC app. The SPA approach was rejected because the App Router simplifies route-based permissions and future dashboard expansion.

## Decision: Backend runtime
- **Decision**: Use Fastify with TypeScript for the API layer.
- **Rationale**: Fastify offers strong schema validation, good performance, and a clean plugin model suitable for modular domain services.
- **Alternatives considered**: Express. Express was considered acceptable but less structured for validation and plugin-based extensibility.

## Decision: Data and access control
- **Decision**: Use Supabase PostgreSQL with Row Level Security and Supabase Auth with mandatory 2FA.
- **Rationale**: This aligns with the requested stack and supports secure, policy-driven access without custom auth infrastructure.
- **Alternatives considered**: A custom auth service with a self-hosted Postgres database. This was rejected because it increases operational overhead and security surface area.

## Decision: AI services
- **Decision**: Use the Gemini API for OCR and RAG-assisted recommendations.
- **Rationale**: It provides a practical path for document ingestion and contextual question answering without building a custom model pipeline first.
- **Alternatives considered**: Open-source OCR and RAG stacks. These were rejected for v1 because they require higher engineering effort and maintenance.

## Decision: Storage and audit
- **Decision**: Store clinical documents in Supabase Storage and record sensitive actions in an append-only audit log.
- **Rationale**: This keeps files close to the application data and satisfies the requirement for traceability and access review.
- **Alternatives considered**: Separate object storage with a bespoke audit service. The combined approach was preferred for simplicity and consistency.
