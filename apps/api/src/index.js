import Fastify from 'fastify';

const fastify = Fastify({ logger: false });

const patients = [];

fastify.get('/health', async () => ({ status: 'ok' }));

fastify.get('/patients', async () => patients);

fastify.post('/patients', async (request, reply) => {
  const patient = {
    id: String(patients.length + 1),
    ...request.body,
    createdAt: new Date().toISOString(),
  };

  patients.push(patient);
  reply.code(201);
  return patient;
});

fastify.listen({ port: 3001, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('API listening on http://localhost:3001');
});
