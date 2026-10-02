import { useCallback, useState } from 'react';
import { usePolling } from '../hooks';
import { api, getRole, getUserId, rupiah } from '../api';
import { useNotify } from '../Notify';

const M = { CASH: 'Tunai', QRIS: 'QRIS', CARD: 'Kartu' };

// Panel Buka/Tutup Shift — ditampilkan di Dashboard
export default function Shift() {
  const notify = useNotify();
  const [cur, setCur] = useState(undefined);
  const [opening, setOpening] = useState('');
  const [counted, setCounted] = useState('');
  const [busy, setBusy] = useState(false);
  const [closedInfo, setClosedInfo] = useState(null);

  const load = useCallback(() => api('/shifts/current').then((r) => setCur(r.data)).catch(() => setCur(null)), []);
  usePolling(load, 15000);

  const open = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api('/shifts/open', { method: 'POST', body: { opening_cash: Number(opening) } }); setOpening(''); setClosedInfo(null); await load(); notify.success('Shift dibuka'); }
    catch (err) { notify.error(err.message); } finally { setBusy(false); }
  };
  const close = async (e) => {
    e.preventDefault();
    if (cur.unpaid_done > 0 && !(await notify.confirm(`Masih ada ${cur.unpaid_done} order selesai yang belum dibayar. Tetap tutup shift?`, { title: 'Order belum lunas', confirmLabel: 'Tetap Tutup' }))) return;
    setBusy(true);
    try {
      const r = await api(`/shifts/${cur.id}/close`, { method: 'POST', body: { counted_cash: Number(counted) } });
      setClosedInfo(r.data); setCounted(''); await load(); notify.success('Shift ditutup');
    } catch (err) { notify.error(err.message); } finally { setBusy(false); }
  };

  const canClose = cur && (getRole() === 'ADMIN' || cur.opened_by_id === getUserId());

  if (cur === undefined) return <section className="card mt"><p>Memuat shift...</p></section>;

  return (
    <section className="card mt shift-box">
      <div className="row">
        <h3>Shift Kasir</h3>
        <span className={`badge ${cur ? 'completed' : 'cancelled'}`}>{cur ? 'SHIFT BERJALAN' : 'SHIFT TUTUP'}</span>
      </div>
      {!cur && (
        <form className="shift-form" onSubmit={open}>
          <p className="hint left">Buka shift dengan kas awal sebelum menerima pembayaran.</p>
          <label>Kas Awal (Rp)<input required type="number" min="0" value={opening} onChange={(e) => setOpening(e.target.value)} /></label>
          <button className="btn" disabled={busy}>{busy ? 'Membuka...' : 'Buka Shift'}</button>
        </form>
      )}
      {cur && (
        <div className="grid2 shift-grid">
          <div className="info">
            <div><span>Dibuka oleh</span><b>{cur.opened_by}</b></div>
            <div><span>Sejak</span><b>{new Date(cur.opened_at).toLocaleString('id-ID')}</b></div>
            <div><span>Kas Awal</span><b>{rupiah(cur.opening_cash)}</b></div>
            <div><span>Transaksi</span><b>{cur.trx_count} · {rupiah(cur.total_sales)}</b></div>
            {Object.entries(cur.by_method).map(([k, v]) => <div key={k}><span>&nbsp;&nbsp;{M[k]}</span><b>{rupiah(v)}</b></div>)}
            <div className="total"><span>Estimasi Kas di Laci</span><b>{rupiah(cur.opening_cash + cur.cash_sales)}</b></div>
          </div>
          {canClose ? (
            <form className="shift-form" onSubmit={close}>
              <label>Hitung Kas Fisik di Laci (Rp)<input required type="number" min="0" value={counted} onChange={(e) => setCounted(e.target.value)} /></label>
              <button className="btn btn-green" disabled={busy}>{busy ? 'Menutup...' : 'Tutup Shift'}</button>
            </form>
          ) : <p className="hint left">Shift ini dibuka oleh {cur.opened_by}. Hanya pembuka shift atau admin yang dapat menutup dan menerima pembayaran.</p>}
        </div>
      )}
      {closedInfo && (
        <div className="info mt">
          <h3>Ringkasan Penutupan {closedInfo.id}</h3>
          <div><span>Total Penjualan ({closedInfo.trx_count} transaksi)</span><b>{rupiah(closedInfo.total_sales)}</b></div>
          <div><span>Kas Seharusnya</span><b>{rupiah(closedInfo.expected_cash)}</b></div>
          <div><span>Kas Fisik</span><b>{rupiah(closedInfo.counted_cash)}</b></div>
          <div className="total"><span>Selisih</span><b className={closedInfo.difference < 0 ? 'neg' : ''}>{rupiah(closedInfo.difference)}</b></div>
        </div>
      )}
    </section>
  );
}
