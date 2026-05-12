// routes/db.js (safe + atomic + mutex)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '..', 'data.json');
const TMP_FILE = DB_FILE + '.tmp';

// lightweight in-process mutex
let lock = Promise.resolve();
function withLock(task) {
  const release = () => {};
  const p = lock.then(() => task()).catch((e) => { throw e; });
  // chain to ensure exclusivity
  lock = p.catch(() => {});
  return p;
}

function ensureFile() {
  if (!fs.existsSync(DB_FILE)) {
    const seed = {
      customers: [],
      bookings: [],
      quotes: [],
      invoices: [],
      receipts: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
  }
}

function load() {
  ensureFile();
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    // ถ้าไฟล์คอร์รัปต์ ให้สำรองไว้ก่อน
    fs.writeFileSync(DB_FILE + '.corrupt', raw);
    throw new Error('DB file is corrupted');
  }
}

// atomic save: write temp → fsync → rename
function save(db) {
  const json = JSON.stringify(db, null, 2);
  const fd = fs.openSync(TMP_FILE, 'w');
  try {
    fs.writeFileSync(fd, json);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(TMP_FILE, DB_FILE);
}

// convenience: read-modify-write under mutex
async function withDb(mutator) {
  return withLock(async () => {
    const db = load();
    const result = await mutator(db);
    save(db);
    return result;
  });
}

// Better uid: prefix + time + random bytes (base36)
function uid(prefix = '') {
  const ts = Date.now().toString(36);                 // time
  const rnd = crypto.randomBytes(6).toString('base64') // ~8 chars after strip
    .replace(/[+/=]/g, '').toLowerCase();
  return (prefix ? prefix + '-' : '') + ts + '-' + rnd;
}

// upsert ลูกค้า จากชื่อ+เบอร์ หรือ taxId
async function upsertCustomer(partial) {
  return withDb((db) => {
    const key = (partial.taxId || '').trim();
    let c = null;

    if (key) c = db.customers.find(x => (x.taxId || '') === key);
    if (!c && partial.name) {
      c = db.customers.find(
        x => x.name === partial.name && (x.phone || '') === (partial.phone || '')
      );
    }

    if (c) {
      Object.assign(c, partial, { updatedAt: new Date().toISOString() });
    } else {
      c = { id: uid('CUST'), createdAt: new Date().toISOString(), ...partial };
      db.customers.push(c);
    }
    return c;
  });
}

module.exports = { load, save, uid, withDb, upsertCustomer };
