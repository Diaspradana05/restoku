import { useCallback, useEffect, useState } from 'react';
import { api, rupiah } from './api';
import { useNotify } from './Notify';
import { Pagination, Stars } from './components';

export default function MenuModal({ item, onClose, onAdd, onChanged }) {
  const notify = useNotify();
  const [list, setList] = useState([]);
  const [pg, setPg] = useState(null);
  const [page, setPage] = useState(1);
  const [avg, setAvg] = useState(item.rating);
  const [form, setForm] = useState({ name: '', rating: 5, comment: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api(`/menu/${item.id}/reviews?page=${page}&pageSize=4`);
    setList(r.data); setPg(r.pagination); setAvg(r.average);
  }, [item.id, page]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/menu/${item.id}/reviews`, { method: 'POST', body: form });
      setForm({ name: '', rating: 5, comment: '' });
      setPage(1); await load(); onChanged(); notify.success('Ulasan terkirim, terima kasih!');
    } catch (err) { notify.error(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>✕</button>
        <img className="modal-img" src={item.image_url} alt={item.name} />
        <div className="modal-body">
          <div className="row"><h2>{item.name}</h2><b className="price">{rupiah(item.price)}</b></div>
          <p className="desc">{item.description}</p>
          <div className="row">
            <span><Stars value={avg} /> <b>{avg || '-'}</b> <small>({pg?.total ?? 0} ulasan)</small></span>
            <button className="btn btn-sm" disabled={!item.available} onClick={() => { onAdd(item); onClose(); }}>{item.available ? '+ Order' : 'Habis'}</button>
          </div>
          <h3>Ulasan</h3>
          {list.map((r) => (
            <div className="review" key={r.id}>
              <div className="row"><b>{r.name}</b><small>{new Date(r.created_at).toLocaleDateString('id-ID')}</small></div>
              <Stars value={r.rating} />
              {r.comment && <p>{r.comment}</p>}
            </div>
          ))}
          {!list.length && <p className="empty">Belum ada ulasan.</p>}
          <Pagination pagination={pg} onChange={setPage} />
          <form className="review-form" onSubmit={submit}>
            <h3>Tulis Ulasan</h3>
            <input required placeholder="Nama pelanggan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Stars value={form.rating} onChange={(n) => setForm({ ...form, rating: n })} />
            <input placeholder="Komentar (opsional)" value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            <button className="btn btn-sm" disabled={busy}>{busy ? 'Mengirim...' : 'Kirim Ulasan'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}
