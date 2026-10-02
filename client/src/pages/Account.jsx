import { useState } from 'react';
import { api, getName, getRole, ROLE_LABEL, clearSession } from '../api';
import { useNavigate } from 'react-router-dom';
import { PasswordInput } from '../Eye';
import { useNotify } from '../Notify';

export default function Account() {
  const notify = useNotify();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 6) return notify.error('Password baru minimal 6 karakter');
    if (form.newPassword !== form.confirm) return notify.error('Konfirmasi password baru tidak cocok');
    setBusy(true);
    try {
      await api('/users/me/password', { method: 'PUT', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      notify.success('Password berhasil diubah, silakan login kembali');
      clearSession();
      navigate('/login');
    } catch (err) { notify.error(err.message); } finally { setBusy(false); }
  };

  return (
    <main className="page">
      <h1>Akun Saya</h1>
      <div className="card info mt" style={{ maxWidth: 420 }}>
        <div><span>Nama</span><b>{getName()}</b></div>
        <div><span>Role</span><b>{ROLE_LABEL[getRole()]}</b></div>
      </div>
      <form className="card login mt" style={{ maxWidth: 420 }} onSubmit={submit}>
        <h3>Ubah Password</h3>
        <PasswordInput label="Password Saat Ini" required autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
        <PasswordInput label="Password Baru" required minLength="6" autoComplete="new-password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        <PasswordInput label="Konfirmasi Password Baru" required minLength="6" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
        <button className="btn" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan Password'}</button>
      </form>
    </main>
  );
}
