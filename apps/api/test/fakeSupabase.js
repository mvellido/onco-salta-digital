// Doble de prueba de @supabase/supabase-js: tablas en memoria y el subconjunto
// del query builder que usa la API. Los tokens mapean directo a usuarios.

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.filters = [];
    this.op = 'select';
    this.payload = null;
    this.single = null;
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
  maybeSingle() { this.single = 'maybe'; return this; }
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
    if (this.single) return { data: result[0] ?? null, error: null };
    return { data: result, error: null };
  }
}

export function createFakeSupabase({ users = {}, tables = {} } = {}) {
  const db = structuredClone(tables);
  return {
    db,
    from: (table) => new Query(db, table),
    auth: {
      getUser: async (token) =>
        users[token] ? { data: { user: users[token] }, error: null } : { data: { user: null }, error: { message: 'invalid' } },
    },
  };
}
