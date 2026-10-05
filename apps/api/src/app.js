import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { createAuthGuard } from './infra/auth.js';
import { createAuditRecorder } from './modules/shared/audit.js';
import patientsRoutes from './routes/patients.js';
import aiRoutes from './routes/ai.js';
import billingRoutes from './routes/billing.js';
import appointmentsRoutes from './routes/appointments.js';
import adminRoutes from './routes/admin.js';
import clinicalRoutes from './routes/clinical.js';
import guidelinesRoutes from './routes/guidelines.js';
import coverageRoutes from './routes/coverage.js';

// Arma la API sin abrir el puerto, para poder probarla con app.inject().
export function buildApp({
  supabase,
  allowedOrigins = [],
  storageBucket = 'medical-history',
  gemini = null,
  appUrl = '',
  logger = true,
}) {
  const app = Fastify({ logger });

  app.register(cors, {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin no permitido por CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.register(helmet, { global: true, contentSecurityPolicy: false });

  app.get('/health', async () => ({ status: 'ok' }));

  const deps = {
    supabase,
    authenticate: createAuthGuard(supabase),
    audit: createAuditRecorder(supabase, app.log),
    storageBucket,
    gemini,
    appUrl,
  };

  app.register(patientsRoutes, deps);
  app.register(aiRoutes, deps);
  app.register(billingRoutes, deps);
  app.register(appointmentsRoutes, deps);
  app.register(adminRoutes, deps);
  app.register(clinicalRoutes, deps);
  app.register(guidelinesRoutes, deps);
  app.register(coverageRoutes, deps);

  return app;
}
