# Data Model: Onco-Salta Digital

## Core Entities

### Patient
- **id**: UUID
- **full_name**: string
- **document_number**: string
- **date_of_birth**: date
- **sex**: enum
- **contact_info**: structured object
- **status**: enum
- **created_at**, **updated_at**: timestamps

**Relationships**:
- One patient has many treatments, tumors, documents, appointments, and billing records.

### Treatment
- **id**: UUID
- **patient_id**: UUID
- **treatment_type**: string
- **start_date**, **end_date**: date
- **status**: enum
- **notes**: text

### Tumor
- **id**: UUID
- **patient_id**: UUID
- **tumor_location**: string
- **stage**: string
- **molecular_markers**: array or JSON
- **diagnosis_date**: date

### ClinicalDocument
- **id**: UUID
- **patient_id**: UUID
- **document_type**: enum
- **storage_path**: string
- **ocr_text**: text
- **extracted_metadata**: JSON
- **uploaded_at**: timestamp

### AIInteraction
- **id**: UUID
- **patient_id**: UUID
- **request_type**: enum
- **prompt**: text
- **response**: text
- **model_used**: string
- **created_at**: timestamp

### Invoice / AccountEntry
- **id**: UUID
- **patient_id**: UUID
- **invoice_number**: string
- **amount**: decimal
- **currency**: string
- **status**: enum
- **issued_at**, **paid_at**: timestamps

### Appointment
- **id**: UUID
- **patient_id**: UUID
- **assigned_to**: UUID
- **start_time**, **end_time**: timestamp
- **status**: enum
- **notes**: text

### User / Role
- **id**: UUID
- **email**: string
- **role**: enum
- **permissions**: array
- **two_factor_enabled**: boolean

### AuditLog
- **id**: UUID
- **actor_id**: UUID
- **resource_type**: string
- **resource_id**: UUID
- **action**: string
- **details**: JSON
- **created_at**: timestamp

## Validation Rules
- Patient identifiers and contact details must be present before activation.
- Tumor records must include stage and location.
- Document uploads must be associated with a patient and stored through controlled access.
- Billing records must preserve immutable financial history.
- Sensitive actions must generate audit entries.
