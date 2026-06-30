<!-- Sync Impact Report
- Version change: 0.0.0 -> 1.0.0
- Modified principles: none (new constitution)
- Added sections: Core Principles, Additional Constraints, Development Workflow, Governance
- Removed sections: none
- Templates requiring updates: .specify/templates/plan-template.md ⚠ pending; .specify/templates/spec-template.md ⚠ pending; .specify/templates/tasks-template.md ⚠ pending; .specify/templates/commands/*.md ⚠ pending
- Follow-up TODOs: none
-->

# Onco-Salta Digital Constitution

## Core Principles

### I. Security and Privacy by Default
All patient data, clinical notes, and system credentials MUST be protected through strong authentication, least-privilege access, encryption in transit and at rest, audit logging, and secure-by-default design. No feature MAY introduce a storage or transmission path for medical data without explicit security review and approval. This principle is non-negotiable because confidentiality and integrity are essential to patient safety and legal trust.

### II. Clinical-First Interaction
The interface MUST support rapid clinical workflows with keyboard-first interactions, minimal mouse dependency, clear information hierarchy, and predictable defaults. Every user-facing workflow MUST be optimized for speed, reliability, and low cognitive load under real-world clinical conditions. This principle exists because clinicians need dependable tools that reduce friction during care delivery.

### III. Modular and Scalable Architecture
The system MUST be built as a modular platform with clear component boundaries, stable contracts, and extensibility for new features, integrations, and growth. Shared concerns such as authentication, data access, telemetry, and configuration MUST be centralized rather than duplicated. This principle ensures the product can evolve safely as clinical and operational requirements change.

### IV. Clean Code and Automated Verification
Production code MUST be readable, maintainable, and covered by automated tests before release. Changes MUST preserve existing behavior unless the change is intentionally versioned and documented. This principle is required because reliable healthcare software depends on repeatable verification and safe evolution.

### V. Privacy Standards Compliance
The product MUST be designed and operated in alignment with applicable medical privacy standards and legal obligations, including data minimization, access controls, retention controls, auditability, and documented safeguards. Any exception or waiver MUST be explicitly reviewed, approved, and tracked. This principle ensures compliance is treated as a core product requirement rather than a post-development task.

## Additional Constraints

All development MUST avoid exposing sensitive data in logs, traces, or error messages. Secrets MUST be stored in approved secret-management mechanisms rather than in source code or local configuration files. New integrations with external services MUST be reviewed for data handling, retention, and access implications before implementation.

## Development Workflow

Every change affecting patient data, clinical workflows, security, or privacy MUST include appropriate tests, documentation, and review evidence before release. Features that alter core clinical behavior MUST be validated through realistic workflow review and regression testing. Release readiness MUST include confirmation that the implementation remains consistent with this constitution.

## Governance

This constitution supersedes ad hoc practices when there is a conflict. Amendments MUST be documented, reviewed for impact on security, privacy, usability, and architecture, and approved before they take effect. Versioning follows semantic versioning: MAJOR for backward-incompatible principle changes, MINOR for new principles or materially expanded guidance, and PATCH for clarifications or non-semantic refinements. Compliance reviews MUST verify that implementation, tests, and release evidence align with these principles before production deployment.

**Version**: 1.0.0 | **Ratified**: 2026-06-30 | **Last Amended**: 2026-06-30
