import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getRole, rupiah } from '../api';
import Shift from './Shift';

const METHOD = { CASH: 'Tunai', QRIS: 'QRIS', CARD: 'Kartu' };

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/reports/summary').then((r) => setD(r.data)).catch((e) => setError(e.message)); }, []);

  if (error) return <main className="page"><p className="error">{error}</p></main>;
  if (!d) return <main className="page"><p>Memuat...</p></main>;

  const max = Math.max(...d.daily.map((x) => x.revenue), 1);
  const mTotal = Object.values(d.methods).reduce((a, b) => a + b, 0) || 1;
  const stats = [
    [d.scope === 'OWN' ? 'Pendapatan Anda Hari Ini' : 'Pendapatan Hari Ini', rupiah(d.today.revenue)],
    [d.scope === 'OWN' ? 'Order Lunas Anda Hari Ini' : 'Order Lunas Hari Ini', d.today.orders],
    ['Belum Dibayar', d.unpaid],
    ['Order di Dapur', d.active],
  ];

  return (
    <main className="page">
      <h1>Dashboard</h1>
      <div className="stats">
        {stats.map(([l, v]) => (
          <div className="card stat" key={l}><small>{l}</small><b>{v}</b></div>
        ))}
      </div>
      <Shift />
      <section className="card mt export-box"><div><h3>Laporan Transaksi & Shift</h3><small>{getRole() === 'ADMIN' ? 'Filter periode & kasir, unduh PDF atau export CSV.' : 'Laporan shift & transaksi milik Anda — unduh PDF atau export CSV.'}</small></div><Link to="/reports" className="btn btn-sm">Buka Laporan →</Link></section>
      <div className="grid2 mt">
        <section className="card">
          <h3>Pendapatan 7 Hari Terakhir</h3>
          <div className="bars">
            {d.daily.map((x) => (
              <div className="bar-col" key={x.date} title={`${x.orders} order`}>
                <small>{x.revenue ? rupiah(x.revenue).replace('Rp', '').trim() : '-'}</small>
                <div className="bar" style={{ height: `${(x.revenue / max) * 150 + 4}px` }} />
                <small>{x.date.slice(5)}</small>
              </div>
            ))}
          </div>
          <p className="hint">Total pendapatan {d.scope === 'OWN' ? 'Anda' : ''} (semua waktu): <b>{rupiah(d.total_revenue)}</b></p>
        </section>
        <section className="card">
          <h3>Menu Terlaris</h3>
          {d.top_items.map((t, i) => (
            <div className="line" key={t.name}>
              <b>{i + 1}</b><img className="thumb" src={t.image_url} alt="" />
              <div><b>{t.name}</b><br /><small>{rupiah(t.revenue)}</small></div>
              <b>{t.quantity}x</b>
            </div>
          ))}
          {!d.top_items.length && <p className="empty">Belum ada penjualan.</p>}
          <h3 className="mt">Metode Pembayaran</h3>
          {Object.entries(d.methods).map(([k, v]) => (
            <div className="meth" key={k}>
              <div className="row"><span>{METHOD[k]}</span><b>{rupiah(v)}</b></div>
              <div className="track"><div style={{ width: `${(v / mTotal) * 100}%` }} /></div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
