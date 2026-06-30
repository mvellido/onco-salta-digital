# Feature Specification: Onco-Salta Digital

**Feature Branch**: `001-onco-salta-digital`

**Created**: 2026-06-30

**Status**: Draft

**Input**: User description: "El sistema 'Onco-Salta Digital' debe permitir gestión integral de pacientes, asistencia clínica basada en IA, finanzas y secretaría."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gestión integral del paciente (Priority: P1)
Un oncólogo o un miembro del equipo clínico puede acceder a una ficha única del paciente con información general, historial de tratamientos, detalles del tumor, imágenes adjuntas y una vista cronológica del caso.

**Why this priority**: La información clínica centralizada es la base del sistema y permite que el equipo trabaje sobre una sola fuente de verdad para cada paciente.

**Independent Test**: Un usuario puede crear un paciente, completar su perfil clínico y revisar la evolución del caso desde una vista consolidada.

**Acceptance Scenarios**:

1. **Given** un paciente nuevo sin historial previo, **When** el usuario registra sus datos generales y detalles del tumor, **Then** el sistema crea una ficha única accesible para el equipo autorizado.
2. **Given** un paciente con tratamientos previos, **When** el usuario agrega un nuevo tratamiento y una imagen asociada, **Then** la ficha muestra la nueva información en el resumen cronológico y conserva la imagen adjunta.

---

### User Story 2 - Asistencia clínica impulsada por IA (Priority: P1)
Un profesional clínico puede cargar historias clínicas en papel o PDF y recibir apoyo para la interpretación del caso, recomendaciones terapéuticas y un espacio de consulta conversacional.

**Why this priority**: Esta funcionalidad aporta valor clínico inmediato al reducir la carga de lectura manual y apoyar decisiones con información contextualizada.

**Independent Test**: Un usuario puede cargar un documento clínico, obtener contenido procesado y solicitar apoyo para el caso desde la interfaz.

**Acceptance Scenarios**:

1. **Given** un documento clínico escaneado o en PDF, **When** el usuario lo carga en el sistema, **Then** el contenido queda asociado al paciente y disponible para revisión.
2. **Given** un caso clínico con información relevante cargada, **When** el usuario solicita recomendaciones o consulta al asistente, **Then** el sistema devuelve una respuesta contextualizada y permite continuar la conversación.

---

### User Story 3 - Gestión financiera y conciliación (Priority: P2)
El equipo de finanzas puede revisar facturación, conciliar movimientos y consultar reportes de ingresos y estados de cuenta.

**Why this priority**: La visibilidad financiera mejora la operatividad del centro y reduce errores en la gestión administrativa.

**Independent Test**: Un usuario financiero puede conciliar facturación y generar reportes sin intervención manual extensa.

**Acceptance Scenarios**:

1. **Given** múltiples operaciones de facturación, **When** el usuario inicia la conciliación, **Then** el sistema agrupa y compara los registros para identificar diferencias o coincidencias.
2. **Given** un período de actividad financiero, **When** el usuario solicita reportes, **Then** el sistema presenta ingresos y estados de cuenta de forma clara y actualizada.

---

### User Story 4 - Secretaría y coordinación de citas (Priority: P2)
La secretaría puede gestionar agenda, turnos, notificaciones y permisos de acceso para los distintos perfiles del equipo.

**Why this priority**: Una coordinación organizada mejora la experiencia de pacientes y reduce la fricción operativa diaria.

**Independent Test**: Un usuario de secretaría puede crear turnos, enviar notificaciones y ajustar permisos sin afectar el resto del sistema.

**Acceptance Scenarios**:

1. **Given** una agenda de citas, **When** el usuario reserva un turno, **Then** el sistema lo registra y deja constancia de la disponibilidad correspondiente.
2. **Given** un turno asignado, **When** el sistema genera una notificación, **Then** el usuario relevante recibe el aviso en el canal previsto.

---

### Edge Cases

- Qué ocurre cuando un documento clínico no es legible o está incompleto.
- Cómo responde el sistema cuando no existe información suficiente para generar una recomendación.
- Qué sucede si un usuario intenta acceder a datos fuera de su alcance funcional.
- Cómo maneja el sistema conflictos de agenda o turnos duplicados.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir registrar y consultar una ficha única de paciente con datos generales, historial de tratamientos, detalles de tumores, imágenes adjuntas y una representación cronológica del caso.
- **FR-002**: El sistema MUST permitir actualizar la información clínica del paciente manteniendo una historia completa y auditable del registro.
- **FR-003**: El sistema MUST soportar la asociación de documentos e imágenes a la ficha del paciente para su revisión clínica.
- **FR-004**: El sistema MUST procesar historias clínicas en papel o PDF mediante reconocimiento de texto para convertirlas en información utilizable dentro del caso del paciente.
- **FR-005**: El sistema MUST ofrecer apoyo para recomendaciones terapéuticas a partir del perfil del paciente y de referencias clínicas relevantes.
- **FR-006**: El sistema MUST proporcionar un chat o espacio de consulta para discutir el caso con apoyo del asistente.
- **FR-007**: El sistema MUST permitir la conciliación automática de facturación y la generación de reportes de ingresos y estados de cuenta.
- **FR-008**: El sistema MUST soportar una agenda interactiva para la administración de turnos y la notificación a usuarios involucrados.
- **FR-009**: El sistema MUST implementar administración de roles y permisos para controlar acceso según la responsabilidad del usuario.
- **FR-010**: El sistema MUST registrar operaciones sensibles y cambios críticos para asegurar trazabilidad y cumplimiento de buenas prácticas de privacidad.

### Key Entities *(include if feature involves data)*

- **Paciente**: Representa a la persona atendida, con datos generales, historial clínico y vínculos a tratamientos, tumores, documentos e turnos.
- **Tratamiento**: Representa cada intervención o terapia registrada para un paciente, con fecha, tipo y estado.
- **Tumor**: Representa el diagnóstico oncológico del paciente, incluyendo estadio, ubicación y marcadores moleculares.
- **Documento o Imagen**: Representa evidencias clínicas adjuntas a la ficha del paciente, como informes, estudios o fotografías.
- **Recomendación o Consulta**: Representa la asistencia generada por el módulo de IA para un caso específico.
- **Factura o Estado de Cuenta**: Representa el registro financiero asociado al paciente o a la institución.
- **Turno**: Representa una cita o evento agendado y su estado correspondiente.
- **Usuario o Rol**: Representa a quien accede al sistema y los permisos que tiene asignados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 95% de los registros de pacientes nuevos pueden crearse y consultarse en menos de 3 minutos por un usuario autorizado.
- **SC-002**: Al menos el 90% de los documentos clínicos cargados quedan disponibles para revisión en menos de 10 minutos desde su carga.
- **SC-003**: El 95% de los turnos y reportes financieros generados se registran sin errores visibles en el primer intento.
- **SC-004**: Al menos el 90% de los usuarios autorizados pueden completar las tareas principales del sistema sin ayuda adicional durante la primera semana de uso.

## Assumptions

- Los usuarios operarán el sistema con acceso autenticado y en un entorno que respeta las obligaciones de privacidad aplicables.
- La primera entrega prioriza los flujos clínicos, administrativos y financieros esenciales sobre integraciones externas complejas.
- Los documentos clínicos estarán disponibles en formatos de imagen o PDF de calidad suficiente para su procesamiento.
- La administración de permisos será necesaria desde la primera versión para separar accesos clínicos, financieros y administrativos.
