export const rupiah = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

// Diskon dipotong dari subtotal sebelum service & pajak (sama persis dengan server)
export const discountAmount = (sub, type, value) => {
  const v = Number(value);
  if (type === 'PERCENT') return v > 0 && v <= 100 ? Math.round(sub * (Math.round(v * 100) / 100) / 100) : 0;
  if (type === 'AMOUNT') return Number.isInteger(v) && v > 0 ? Math.min(v, sub) : 0;
  return 0;
};
export const discountError = (sub, type, value) => {
  if (!type || type === 'NONE' || value === '' || Number(value) === 0) return '';
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) return 'Diskon tidak valid';
  if (type === 'PERCENT' && v > 100) return 'Diskon persen maksimal 100%';
  if (type === 'AMOUNT' && !Number.isInteger(v)) return 'Diskon nominal harus bilangan bulat';
  if (type === 'AMOUNT' && v > sub) return 'Diskon nominal tidak boleh melebihi subtotal';
  return '';
};
export const calc = (sub, s = { tax: 0.1, service: 0.05 }, discount = 0) => {
  const net = Math.max(0, sub - discount);
  const service = Math.round(net * s.service);
  const tax = Math.round((net + service) * s.tax);
  return { subtotal: sub, discount, service, tax, total: net + service + tax };
};
export const discLabel = (o) => (o.discount_type === 'PERCENT' ? ` (${o.discount_value}%)` : '');

export const getToken = () => localStorage.getItem('token');
export const getRole = () => localStorage.getItem('role');
export const getName = () => localStorage.getItem('name') || '';
export const getUserId = () => localStorage.getItem('uid');

export const ROLE_LABEL = { ADMIN: 'Admin', KASIR: 'Kasir', DAPUR: 'Dapur' };
export const landingFor = (role) => (role === 'DAPUR' ? '/kitchen' : role === 'KASIR' ? '/dashboard' : '/dashboard');

export function setSession({ token, id, role, name, email }) {
  localStorage.setItem('token', token);
  localStorage.setItem('uid', id);
  localStorage.setItem('role', role);
  localStorage.setItem('name', name);
  localStorage.setItem('email', email);
}
export function clearSession() {
  ['token', 'uid', 'role', 'name', 'email'].forEach((k) => localStorage.removeItem(k));
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Pastikan API berjalan (npm run dev).');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') {
    clearSession();
    window.location.href = '/login';
  }
  if (!res.ok) throw new Error(data.message || `Terjadi kesalahan (${res.status})`);
  return data;
}
