// Doble de prueba de @supabase/supabase-js: tablas en memoria y el subconjunto
// del query builder que usa la API. Los tokens mapean directo a usuarios.

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.op = 'select';
    this.payload = null;
    this.singleMode = null;
    this.limitN = null;
  }

  select() { return this; }
  insert(rows) { this.op = 'insert'; this.payload = rows; return this; }
  update(values) { this.op = 'update'; this.payload = values; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(col, val) { this.filters.push((r) => r[col] === val); return this; }
  is(col, val) { this.filters.push((r) => (r[col] ?? null) === val); return this; }
  not(col, op, val) { this.filters.push((r) => (r[col] ?? null) !== val); return this; }
  in(col, vals) { this.filters.push((r) => vals.includes(r[col])); return this; }
  order() { return this; }
  limit(n) { this.limitN = n; return this; }
  maybeSingle() { this.singleMode = 'maybe'; return this; }
  single() { this.singleMode = 'one'; return this; }
  then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject); }

  run() {
    const rows = (this.db[this.table] ||= []);
    const match = (r) => this.filters.every((f) => f(r));
    let result;

    if (this.op === 'insert') {
      result = this.payload.map((row) => ({ id: `${this.table}-${rows.length + 1}`, ...row }));
      rows.push(...result);
    } else if (this.op === 'update') {
      result = rows.filter(match);
      result.forEach((r) => Object.assign(r, this.payload));
    } else if (this.op === 'delete') {
      result = rows.filter(match);
      this.db[this.table] = rows.filter((r) => !match(r));
    } else {
      result = rows.filter(match);
    }

    if (this.limitN !== null) result = result.slice(0, this.limitN);
    if (this.singleMode) return { data: result[0] ?? null, error: null };
    return { data: result, error: null };
  }
}

export function createFakeSupabase({ users = {}, tables = {}, files = {}, rpc = {} } = {}) {
  const db = structuredClone(tables);
  const storage = { ...files };
  return {
    db,
    files: storage,
    from: (table) => new Query(db, table),
    rpc: async (name, args) => (rpc[name]
      ? { data: rpc[name](args, db), error: null }
      : { data: null, error: { message: `rpc ${name} no definida` } }),
    storage: {
      from: (bucket) => ({
        download: async (path) => (storage[`${bucket}/${path}`]
          ? { data: new Blob([storage[`${bucket}/${path}`]]), error: null }
          : { data: null, error: { message: 'Object not found' } }),
        createSignedUploadUrl: async (path) => ({ data: { signedUrl: `https://storage.test/${bucket}/${path}?token=t`, token: 't', path }, error: null }),
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://storage.test/${bucket}/${path}?sig=s` }, error: null }),
        list: async () => ({ data: [], error: null }),
        remove: async (paths) => ({ data: paths, error: null }),
      }),
    },
    auth: {
      getUser: async (token) =>
        users[token] ? { data: { user: users[token] }, error: null } : { data: { user: null }, error: { message: 'invalid' } },
    },
  };
}
