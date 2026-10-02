import { useCallback, useEffect, useState } from 'react';
import { api, getRole } from '../api';
import { Pagination } from '../components';
import { useNotify } from '../Notify';

const ROLES = ['ADMIN', 'KASIR', 'DAPUR'];
const ROLE_LABEL = { ADMIN: 'Admin', KASIR: 'Kasir', DAPUR: 'Dapur' };
const empty = { name: '', email: '', password: '', role: 'KASIR' };

export default function UserAdmin() {
  const notify = useNotify();
  const [users, setUsers] = useState([]);
  const [pg, setPg] = useState(null);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const myRole = getRole();

  const load = useCallback(() =>
    api(`/users?page=${page}&pageSize=8`).then((r) => { setUsers(r.data); setPg(r.pagination); }).catch((e) => notify.error(e.message)), [page]);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (u) => {
    try { await api(`/users/${u.id}`, { method: 'PUT', body: { active: !u.active } }); load(); notify.success(u.active ? 'Akun dinonaktifkan' : 'Akun diaktifkan'); }
    catch (e) { notify.error(e.message); }
  };
  const remove = async (u) => {
    if (!(await notify.confirm(`Akun "${u.name}" (${u.email}) akan dihapus permanen.`, { title: 'Hapus akun?', danger: true, confirmLabel: 'Hapus' }))) return;
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); load(); notify.success('Akun dihapus'); }
    catch (e) { notify.error(e.message); }
  };

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { name: form.name, email: form.email, role: form.role };
      if (!form.id || form.password) body.password = form.password;
      if (form.id) await api(`/users/${form.id}`, { method: 'PUT', body });
      else await api('/users', { method: 'POST', body });
      setForm(null); load(); notify.success('Akun disimpan');
    } catch (err) { notify.error(err.message); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <main className="page">
      <div className="head">
        <h1>Kelola Akun</h1>
        <button className="btn" onClick={() => setForm(empty)}>+ Tambah Akun</button>
      </div>
      <p className="hint left">Buat akun untuk kasir dan tim dapur di sini. Mereka login dengan email &amp; password yang Anda tentukan.</p>
      <div className="card table-wrap stack">
        <table>
          <thead><tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Aksi</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td data-label="Nama"><b>{u.name}</b></td>
                <td data-label="Email">{u.email}</td>
                <td data-label="Role"><span className={`badge role-${u.role.toLowerCase()}`}>{ROLE_LABEL[u.role]}</span></td>
                <td data-label="Status"><button className={`btn btn-sm ${u.active !== false ? 'btn-green' : 'btn-ghost'}`} onClick={() => toggleActive(u)}>{u.active !== false ? 'Aktif' : 'Nonaktif'}</button></td>
                <td className="actions" data-label="Aksi">
                  <button className="btn btn-sm btn-ghost" onClick={() => setForm({ ...u, password: '' })}>Edit</button>
                  <button className="btn btn-sm" onClick={() => remove(u)}>Hapus</button>
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan="5" className="empty">Belum ada akun.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pg} onChange={setPage} />

      {form && (
        <div className="overlay" onClick={() => setForm(null)}>
          <form className="modal modal-body" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{form.id ? 'Edit Akun' : 'Tambah Akun'}</h2>
            <label>Nama Lengkap<input required value={form.name} onChange={set('name')} /></label>
            <label>Email<input required type="email" value={form.email} onChange={set('email')} /></label>
            <label>Role
              <select value={form.role} onChange={set('role')}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
            </label>
            <label>{form.id ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}
              <input type="password" minLength="6" required={!form.id} placeholder="minimal 6 karakter" value={form.password} onChange={set('password')} />
            </label>
            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Batal</button>
              <button className="btn" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
