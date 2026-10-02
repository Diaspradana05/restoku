import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, landingFor, setSession } from '../api';
import { EyeIcon } from '../Eye';
import Logo from '../Logo';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState([]);
  useEffect(() => { api('/settings').then((r) => setDemo(r.data.demo_accounts || [])).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api('/auth/login', { method: 'POST', body: form });
      setSession(data);
      navigate(landingFor(data.role), { replace: true });
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <main className="center">
      <form className="card login" onSubmit={submit}>
        <div className="login-brand"><Logo size={44} badge /><h1>Masuk ke Restoku</h1></div>
        <p className="login-sub">Sistem kasir &amp; manajemen restoran</p>
        <label>Email
          <input type="email" autoFocus required autoComplete="username" placeholder="nama@restoran.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Password
          <div className="pw-field">
            <input type={showPw ? 'text' : 'password'} required autoComplete="current-password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" className="pw-eye" onClick={() => setShowPw((v) => !v)} tabIndex={-1} aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}>
              <EyeIcon off={showPw} />
            </button>
          </div>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={loading}>{loading ? 'Masuk...' : 'Login'}</button>
        {demo.length > 0 && (
          <div className="demo-box">
            <small>Akun demo — klik untuk mengisi</small>
            <div className="demo-accounts">
              {demo.map((d) => <button type="button" key={d.role} className="btn btn-sm btn-ghost" onClick={() => setForm({ email: d.email, password: d.password })}>{d.role === 'ADMIN' ? 'Admin' : d.role === 'KASIR' ? 'Kasir' : 'Dapur'}</button>)}
            </div>
          </div>
        )}
        <p className="hint">Belum punya akun? Hubungi admin restoran Anda.</p>
      </form>
    </main>
  );
}
