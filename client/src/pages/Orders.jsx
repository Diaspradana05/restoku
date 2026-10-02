import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, rupiah } from '../api';
import { useNotify } from '../Notify';
import { Pagination } from '../components';

export const Badge = ({ status }) => <span className={`badge ${status.toLowerCase()}`}>{status}</span>;

const SIZE = 5;
const tabs = ['', 'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED'];

export default function Orders() {
  const notify = useNotify();
  const [orders, setOrders] = useState([]);
  const [pg, setPg] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api(`/orders?page=${page}&pageSize=${SIZE}&status=${status}`);
      setOrders(r.data); setPg(r.pagination);
      if (r.pagination.page !== page) setPage(r.pagination.page);
    } catch (e) { notify.error(e.message); } finally { setLoading(false); }
  }, [page, status]);
  useEffect(() => { load(); }, [load]);

  const update = async (id, s) => {
    try { await api(`/orders/${id}`, { method: 'PUT', body: { status: s } }); } catch (e) { notify.error(e.message); }
    load();
  };

  const cancel = async (id) => {
    const reason = await notify.ask('Order akan dibatalkan dan tidak bisa diproses lagi.', { title: 'Batalkan order', placeholder: 'Alasan pembatalan...', confirmLabel: 'Batalkan Order' });
    if (reason === null) return;
    if (!reason.trim()) return notify.error('Alasan pembatalan wajib diisi');
    try { await api(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }); load(); notify.success('Order dibatalkan'); }
    catch (e) { notify.error(e.message); }
  };

  return (
    <main className="page">
      <div className="head">
        <h1>Daftar Order</h1>
        <Link to="/create" className="btn">+ Buat Order</Link>
      </div>
      <div className="filters">
        {tabs.map((t) => (
          <button key={t} className={`btn btn-sm ${t === status ? '' : 'btn-ghost'}`} onClick={() => { setStatus(t); setPage(1); }}>{t || 'Semua'}</button>
        ))}
      </div>
      <div className="card table-wrap stack">
        <table>
          <thead>
            <tr><th>No</th><th>Pelanggan</th><th>Meja</th><th>Tamu</th><th>Total</th><th>Status</th><th>Bayar</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.id}>
                <td data-label="No">{(page - 1) * SIZE + i + 1}</td>
                <td data-label="Pelanggan">{o.customer_name}</td>
                <td data-label="Meja">{o.table_number}</td>
                <td data-label="Tamu">{o.guests || '-'}</td>
                <td data-label="Total">{rupiah(o.total)}{o.discount > 0 && <small> · diskon {rupiah(o.discount)}</small>}</td>
                <td data-label="Status"><Badge status={o.status} /></td>
                <td data-label="Bayar">{o.status === 'CANCELLED' ? '-' : <span className={`badge ${o.payment_status === 'PAID' ? 'completed' : 'pending'}`}>{o.payment_status === 'PAID' ? 'LUNAS' : 'BELUM'}</span>}</td>
                <td className="actions" data-label="Aksi">
                  <Link to={`/orders/${o.id}`} className="btn btn-sm btn-ghost">Detail</Link>
                  {o.status !== 'CANCELLED' && o.payment_status !== 'PAID' && <Link to={`/orders/${o.id}`} className="btn btn-sm btn-green">Bayar</Link>}
                  {o.status === 'PENDING' && <button className="btn btn-sm" onClick={() => update(o.id, 'PROCESSING')}>Proses</button>}
                  {o.status === 'PROCESSING' && <button className="btn btn-sm btn-green" onClick={() => update(o.id, 'COMPLETED')}>Selesai</button>}
                  {o.status !== 'CANCELLED' && o.payment_status !== 'PAID' && <button className="btn btn-sm btn-ghost" onClick={() => cancel(o.id)}>Batal</button>}
                </td>
              </tr>
            ))}
            {!loading && !orders.length && <tr><td colSpan="8" className="empty">Belum ada order.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination pagination={pg} onChange={setPage} />
    </main>
  );
}
