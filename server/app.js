import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { store } from './store.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false }));
app.use(express.json({ limit: '200kb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin'); res.setHeader('Cache-Control', 'no-store');
  next();
});

const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
const DEMO = String(process.env.DEMO_MODE).toLowerCase() === 'true';
const SECRET = process.env.SECRET || (IS_PROD ? '' : 'restoku-dev-secret');
const TZ = process.env.APP_TIMEZONE || 'Asia/Jakarta';
const CONFIG = { name: process.env.RESTO_NAME || 'Restoku', address: process.env.RESTO_ADDRESS || 'Jl. Contoh No. 1, Surabaya', tax: 0.1, service: 0.05 };
const ROLES = ['ADMIN', 'KASIR', 'DAPUR'];
const DEMO_ACCOUNTS = [
  { role: 'ADMIN', name: 'Admin Restoku', email: process.env.ADMIN_EMAIL || 'admin@restoku.com', password: process.env.ADMIN_PASSWORD || 'admin123' },
  { role: 'KASIR', name: 'Kasir Demo', email: 'kasir@restoku.com', password: 'kasir123' },
  { role: 'DAPUR', name: 'Dapur Demo', email: 'dapur@restoku.com', password: 'dapur123' },
];

const configError = () => {
  if (!SECRET) return 'Konfigurasi server belum lengkap: environment variable SECRET belum diatur.';
  if (store.mode === 'none') return 'Database belum terhubung: sambungkan Upstash Redis (KV_REST_API_URL & KV_REST_API_TOKEN) pada project Vercel.';
  return '';
};

// ---- akun & kata sandi ----
const hashPassword = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
const verifyPassword = (pw, stored) => {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64).toString('hex');
  return test.length === hash.length && crypto.timingSafeEqual(Buffer.from(test), Buffer.from(hash));
};
const publicUser = ({ passwordHash, ...u }) => u;

const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const makeToken = (u) => { const p = b64({ id: u.id, exp: Date.now() + 12 * 36e5 }); return `${p}.${sign(p)}`; };
const parseToken = (t) => {
  const [p, sig] = String(t).split('.');
  if (!p || !sig || sig.length !== 64) return null;
  try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(p)))) return null; } catch { return null; }
  try {
    const data = JSON.parse(Buffer.from(p, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
};
// Diskon dipotong dari subtotal SEBELUM service & pajak (dasar pengenaan = subtotal - diskon)
const totals = (sub, discount = 0) => {
  const net = Math.max(0, sub - discount);
  const service = Math.round(net * CONFIG.service);
  const tax = Math.round((net + service) * CONFIG.tax);
  return { subtotal: sub, discount, service, tax, total: net + service + tax };
};
// validasi & hitung nominal diskon; mengembalikan {type, value, amount} atau {error}
const parseDiscount = (type, value, sub) => {
  if (!type || type === 'NONE' || value === '' || value === undefined || value === null || Number(value) === 0) return { type: 'NONE', value: 0, amount: 0 };
  const v = Number(value);
  if (!['PERCENT', 'AMOUNT'].includes(type) || !Number.isFinite(v) || v < 0) return { error: 'Diskon tidak valid' };
  if (type === 'PERCENT') {
    if (v > 100) return { error: 'Diskon persen maksimal 100%' };
    const pct = Math.round(v * 100) / 100;
    return { type, value: pct, amount: Math.round(sub * pct / 100) };
  }
  if (!Number.isInteger(v)) return { error: 'Diskon nominal harus bilangan bulat (Rp)' };
  if (v > sub) return { error: 'Diskon nominal tidak boleh melebihi subtotal' };
  return { type, value: v, amount: v };
};
const applyDiscount = (o, d) => Object.assign(o, { discount_type: d.type, discount_value: d.value }, totals(o.subtotal, d.amount));
const localDate = (d) => new Date(d).toLocaleDateString('sv', { timeZone: TZ });
const fmtDT = (d) => new Date(d).toLocaleString('id-ID', { timeZone: TZ });

const defaultMenus = () => {
const m = (id, name, category, price, _e, description) => ({ id, name, category, price, image_url: `/menu/${id}.svg`, description, available: true });
return [
  m('m1', 'Lumpia Goreng', 'Appetizers', 22000, '🥟', 'Lumpia isi sayur & ayam, renyah.'),
  m('m2', 'Salad Segar', 'Appetizers', 25000, '🥗', 'Sayuran segar dengan dressing lemon.'),
  m('m3', 'Sup Iga', 'Appetizers', 38000, '🍲', 'Kuah hangat dengan iga empuk.'),
  m('m4', 'Nasi Goreng Special', 'Main Course', 35000, '🍛', 'Nasi goreng, telur, ayam & kerupuk.'),
  m('m5', 'Ayam Bakar Madu', 'Main Course', 42000, '🍗', 'Ayam bakar bumbu madu + sambal.'),
  m('m6', 'Steak Sapi', 'Main Course', 85000, '🥩', 'Sirloin 200g, kentang & saus lada hitam.'),
  m('m7', 'Spaghetti Carbonara', 'Main Course', 48000, '🍝', 'Pasta creamy dengan smoked beef.'),
  m('m8', 'Es Teh Manis', 'Drinks', 8000, '🧋', 'Teh dingin segar.'),
  m('m9', 'Jus Jeruk', 'Drinks', 15000, '🍊', 'Jeruk peras asli.'),
  m('m10', 'Kopi Susu', 'Drinks', 18000, '☕', 'Espresso dengan susu segar.'),
  m('m11', 'Es Krim Vanilla', 'Desserts', 20000, '🍨', 'Dua scoop dengan topping cokelat.'),
  m('m12', 'Pisang Bakar Keju', 'Desserts', 22000, '🍌', 'Pisang bakar, keju & susu kental.'),
];
};

const CATS = ['Appetizers', 'Main Course', 'Drinks', 'Desserts'];

// ---- state (dimuat dari store pada setiap request; disimpan hanya bila berubah) ----
let users = [], menus = [], tables = [], orders = [], reviews = [], shifts = [];
const saveUsers = () => {}, saveMenus = () => {}, saveTables = () => {}, save = () => {}, saveReviews = () => {}, saveShifts = () => {};

// order "aktif" = belum dibatalkan dan belum (SELESAI + LUNAS) -> meja tetap terisi sampai keduanya terpenuhi
const isActive = (o) => o.status !== 'CANCELLED' && !(o.status === 'COMPLETED' && o.payment_status === 'PAID');
const syncTable = (number) => {
  const t = tables.find((x) => x.number === Number(number));
  if (!t) return;
  const act = orders.filter((o) => o.table_number === t.number && isActive(o));
  t.occupied_seats = Math.min(t.capacity, act.reduce((n, o) => n + (o.guests || 1), 0));
  if (act.length) t.status = 'OCCUPIED'; else if (t.status === 'OCCUPIED') t.status = 'AVAILABLE';
  saveTables();
};
const freeSeats = (t) => t.capacity - (t.occupied_seats || 0);

const withRating = (mi) => {
  const r = reviews.filter((x) => x.menuId === mi.id);
  return { ...mi, review_count: r.length, rating: r.length ? +(r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1) : 0 };
};
const paginate = (list, q, def) => {
  const pageSize = Math.max(1, Math.min(50, parseInt(q.pageSize) || def));
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(Math.max(1, parseInt(q.page) || 1), totalPages);
  return { data: list.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total: list.length, totalPages } };
};


const STATE_KEYS = ['users', 'menus', 'tables', 'orders', 'reviews', 'shifts'];
let snapshot = {}, loaded = false;
const parse = (raw) => { try { const v = JSON.parse(raw); return v ?? null; } catch { return null; } };
const uidByName = (n) => users.find((u) => u.name === n)?.id || null;

function initState(raw) {
  const firstRun = raw.orders == null && raw.reviews == null;
  users = parse(raw.users); menus = parse(raw.menus) || defaultMenus();
  tables = parse(raw.tables) || Array.from({ length: 12 }, (_, i) => ({ id: 't' + (i + 1), number: i + 1, capacity: [2, 2, 4, 4, 6][i % 5], status: 'AVAILABLE' }));
  orders = parse(raw.orders) || []; reviews = parse(raw.reviews) || []; shifts = parse(raw.shifts) || [];
  if (!Array.isArray(users) || !users.length) {
    const seed = DEMO ? DEMO_ACCOUNTS : [DEMO_ACCOUNTS[0]];
    if (IS_PROD && !DEMO && !process.env.ADMIN_PASSWORD) throw Object.assign(new Error('Set environment variable ADMIN_PASSWORD (dan ADMIN_EMAIL) untuk membuat akun admin pertama.'), { status: 503 });
    users = seed.map((a, i) => ({ id: 'u' + (i + 1), name: a.name, email: a.email.toLowerCase(), role: a.role, active: true, passwordHash: hashPassword(a.password), created_at: new Date().toISOString() }));
  }
  // migrasi order lama: rincian biaya, diskon & status pembayaran
  orders.forEach((o) => {
    if (o.subtotal === undefined) Object.assign(o, totals(o.total));
    if (!o.guests) o.guests = 2;
    if (o.discount_type === undefined) { o.discount = o.discount || 0; o.discount_type = 'NONE'; o.discount_value = 0; }
    if (!o.payment_status) {
      o.payment_status = o.status === 'COMPLETED' ? 'PAID' : 'UNPAID';
      o.payment = o.payment_status === 'PAID' ? { method: 'CASH', paid: o.total, change: 0, paid_at: o.created_at } : null;
    }
  });
if (firstRun && (DEMO || !IS_PROD)) {
  const cashiers = users.filter((u) => u.role !== 'DAPUR');
  const names = ['Budi', 'Siti', 'Andi', 'Dewi', 'Rina', 'Joko', 'Maya', 'Eko', 'Lina', 'Tono', 'Wulan', 'Agus'];
  const stat = ['COMPLETED', 'PROCESSING', 'PENDING'];
  orders = names.map((n, i) => {
    const cart = [menus[i % 12], menus[(i * 5 + 3) % 12]].map((mi, k) => ({ menuId: mi.id, quantity: k + 1 + (i % 2), menuItem: mi }));
    const status = stat[i % 3];
    // order aktif (belum selesai) pakai waktu yang realistis (baru saja); yang sudah selesai/lunas tersebar mundur untuk grafik
    const created_at = status === 'COMPLETED'
      ? new Date(Date.now() - i * 9 * 36e5).toISOString()
      : new Date(Date.now() - (3 + i * 4) * 60000).toISOString();
    const t = totals(cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0));
    return { id: 'ORD-DEMO' + (i + 1), customer_name: n, table_number: (i % 8) + 1, cart, status, ...t, created_at,
      payment_status: status === 'COMPLETED' ? 'PAID' : 'UNPAID',
      payment: status === 'COMPLETED' ? { method: ['CASH', 'QRIS', 'CARD'][(i / 3) % 3], paid: t.total, change: 0, paid_at: created_at, cashier: cashiers[i % cashiers.length].name, cashier_id: cashiers[i % cashiers.length].id } : null };
  });
  const cm = ['Enak banget, porsinya pas!', 'Rasanya mantap, pasti pesan lagi.', 'Lumayan, agak lama datangnya.', 'Segar dan bumbunya pas.', 'Favorit keluarga kami!'];
  menus.forEach((mi, i) => [0, 1, 2].forEach((k) => reviews.push({ id: `r${i}-${k}`, menuId: mi.id, name: names[(i + k * 4) % 12],
    rating: 3 + ((i + k) % 3), comment: cm[(i + k) % 5], created_at: new Date(Date.now() - (i * 3 + k) * 864e5).toISOString() })));
}


  // tautkan data lama ke ID kasir (sebelumnya hanya nama)
  orders.forEach((o) => { if (o.payment?.cashier && !o.payment.cashier_id) o.payment.cashier_id = uidByName(o.payment.cashier); });
  shifts.forEach((s) => { if (!s.opened_by_id) s.opened_by_id = uidByName(s.opened_by); });
  tables.forEach((t) => syncTable(t.number));
}

async function loadState() {
  if (store.mode === 'file' && loaded) return;
  const raw = await store.getAll(STATE_KEYS);
  snapshot = Object.fromEntries(STATE_KEYS.map((k) => [k, raw[k]]));
  initState(raw); loaded = true;
}
const serializeState = () => ({ users: JSON.stringify(users), menus: JSON.stringify(menus), tables: JSON.stringify(tables),
  orders: JSON.stringify(orders), reviews: JSON.stringify(reviews), shifts: JSON.stringify(shifts) });
async function flushState() {
  const cur = serializeState(), changed = {};
  STATE_KEYS.forEach((k) => { if (cur[k] !== snapshot[k]) changed[k] = cur[k]; });
  if (!Object.keys(changed).length) return;
  await store.setMany(changed);
  Object.assign(snapshot, changed);
}

// Antrian per-instance: satu request diproses sampai datanya tersimpan, baru request berikutnya (mencegah tabrakan tulis)
let tail = Promise.resolve();
app.use('/api', (req, res, next) => {
  const ce = configError();
  if (ce) return res.status(503).json({ message: ce });
  const prev = tail; let release;
  tail = new Promise((r) => { release = r; });
  const guard = setTimeout(() => release(), 20000);
  res.on('close', () => { clearTimeout(guard); release(); });
  prev.then(async () => {
    try {
      await loadState();
      const orig = res.send.bind(res);
      res.send = (body) => {
        flushState().then(() => orig(body), (e) => {
          console.error(e); res.send = orig; res.status(500).type('json');
          orig(JSON.stringify({ message: 'Gagal menyimpan data ke database. Silakan coba lagi.' }));
        });
        return res;
      };
      next();
    } catch (e) { next(e); }
  });
});

const auth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const payload = parseToken(token);
  const user = payload && users.find((u) => u.id === payload.id && u.active !== false);
  if (!user) return res.status(401).json({ message: 'Sesi berakhir atau akun tidak aktif, silakan login kembali' });
  req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
  next();
};
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Akun Anda tidak memiliki akses untuk aksi ini' });

const attempts = new Map();
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const key = req.ip + '|' + String(email || '').toLowerCase();
  const a = attempts.get(key);
  if (a && a.reset > Date.now() && a.n >= 8) return res.status(429).json({ message: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' });
  const user = users.find((u) => u.email === String(email || '').toLowerCase().trim());
  if (!user || !verifyPassword(password || '', user.passwordHash))
    { const c = attempts.get(key); attempts.set(key, { n: (c && c.reset > Date.now() ? c.n : 0) + 1, reset: c && c.reset > Date.now() ? c.reset : Date.now() + 10 * 60000 }); return res.status(401).json({ message: 'Email atau password salah' }); }
  attempts.delete(key);
  if (user.active === false) return res.status(401).json({ message: 'Akun ini telah dinonaktifkan. Hubungi admin.' });
  res.json({ token: makeToken(user), id: user.id, role: user.role, name: user.name, email: user.email });
});

app.get('/api/users', auth, allow('ADMIN'), (req, res) => {
  res.json(paginate(users.map(publicUser), req.query, 8));
});
app.post('/api/users', auth, allow('ADMIN'), (req, res) => {
  const { name, email, password, role } = req.body || {};
  const cleanEmail = String(email || '').toLowerCase().trim();
  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(cleanEmail) || !password || password.length < 6 || !ROLES.includes(role))
    return res.status(400).json({ message: 'Nama, email valid, password (min. 6 karakter), dan role wajib diisi' });
  if (users.some((u) => u.email === cleanEmail)) return res.status(409).json({ message: 'Email sudah terdaftar' });
  const user = { id: 'u' + Date.now().toString(36), name: name.trim(), email: cleanEmail, role, active: true,
    passwordHash: hashPassword(password), created_at: new Date().toISOString() };
  users.push(user); saveUsers();
  res.status(201).json({ data: publicUser(user) });
});
app.put('/api/users/:id', auth, allow('ADMIN'), (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'Akun tidak ditemukan' });
  const { name, email, role, password, active } = req.body || {};
  const isLastAdmin = user.role === 'ADMIN' && users.filter((u) => u.role === 'ADMIN' && u.active !== false).length <= 1;
  if (isLastAdmin && (role && role !== 'ADMIN')) return res.status(400).json({ message: 'Tidak bisa mengubah role admin terakhir' });
  if (isLastAdmin && active === false) return res.status(400).json({ message: 'Tidak bisa menonaktifkan admin terakhir' });
  if (user.id === req.user.id && active === false) return res.status(400).json({ message: 'Tidak bisa menonaktifkan akun sendiri' });
  if (name?.trim()) user.name = name.trim();
  if (email) {
    const cleanEmail = String(email).toLowerCase().trim();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return res.status(400).json({ message: 'Email tidak valid' });
    if (users.some((u) => u.email === cleanEmail && u.id !== user.id)) return res.status(409).json({ message: 'Email sudah dipakai akun lain' });
    user.email = cleanEmail;
  }
  if (role) { if (!ROLES.includes(role)) return res.status(400).json({ message: 'Role tidak valid' }); user.role = role; }
  if (typeof active === 'boolean') user.active = active;
  if (password) { if (password.length < 6) return res.status(400).json({ message: 'Password minimal 6 karakter' }); user.passwordHash = hashPassword(password); }
  saveUsers();
  res.json({ data: publicUser(user) });
});
app.delete('/api/users/:id', auth, allow('ADMIN'), (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: 'Akun tidak ditemukan' });
  if (user.id === req.user.id) return res.status(400).json({ message: 'Tidak bisa menghapus akun sendiri' });
  if (user.role === 'ADMIN' && users.filter((u) => u.role === 'ADMIN').length <= 1)
    return res.status(400).json({ message: 'Tidak bisa menghapus admin terakhir' });
  users = users.filter((u) => u.id !== user.id);
  saveUsers();
  res.json({ ok: true });
});
app.put('/api/users/me/password', auth, (req, res) => {
  const user = users.find((u) => u.id === req.user.id);
  const { currentPassword, newPassword } = req.body || {};
  if (!verifyPassword(currentPassword || '', user.passwordHash)) return res.status(400).json({ message: 'Password saat ini salah' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'Password baru minimal 6 karakter' });
  user.passwordHash = hashPassword(newPassword);
  saveUsers();
  res.json({ ok: true });
});

app.get('/api/menu', (req, res) => {
  const { category, q } = req.query;
  let list = menus.map((x) => ({ ...x, available: x.available !== false }));
  if (category) list = list.filter((x) => x.category === category);
  if (q) list = list.filter((x) => x.name.toLowerCase().includes(String(q).toLowerCase()));
  res.json(paginate(list.map(withRating), req.query, 6));
});

const menuInput = (b = {}) => {
  const price = Number(b.price);
  if (!b.name?.trim() || !CATS.includes(b.category) || !(price > 0)) return null;
  return { name: b.name.trim(), category: b.category, price: Math.round(price),
    description: (b.description || '').trim().slice(0, 200), image_url: (b.image_url || '').trim() || '/menu/default.svg' };
};
app.post('/api/menu', auth, allow('ADMIN'), (req, res) => {
  const d = menuInput(req.body);
  if (!d) return res.status(400).json({ message: 'Nama, kategori, dan harga (> 0) wajib diisi' });
  const item = { id: 'm' + Date.now().toString(36), ...d, available: true };
  menus.push(item); saveMenus();
  res.status(201).json({ data: item });
});
app.put('/api/menu/:id', auth, allow('ADMIN'), (req, res) => {
  const item = menus.find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ message: 'Menu tidak ditemukan' });
  const b = req.body || {};
  if ('available' in b && Object.keys(b).length === 1) item.available = !!b.available;
  else {
    const d = menuInput(b);
    if (!d) return res.status(400).json({ message: 'Nama, kategori, dan harga (> 0) wajib diisi' });
    Object.assign(item, d);
  }
  saveMenus();
  res.json({ data: item });
});
app.delete('/api/menu/:id', auth, allow('ADMIN'), (req, res) => {
  const i = menus.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ message: 'Menu tidak ditemukan' });
  menus.splice(i, 1);
  reviews = reviews.filter((r) => r.menuId !== req.params.id);
  saveMenus(); saveReviews();
  res.json({ ok: true });
});

app.get('/api/menu/:id/reviews', (req, res) => {
  const list = reviews.filter((r) => r.menuId === req.params.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const average = list.length ? +(list.reduce((s, r) => s + r.rating, 0) / list.length).toFixed(1) : 0;
  res.json({ ...paginate(list, req.query, 4), average });
});

app.post('/api/menu/:id/reviews', auth, (req, res) => {
  const { name, rating, comment } = req.body || {};
  if (!menus.some((x) => x.id === req.params.id)) return res.status(404).json({ message: 'Menu tidak ditemukan' });
  if (!name?.trim() || !(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'Nama dan rating (1-5) wajib diisi' });
  const review = { id: crypto.randomUUID(), menuId: req.params.id, name: name.trim(), rating: Math.round(rating),
    comment: (comment || '').trim().slice(0, 300), created_at: new Date().toISOString() };
  reviews.push(review);
  saveReviews();
  res.status(201).json({ data: review });
});

app.get('/api/orders', auth, (req, res) => {
  const { status } = req.query;
  res.json(paginate(status ? orders.filter((o) => String(status).split(',').includes(o.status)) : orders, req.query, 5));
});

app.get('/api/orders/:id', auth, (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });
  res.json({ data: order });
});

app.post('/api/orders', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  const { customerName, tableNumber, cart } = req.body || {};
  const guests = parseInt(req.body?.guests);
  if (!String(customerName || '').trim() || !tableNumber || !Array.isArray(cart) || !cart.length)
    return res.status(400).json({ message: 'Data order tidak lengkap' });
  const tbl = tables.find((x) => x.number === Number(tableNumber));
  if (!tbl) return res.status(404).json({ message: 'Meja tidak ditemukan' });
  if (!(guests >= 1)) return res.status(400).json({ message: 'Jumlah tamu minimal 1 orang' });
  if (guests > freeSeats(tbl)) return res.status(400).json({ message: `Kursi tidak cukup: Meja ${tbl.number} sisa ${freeSeats(tbl)} kursi (kapasitas ${tbl.capacity})` });
  const items = cart.map((c) => {
    const menuItem = menus.find((x) => x.id === c.menuId);
    return menuItem && menuItem.available !== false && Number.isInteger(Number(c.quantity)) && c.quantity > 0 && c.quantity <= 99 ? { menuId: c.menuId, quantity: Number(c.quantity), notes: String(c.notes || '').trim().slice(0, 100), menuItem } : null;
  });
  if (items.includes(null)) return res.status(400).json({ message: 'Ada menu yang tidak tersedia atau tidak valid' });
  const sub = items.reduce((n, i) => n + i.menuItem.price * i.quantity, 0);
  const disc = parseDiscount(req.body?.discountType, req.body?.discountValue, sub);
  if (disc.error) return res.status(400).json({ message: disc.error });
  const order = {
    id: 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(),
    customer_name: String(customerName).trim().slice(0, 60),
    table_number: Number(tableNumber),
    guests,
    cart: items,
    status: 'PENDING',
    discount_type: disc.type, discount_value: disc.value,
    ...totals(sub, disc.amount),
    payment_status: 'UNPAID',
    payment: null,
    created_at: new Date().toISOString(),
  };
  orders.unshift(order);
  save();
  syncTable(order.table_number);
  res.status(201).json({ data: order });
});

app.put('/api/orders/:id', auth, allow('ADMIN', 'KASIR', 'DAPUR'), (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });
  if (order.status === 'CANCELLED') return res.status(400).json({ message: 'Order sudah dibatalkan' });
  if (!['PENDING', 'PROCESSING', 'COMPLETED'].includes(req.body?.status))
    return res.status(400).json({ message: 'Status tidak valid' });
  const rank = { PENDING: 0, PROCESSING: 1, COMPLETED: 2 };
  if (rank[req.body.status] < rank[order.status]) return res.status(400).json({ message: 'Status order tidak bisa dimundurkan' });
  order.status = req.body.status;
  save();
  syncTable(order.table_number);
  res.json({ data: order });
});

app.post('/api/orders/:id/discount', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  const o = orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ message: 'Order tidak ditemukan' });
  if (o.status === 'CANCELLED') return res.status(400).json({ message: 'Order sudah dibatalkan' });
  if (o.payment_status === 'PAID') return res.status(400).json({ message: 'Order yang sudah dibayar tidak bisa diubah diskonnya' });
  const d = parseDiscount(req.body?.discountType, req.body?.discountValue, o.subtotal);
  if (d.error) return res.status(400).json({ message: d.error });
  applyDiscount(o, d); save();
  res.json({ data: o });
});

app.post('/api/orders/:id/move', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  const o = orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ message: 'Order tidak ditemukan' });
  if (!isActive(o) || o.payment_status === 'PAID') return res.status(400).json({ message: 'Hanya order aktif yang bisa dipindah' });
  const to = tables.find((x) => x.number === Number(req.body?.table));
  if (!to) return res.status(404).json({ message: 'Meja tujuan tidak ditemukan' });
  if (to.number === o.table_number) return res.status(400).json({ message: 'Order sudah berada di meja ini' });
  if (o.guests > freeSeats(to)) return res.status(400).json({ message: `Kursi tidak cukup: Meja ${to.number} sisa ${freeSeats(to)} kursi` });
  const from = o.table_number;
  o.table_number = to.number; save();
  syncTable(from); syncTable(to.number);
  res.json({ data: o });
});

app.get('/api/settings', (_req, res) => res.json({ data: { ...CONFIG, demo_accounts: DEMO ? DEMO_ACCOUNTS.map(({ role, email, password }) => ({ role, email, password })) : undefined } }));

const cashOf = (s, until) => orders
  .filter((o) => o.payment?.method === 'CASH' && (o.payment.shift_id ? o.payment.shift_id === s.id : o.payment.paid_at >= s.opened_at && o.payment.paid_at <= until))
  .reduce((n, o) => n + o.total, 0);

const shiftStats = (s, until) => {
  const l = orders.filter((o) => o.payment_status === 'PAID' && (o.payment.shift_id ? o.payment.shift_id === s.id : o.payment.paid_at >= s.opened_at && o.payment.paid_at <= until));
  const by = { CASH: 0, QRIS: 0, CARD: 0 };
  l.forEach((o) => { by[o.payment.method] += o.total; });
  return { trx_count: l.length, total_sales: l.reduce((a, o) => a + o.total, 0), by_method: by };
};
app.get('/api/shifts/current', auth, (req, res) => {
  const cur = shifts.find((s) => s.status === 'OPEN');
  if (!cur) return res.json({ data: null });
  const now = new Date().toISOString();
  const unpaidDone = orders.filter((o) => o.status === 'COMPLETED' && o.payment_status !== 'PAID').length;
  res.json({ data: { ...cur, cash_sales: cashOf(cur, now), ...shiftStats(cur, now), unpaid_done: unpaidDone } });
});
app.post('/api/shifts/open', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  if (shifts.some((s) => s.status === 'OPEN')) return res.status(400).json({ message: 'Sudah ada shift yang terbuka' });
  const opening_cash = Number(req.body?.opening_cash);
  if (!(opening_cash >= 0)) return res.status(400).json({ message: 'Kas awal tidak valid' });
  const shift = { id: 'SH-' + Date.now().toString(36).toUpperCase(), opened_by: req.user.name, opened_by_id: req.user.id, opened_at: new Date().toISOString(), opening_cash, status: 'OPEN' };
  shifts.unshift(shift); saveShifts();
  res.status(201).json({ data: shift });
});
app.post('/api/shifts/:id/close', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  const s = shifts.find((x) => x.id === req.params.id);
  if (!s || s.status !== 'OPEN') return res.status(404).json({ message: 'Shift terbuka tidak ditemukan' });
  if (req.user.role !== 'ADMIN' && s.opened_by_id !== req.user.id) return res.status(403).json({ message: 'Shift ini dibuka oleh ' + s.opened_by + '. Hanya pembuka shift atau admin yang dapat menutupnya.' });
  const counted_cash = Number(req.body?.counted_cash);
  if (!(counted_cash >= 0)) return res.status(400).json({ message: 'Jumlah kas fisik tidak valid' });
  const closed_at = new Date().toISOString();
  const cash_sales = cashOf(s, closed_at);
  const expected_cash = s.opening_cash + cash_sales;
  Object.assign(s, { ...shiftStats(s, closed_at), closed_by: req.user.name, closed_by_id: req.user.id, closed_at, counted_cash, cash_sales, expected_cash, difference: counted_cash - expected_cash, status: 'CLOSED' });
  saveShifts();
  res.json({ data: s });
});
app.get('/api/shifts', auth, allow('ADMIN'), (req, res) => res.json(paginate(shifts, req.query, 8)));

app.get('/api/tables', auth, (_req, res) => res.json({ data: tables }));
app.put('/api/tables/:id', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  const t = tables.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ message: 'Meja tidak ditemukan' });
  if (!['AVAILABLE', 'RESERVED'].includes(req.body?.status))
    return res.status(400).json({ message: 'Status meja hanya bisa Kosong/Reservasi. Status Terisi otomatis dari order.' });
  if ((t.occupied_seats || 0) > 0) return res.status(400).json({ message: 'Meja masih memiliki order aktif' });
  t.status = req.body.status;
  saveTables();
  res.json({ data: t });
});

app.post('/api/orders/:id/cancel', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });
  if (order.status === 'CANCELLED') return res.status(400).json({ message: 'Order sudah dibatalkan' });
  if (order.payment_status === 'PAID') return res.status(400).json({ message: 'Order yang sudah dibayar tidak bisa dibatalkan' });
  const reason = String(req.body?.reason || '').trim().slice(0, 200);
  if (!reason) return res.status(400).json({ message: 'Alasan pembatalan wajib diisi' });
  Object.assign(order, { status: 'CANCELLED', cancel_reason: reason, cancelled_at: new Date().toISOString() });
  save();
  syncTable(order.table_number);
  res.json({ data: order });
});

app.post('/api/orders/:id/pay', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });
  if (order.status === 'CANCELLED') return res.status(400).json({ message: 'Order sudah dibatalkan' });
  if (order.payment_status === 'PAID') return res.status(400).json({ message: 'Order sudah dibayar' });
  const openShift = shifts.find((x) => x.status === 'OPEN');
  if (!openShift) return res.status(400).json({ message: 'Belum ada shift terbuka. Buka shift di Dashboard sebelum menerima pembayaran.' });
  if (req.user.role !== 'ADMIN' && openShift.opened_by_id !== req.user.id) return res.status(403).json({ message: 'Shift yang berjalan dibuka oleh ' + openShift.opened_by + '. Pembayaran hanya dapat diterima oleh pembuka shift atau admin.' });
  const { method, amount } = req.body || {};
  if (!['CASH', 'QRIS', 'CARD'].includes(method)) return res.status(400).json({ message: 'Metode pembayaran tidak valid' });
  const paid = method === 'CASH' ? Number(amount) : order.total;
  if (!Number.isInteger(paid) || !(paid >= order.total)) return res.status(400).json({ message: 'Uang yang diterima kurang dari total tagihan' });
  order.payment_status = 'PAID';
  order.payment = { method, paid, change: paid - order.total, paid_at: new Date().toISOString(), shift_id: openShift.id, cashier: req.user.name, cashier_id: req.user.id };
  save();
  syncTable(order.table_number);
  res.json({ data: order });
});

// Hak akses laporan: ADMIN melihat semua (boleh filter kasir); KASIR hanya miliknya sendiri
const scopeCashier = (req) => (req.user.role === 'ADMIN' ? (req.query.cashier || '') : req.user.id);
const paidBy = (cashierId) => orders.filter((o) => o.payment_status === 'PAID' && (!cashierId || o.payment.cashier_id === cashierId));

app.get('/api/reports/summary', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  const paid = paidBy(scopeCashier(req));
  const daily = Array.from({ length: 7 }, (_, i) => {
    const date = localDate(Date.now() - (6 - i) * 864e5);
    const list = paid.filter((o) => localDate(o.payment.paid_at) === date);
    return { date, revenue: list.reduce((s, o) => s + o.total, 0), orders: list.length };
  });
  const items = {};
  paid.forEach((o) => o.cart.forEach((c) => {
    const it = (items[c.menuItem.name] ||= { name: c.menuItem.name, image_url: c.menuItem.image_url, quantity: 0, revenue: 0 });
    it.quantity += c.quantity; it.revenue += c.quantity * c.menuItem.price;
  }));
  const methods = { CASH: 0, QRIS: 0, CARD: 0 };
  paid.forEach((o) => { methods[o.payment.method] += o.total; });
  res.json({ data: {
    today: daily[6],
    unpaid: orders.filter((o) => o.status !== 'CANCELLED' && o.payment_status !== 'PAID').length,
    active: orders.filter((o) => !['COMPLETED', 'CANCELLED'].includes(o.status)).length,
    total_revenue: paid.reduce((s, o) => s + o.total, 0),
    scope: req.user.role === 'ADMIN' ? 'ALL' : 'OWN',
    daily, methods,
    top_items: Object.values(items).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
  } });
});

const inRange = (d, from, to) => (!from || localDate(d) >= from) && (!to || localDate(d) <= to);
const validDate = (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v);
const checkRange = (req, res) => {
  const { from, to } = req.query;
  if (!validDate(from) || !validDate(to)) { res.status(400).json({ message: 'Format tanggal tidak valid (YYYY-MM-DD)' }); return false; }
  if (from && to && from > to) { res.status(400).json({ message: 'Tanggal awal tidak boleh setelah tanggal akhir' }); return false; }
  return true;
};
const trxList = (req) => {
  const { from, to, method } = req.query;
  return paidBy(scopeCashier(req)).filter((o) => inRange(o.payment.paid_at, from, to) && (!method || o.payment.method === method))
    .sort((a, b) => b.payment.paid_at.localeCompare(a.payment.paid_at));
};
const trxRow = (o) => ({ id: o.id, paid_at: o.payment.paid_at, customer_name: o.customer_name, table_number: o.table_number, guests: o.guests,
  items: o.cart.map((c) => `${c.quantity}x ${c.menuItem.name}`).join('; '), subtotal: o.subtotal, discount: o.discount || 0,
  discount_label: o.discount_type === 'PERCENT' ? `${o.discount_value}%` : o.discount ? 'Nominal' : '-',
  service: o.service, tax: o.tax, total: o.total, method: o.payment.method, cashier: o.payment.cashier || '-', shift_id: o.payment.shift_id || '-' });

app.get('/api/reports/cashiers', auth, allow('ADMIN'), (_req, res) =>
  res.json({ data: users.filter((u) => u.role !== 'DAPUR').map((u) => ({ id: u.id, name: u.name, role: u.role })) }));

app.get('/api/reports/transactions', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  if (!checkRange(req, res)) return;
  const list = trxList(req);
  const by = { CASH: 0, QRIS: 0, CARD: 0 };
  list.forEach((o) => { by[o.payment.method] += o.total; });
  const sum = (k) => list.reduce((n, o) => n + (o[k] || 0), 0);
  res.json({ data: list.map(trxRow),
    summary: { count: list.length, subtotal: sum('subtotal'), discount: sum('discount'), service: sum('service'), tax: sum('tax'), total: sum('total'), by_method: by } });
});
app.get('/api/reports/shifts', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  if (!checkRange(req, res)) return;
  const { from, to } = req.query;
  const cid = scopeCashier(req);
  const now = new Date().toISOString();
  const list = shifts.filter((s) => inRange(s.opened_at, from, to) && (!cid || s.opened_by_id === cid))
    .map((s) => s.status === 'OPEN' ? { ...s, ...shiftStats(s, now), cash_sales: cashOf(s, now) } : s);
  res.json({ data: list, summary: { count: list.length, trx_count: list.reduce((n, s) => n + (s.trx_count || 0), 0),
    total_sales: list.reduce((n, s) => n + (s.total_sales || 0), 0), difference: list.reduce((n, s) => n + (s.difference || 0), 0) } });
});
app.get('/api/reports/export', auth, allow('ADMIN', 'KASIR'), (req, res) => {
  if (!checkRange(req, res)) return;
  const { from, to } = req.query;
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ['Order ID', 'Tanggal Bayar', 'Pelanggan', 'Meja', 'Item', 'Subtotal', 'Diskon', 'Service', 'Pajak', 'Total', 'Metode Bayar', 'Kasir'];
  const rows = trxList(req).reverse().map((o) => { const r = trxRow(o); return [r.id, fmtDT(r.paid_at), r.customer_name, r.table_number, r.items, r.subtotal, r.discount, r.service, r.tax, r.total, r.method, r.cashier]; });
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="laporan-penjualan-${from || 'semua'}_${to || 'sekarang'}.csv"`);
  res.send('\uFEFF' + csv);
});

app.use('/api', (_req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));

// semua error selalu dibalas JSON (bukan halaman HTML)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : IS_PROD ? 'Terjadi kesalahan di server' : 'Terjadi kesalahan di server: ' + err.message });
});

export default app;
