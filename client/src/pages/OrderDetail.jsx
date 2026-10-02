import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, discLabel, discountAmount, discountError, rupiah } from '../api';
import { useNotify } from '../Notify';
import { Badge } from './Orders';

const METHOD = { CASH: 'Tunai', QRIS: 'QRIS', CARD: 'Kartu' };

export default function OrderDetail() {
  const notify = useNotify();
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [cfg, setCfg] = useState({ name: 'Restoku', address: '', tax: 0.1, service: 0.05 });
  const [error, setError] = useState('');
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [dForm, setDForm] = useState({ type: 'NONE', value: '' });

  const load = useCallback(() => api(`/orders/${id}`).then((r) => setOrder(r.data)).catch((e) => setError(e.message)), [id]);
  useEffect(() => { if (order) setDForm({ type: order.discount_type && order.discount_type !== 'NONE' ? order.discount_type : 'NONE', value: order.discount_value || '' }); }, [order?.discount_type, order?.discount_value]);
  useEffect(() => { load(); api('/settings').then((r) => setCfg(r.data)).catch(() => {}); }, [load]);

  const pay = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api(`/orders/${id}/pay`, { method: 'POST', body: { method, amount: Number(amount) } }); await load(); notify.success('Pembayaran berhasil dicatat'); }
    catch (err) { notify.error(err.message); } finally { setBusy(false); }
  };

  const saveDiscount = async (e) => {
    e.preventDefault();
    const err = discountError(order.subtotal, dForm.type, dForm.value);
    if (err) return notify.error(err);
    setBusy(true);
    try { await api(`/orders/${id}/discount`, { method: 'POST', body: { discountType: dForm.type, discountValue: dForm.type === 'NONE' ? 0 : Number(dForm.value || 0) } }); setAmount(''); await load(); notify.success('Diskon diperbarui'); }
    catch (er) { notify.error(er.message); } finally { setBusy(false); }
  };

  const cancel = async () => {
    const reason = await notify.ask('Order akan dibatalkan dan tidak bisa diproses lagi.', { title: 'Batalkan order', placeholder: 'Alasan pembatalan...', confirmLabel: 'Batalkan Order' });
    if (reason === null) return;
    if (!reason.trim()) return notify.error('Alasan pembatalan wajib diisi');
    try { await api(`/orders/${id}/cancel`, { method: 'POST', body: { reason } }); await load(); notify.success('Order dibatalkan'); }
    catch (e) { notify.error(e.message); }
  };

  const move = async () => {
    const n = await notify.ask(`Pindahkan order (${order.guests} tamu) ke nomor meja:`, { title: 'Pindah Meja', placeholder: 'Nomor meja tujuan', confirmLabel: 'Pindahkan' });
    if (n === null) return;
    try { await api(`/orders/${id}/move`, { method: 'POST', body: { table: Number(n) } }); await load(); notify.success(`Order dipindah ke Meja ${n}`); }
    catch (e) { notify.error(e.message); }
  };

  if (error) return <main className="page"><p className="error">{error}</p></main>;
  if (!order) return <main className="page"><p>Memuat...</p></main>;

  const paid = order.payment_status === 'PAID';
  const cancelled = order.status === 'CANCELLED';
  const quick = [...new Set([order.total, Math.ceil(order.total / 50000) * 50000, Math.ceil(order.total / 100000) * 100000])];
  const change = Number(amount) - order.total;

  return (
    <main className="page">
      <div className="print-only receipt-head"><h2>{cfg.name}</h2><p>{cfg.address}</p></div>
      <div className="head no-print">
        <h1>Detail Order</h1>
        <div className="actions">
          {paid && <button className="btn" onClick={() => window.print()}>Cetak Struk</button>}
          {!paid && !cancelled && <button className="btn btn-ghost" onClick={move}>Pindah Meja</button>}
          {!paid && !cancelled && <button className="btn btn-ghost" onClick={cancel}>Batalkan Order</button>}
          <Link to="/orders" className="btn btn-ghost">← Kembali</Link>
        </div>
      </div>
      <div className="grid2">
        <section className="card info">
          <div><span>Order ID</span><b>{order.id}</b></div>
          <div><span>Pelanggan</span><b>{order.customer_name}</b></div>
          <div><span>Meja</span><b>{order.table_number}</b></div>
          <div><span>Jumlah Tamu</span><b>{order.guests || '-'} orang</b></div>
          <div><span>Status</span><Badge status={order.status} /></div>
          <div><span>Waktu</span><b>{new Date(order.created_at).toLocaleString('id-ID')}</b></div>
          {cancelled
            ? <div><span>Alasan Batal</span><b>{order.cancel_reason}</b></div>
            : <div><span>Pembayaran</span><span className={`badge ${paid ? 'completed' : 'pending'}`}>{paid ? 'LUNAS' : 'BELUM DIBAYAR'}</span></div>}
          {paid && <>
            <div><span>Metode</span><b>{METHOD[order.payment.method]}</b></div>
            <div><span>Dibayar</span><b>{rupiah(order.payment.paid)}</b></div>
            <div><span>Kembalian</span><b>{rupiah(order.payment.change)}</b></div>
          </>}
        </section>
        <section className="card">
          <h3>Item Pesanan</h3>
          {order.cart.map((c) => (
            <div className="line" key={c.menuId}>
              <img className="thumb" src={c.menuItem.image_url} alt={c.menuItem.name} />
              <div><b>{c.quantity} × {c.menuItem.name}</b><br /><small>{rupiah(c.menuItem.price)} / porsi</small>{c.notes && <><br /><small className="note">Catatan: {c.notes}</small></>}</div>
              <b>{rupiah(c.menuItem.price * c.quantity)}</b>
            </div>
          ))}
          <div className="sum">
            <div className="row"><span>Subtotal</span><span>{rupiah(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="row disc"><span>Diskon{discLabel(order)}</span><span>− {rupiah(order.discount)}</span></div>}
            <div className="row"><span>Service ({Math.round(cfg.service * 100)}%)</span><span>{rupiah(order.service)}</span></div>
            <div className="row"><span>Pajak ({Math.round(cfg.tax * 100)}%)</span><span>{rupiah(order.tax)}</span></div>
            <div className="row total-row"><span>Total</span><b>{rupiah(order.total)}</b></div>
          </div>
        </section>
      </div>

      {!paid && !cancelled && (
        <form className="card pay no-print" onSubmit={saveDiscount}>
          <h3>Diskon</h3>
          <div className="disc-row">
            <select value={dForm.type} onChange={(e) => setDForm({ type: e.target.value, value: '' })}>
              <option value="NONE">Tanpa diskon</option><option value="PERCENT">Persen (%)</option><option value="AMOUNT">Nominal (Rp)</option>
            </select>
            <input type="number" min="0" step={dForm.type === 'PERCENT' ? '0.01' : '1'} disabled={dForm.type === 'NONE'} placeholder={dForm.type === 'PERCENT' ? '0–100' : 'Rp'} value={dForm.value} onChange={(e) => setDForm({ ...dForm, value: e.target.value })} />
            <button className="btn btn-sm btn-ghost" disabled={busy}>Terapkan</button>
          </div>
          {dForm.type !== 'NONE' && dForm.value !== '' && !discountError(order.subtotal, dForm.type, dForm.value) && <p className="hint left">Potongan: {rupiah(discountAmount(order.subtotal, dForm.type, dForm.value))} dari subtotal</p>}
        </form>
      )}

      {!paid && !cancelled && (
        <form className="card pay no-print" onSubmit={pay}>
          <h3>Pembayaran — {rupiah(order.total)}</h3>
          <div className="filters">
            {Object.entries(METHOD).map(([k, v]) => (
              <button type="button" key={k} className={`btn btn-sm ${k === method ? '' : 'btn-ghost'}`} onClick={() => setMethod(k)}>{v}</button>
            ))}
          </div>
          {method === 'CASH' ? (
            <>
              <label>Uang diterima (Rp)<input required type="number" min={order.total} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
              <div className="filters">{quick.map((q) => <button type="button" key={q} className="btn btn-sm btn-ghost" onClick={() => setAmount(q)}>{rupiah(q)}</button>)}</div>
              {amount !== '' && <p>Kembalian: <b>{change >= 0 ? rupiah(change) : 'uang kurang'}</b></p>}
            </>
          ) : <p className="hint">{method === 'QRIS' ? 'Tunjukkan QRIS ke pelanggan, lalu konfirmasi setelah pembayaran masuk.' : 'Gesek kartu di mesin EDC, lalu konfirmasi.'}</p>}
          <button className="btn btn-green" disabled={busy || (method === 'CASH' && !(change >= 0))}>{busy ? 'Memproses...' : 'Konfirmasi Pembayaran'}</button>
        </form>
      )}
      <p className="print-only receipt-foot">Terima kasih atas kunjungan Anda 🙏</p>
    </main>
  );
}
