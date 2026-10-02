import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { usePolling } from '../hooks';
import { useNotify } from '../Notify';

const mins = (t) => Math.max(0, Math.floor((Date.now() - new Date(t)) / 60000));

export default function Kitchen() {
  const notify = useNotify();
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [, setNow] = useState(0);

  const load = useCallback(() =>
    api('/orders?status=PENDING,PROCESSING&pageSize=50')
      .then((r) => { setOrders([...r.data].reverse()); setError(''); })
      .catch((e) => setError(e.message)), []);

  usePolling(load, 10000); // ambil order baru tiap 10 detik (berhenti saat tab tersembunyi)
  useEffect(() => { const b = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(b); }, []); // perbarui waktu tunggu

  const move = async (id, status) => {
    try { await api(`/orders/${id}`, { method: 'PUT', body: { status } }); load(); }
    catch (e) { notify.error(e.message); }
  };

  const column = (status, title, next, label) => {
    const list = orders.filter((o) => o.status === status);
    return (
      <section>
        <h2>{title} <span className="count">{list.length}</span></h2>
        {list.map((o) => (
          <div className={`card ticket ${mins(o.created_at) >= 15 ? 'late' : ''}`} key={o.id}>
            <div className="row"><b>Meja {o.table_number}</b><small>{mins(o.created_at)} menit lalu</small></div>
            <small>{o.customer_name} · {o.guests || '-'} tamu · {o.id}</small>
            <ul>
              {o.cart.map((c) => (
                <li key={c.menuId}><b>{c.quantity}×</b> {c.menuItem.name}{c.notes && <span className="note"> — {c.notes}</span>}</li>
              ))}
            </ul>
            <button className={`btn btn-sm ${status === 'PROCESSING' ? 'btn-green' : ''}`} onClick={() => move(o.id, next)}>{label}</button>
          </div>
        ))}
        {!list.length && <p className="empty">Tidak ada order.</p>}
      </section>
    );
  };

  return (
    <main className="page">
      <div className="head"><h1>Layar Dapur</h1><small>Diperbarui otomatis tiap 10 detik</small></div>
      {error && <p className="error">{error}</p>}
      <div className="kitchen">
        {column('PENDING', 'Antrian', 'PROCESSING', 'Mulai Masak')}
        {column('PROCESSING', 'Sedang Dimasak', 'COMPLETED', 'Siap Disajikan')}
      </div>
    </main>
  );
}
