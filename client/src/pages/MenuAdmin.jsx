import { useCallback, useEffect, useState } from 'react';
import { api, rupiah } from '../api';
import { useNotify } from '../Notify';
import { Pagination } from '../components';

const CATS = ['Appetizers', 'Main Course', 'Drinks', 'Desserts'];
const empty = { name: '', category: 'Main Course', price: '', description: '', image_url: '' };

export default function MenuAdmin() {
  const notify = useNotify();
  const [menus, setMenus] = useState([]);
  const [pg, setPg] = useState(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api(`/menu?page=${page}&pageSize=6&q=${encodeURIComponent(q)}`);
    setMenus(r.data); setPg(r.pagination);
    if (r.pagination.page !== page) setPage(r.pagination.page);
  }, [page, q]);
  useEffect(() => { load().catch((e) => notify.error(e.message)); }, [load]);

  const act = async (fn, okMsg) => { try { await fn(); load(); if (okMsg) notify.success(okMsg); } catch (e) { notify.error(e.message); } };
  const toggle = (m) => act(() => api(`/menu/${m.id}`, { method: 'PUT', body: { available: !m.available } }));
  const remove = async (m) => {
    if (!(await notify.confirm(`Menu "${m.name}" akan dihapus permanen beserta ulasannya.`, { title: 'Hapus menu?', danger: true, confirmLabel: 'Hapus' }))) return;
    act(() => api(`/menu/${m.id}`, { method: 'DELETE' }), 'Menu dihapus');
  };

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...form, price: Number(form.price) };
      if (form.id) await api(`/menu/${form.id}`, { method: 'PUT', body });
      else await api('/menu', { method: 'POST', body });
      setForm(null); load(); notify.success('Menu disimpan');
    } catch (err) { notify.error(err.message); } finally { setBusy(false); }
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <main className="page">
      <div className="head">
        <h1>Kelola Menu</h1>
        <button className="btn" onClick={() => setForm(empty)}>+ Tambah Menu</button>
      </div>
      <input className="search" placeholder="Cari menu..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
      <div className="card table-wrap stack">
        <table>
          <thead><tr><th>Menu</th><th>Kategori</th><th>Harga</th><th>Ketersediaan</th><th>Aksi</th></tr></thead>
          <tbody>
            {menus.map((m) => (
              <tr key={m.id}>
                <td data-label="Menu"><div className="cellrow"><img className="thumb" src={m.image_url} alt="" /><b>{m.name}</b></div></td>
                <td data-label="Kategori">{m.category}</td>
                <td data-label="Harga">{rupiah(m.price)}</td>
                <td data-label="Ketersediaan"><button className={`btn btn-sm ${m.available ? 'btn-green' : 'btn-ghost'}`} onClick={() => toggle(m)}>{m.available ? 'Tersedia' : 'Habis'}</button></td>
                <td className="actions" data-label="Aksi">
                  <button className="btn btn-sm btn-ghost" onClick={() => setForm(m)}>Edit</button>
                  <button className="btn btn-sm" onClick={() => remove(m)}>Hapus</button>
                </td>
              </tr>
            ))}
            {!menus.length && <tr><td colSpan="5" className="empty">Menu tidak ditemukan.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pg} onChange={setPage} />

      {form && (
        <div className="overlay" onClick={() => setForm(null)}>
          <form className="modal modal-body" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{form.id ? 'Edit Menu' : 'Tambah Menu'}</h2>
            <label>Nama Menu<input required value={form.name} onChange={set('name')} /></label>
            <label>Kategori
              <select value={form.category} onChange={set('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label>Harga (Rp)<input required type="number" min="1" value={form.price} onChange={set('price')} /></label>
            <label>Deskripsi<input value={form.description} onChange={set('description')} /></label>
            <label>URL Gambar (opsional)<input placeholder="https://... atau kosongkan" value={form.image_url} onChange={set('image_url')} /></label>
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
