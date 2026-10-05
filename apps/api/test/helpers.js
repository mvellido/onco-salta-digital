import { buildApp } from '../src/app.js';
import { createFakeSupabase } from './fakeSupabase.js';

const DEFAULT_PERMISSIONS = {
  admin: ['patients:read', 'patients:read_basic', 'patients:write', 'patients:archive', 'users:manage', 'guidelines:manage', 'ai:use', 'scope:all_patients'],
  doctor: ['patients:read', 'patients:read_basic', 'patients:write', 'patients:archive', 'appointments:read', 'appointments:write', 'ai:use'],
  secretary: ['patients:read_basic', 'appointments:read', 'appointments:write', 'scope:all_patients'],
};

export function setup({ gemini = null, files = {}, rpc = {}, extraTables = {} } = {}) {
  const supabase = createFakeSupabase({
    users: {
      'tok-admin': { id: 'u-admin', email: 'admin@onco.test' },
      'tok-doc': { id: 'u-doc', email: 'doc@onco.test' },
      'tok-doc2': { id: 'u-doc2', email: 'doc2@onco.test' },
      'tok-sec': { id: 'u-sec', email: 'sec@onco.test' },
      'tok-nobody': { id: 'u-nobody', email: 'nobody@onco.test' },
    },
    tables: {
      profiles: [
        { id: 'u-admin', email: 'admin@onco.test', role: 'admin', active: true },
        { id: 'u-doc', email: 'doc@onco.test', role: 'doctor', active: true },
        { id: 'u-doc2', email: 'doc2@onco.test', role: 'doctor', active: true },
        { id: 'u-sec', email: 'sec@onco.test', role: 'secretary', active: true },
        { id: 'u-nobody', email: 'nobody@onco.test', role: null, active: false },
      ],
      role_permissions: Object.entries(DEFAULT_PERMISSIONS).flatMap(([role, perms]) =>
        perms.map((permission) => ({ role, permission }))
      ),
      patients: [
        { id: 'p1', full_name: 'Paciente Uno', dni: '1', diagnosis_summary: 'Adenocarcinoma', status: 'active', assigned_doctor_id: 'u-doc', archived_at: null },
        { id: 'p2', full_name: 'Paciente Dos', dni: '2', diagnosis_summary: 'Linfoma', status: 'active', assigned_doctor_id: 'u-doc2', archived_at: null },
      ],
      audit_logs: [],
      ...extraTables,
    },
    files,
    rpc,
  });

  const app = buildApp({ supabase, gemini, logger: false });
  const call = (token, method, url, payload) =>
    app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });

  return { app, supabase, call };
}
