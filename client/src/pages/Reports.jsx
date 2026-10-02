import { useCallback, useEffect, useState } from 'react';
import { api, getName, getRole, rupiah } from '../api';
import { useNotify } from '../Notify';

const M = { CASH: 'Tunai', QRIS: 'QRIS', CARD: 'Kartu' };
const iso = (n = 0) => new Date(Date.now() - n * 864e5).toLocaleDateString('sv');
const fmt = (d) => (d ? new Date(d).toLocaleString('id-ID') : '-');
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PRESETS = [['Hari ini', 0, 0], ['7 hari', 6, 0], ['30 hari', 29, 0]];

const COLS = {
  trx: {
    title: 'Laporan Transaksi', file: 'laporan-transaksi',
    head: ['Order', 'Waktu Bayar', 'Pelanggan', 'Meja', 'Tamu', 'Item', 'Subtotal', 'Diskon', 'Service', 'Pajak', 'Total', 'Metode', 'Kasir'],
    row: (o) => [o.id, fmt(o.paid_at), o.customer_name, String(o.table_number), String(o.guests || '-'), o.items, o.subtotal, o.discount || 0, o.service, o.tax, o.total, M[o.method], o.cashier],
  },
  shift: {
    title: 'Laporan Shift', file: 'laporan-shift',
    head: ['Shift', 'Kasir', 'Dibuka', 'Ditutup', 'Kas Awal', 'Transaksi', 'Total Penjualan', 'Penjualan Tunai', 'Kas Seharusnya', 'Kas Fisik', 'Selisih'],
    row: (s) => [s.id, s.opened_by, fmt(s.opened_at), s.status === 'OPEN' ? 'Berjalan' : fmt(s.closed_at), s.opening_cash, String(s.trx_count || 0), s.total_sales || 0,
      s.cash_sales || 0, s.status === 'OPEN' ? '-' : s.expected_cash, s.status === 'OPEN' ? '-' : s.counted_cash, s.status === 'OPEN' ? '-' : s.difference],
  },
};

export default function Reports() {
  const notify = useNotify();
  const [tab, setTab] = useState('trx');
  const [range, setRange] = useState({ from: iso(), to: iso() });
  const [method, setMethod] = useState('');
  const isAdmin = getRole() === 'ADMIN';
  const [cashier, setCashier] = useState('');
  const [cashiers, setCashiers] = useState([]);
  useEffect(() => { if (isAdmin) api('/reports/cashiers').then((r) => setCashiers(r.data)).catch(() => {}); }, [isAdmin]);
  const cashierName = cashiers.find((c) => c.id === cashier)?.name;
  const [rep, setRep] = useState(null);
  const [error, setError] = useState('');
  const cfg = COLS[tab];

  const load = useCallback(() => {
    if (!range.from || !range.to) return setError('Tanggal wajib diisi');
    if (range.from > range.to) return setError('Tanggal awal tidak boleh setelah tanggal akhir');
    setError('');
    const q = `?from=${range.from}&to=${range.to}${tab === 'trx' && method ? `&method=${method}` : ''}${isAdmin && cashier ? `&cashier=${cashier}` : ''}`;
    api(`/reports/${tab === 'trx' ? 'transactions' : 'shifts'}${q}`).then(setRep).catch((e) => { setRep(null); setError(e.message); });
  }, [tab, range, method, cashier, isAdmin]);
  useEffect(() => { setRep(null); load(); }, [load]);

  const rows = rep ? rep.data.map(cfg.row) : [];
  const s = rep?.summary;
  const cards = !s ? [] : tab === 'trx'
    ? [['Transaksi', s.count], ['Subtotal', rupiah(s.subtotal)], ['Total Diskon', rupiah(s.discount)], ['Service + Pajak', rupiah(s.service + s.tax)], ['Total Pendapatan', rupiah(s.total)]]
    : [['Jumlah Shift', s.count], ['Transaksi', s.trx_count], ['Total Penjualan', rupiah(s.total_sales)], ['Total Selisih Kas', rupiah(s.difference)]];
  const period = `${range.from} s/d ${range.to}`;

  const csv = () => {
    if (!rows.length) return notify.error('Tidak ada data untuk diekspor');
    const line = (r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    const body = [cfg.head, ...rows].map(line).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8' }));
    a.download = `${cfg.file}_${range.from}_${range.to}${cashierName ? '_' + cashierName.replace(/\W+/g, '-') : ''}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    notify.success('CSV berhasil diunduh');
  };

  const pdf = () => {
    if (!rows.length) return notify.error('Tidak ada data untuk dicetak');
    const w = window.open('', '_blank');
    if (!w) return notify.error('Pop-up diblokir browser. Izinkan pop-up untuk mengunduh PDF.');
    const cell = (v) => `<td>${esc(typeof v === 'number' ? rupiah(v) : v)}</td>`;
    w.document.write(`<html><head><title>${cfg.title} ${period}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#222}
      table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eee}
      .sum{display:flex;gap:24px;margin:10px 0;font-size:12px}</style></head><body><h2>Restoku — ${cfg.title}</h2><div>Periode: ${period}${tab === 'trx' && method ? ` · Metode: ${M[method]}` : ''} · Kasir: ${esc(isAdmin ? (cashierName || 'Semua kasir') : getName())} · Dicetak: ${fmt(new Date())}</div>
      <div class="sum">${cards.map(([l, v]) => `<div><b>${esc(v)}</b><br>${esc(l)}</div>`).join('')}</div>
      <table><thead><tr>${cfg.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody></table></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };

  return (
    <main className="page">
      <div className="head"><h1>{isAdmin ? 'Laporan' : 'Laporan Saya'}</h1>
        <div className="actions"><button className="btn btn-sm btn-ghost" onClick={csv}>⬇ Export CSV</button><button className="btn btn-sm" onClick={pdf}>⬇ Download PDF</button></div>
      </div>
      <div className="filters">
        {[['trx', 'Transaksi'], ['shift', 'Shift']].map(([k, l]) => <button key={k} className={`btn btn-sm ${tab === k ? '' : 'btn-ghost'}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="card export-controls report-filter">
        <input type="date" aria-label="Dari tanggal" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        <span>s/d</span>
        <input type="date" aria-label="Sampai tanggal" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        {PRESETS.map(([l, a, b]) => <button key={l} className="btn btn-sm btn-ghost" onClick={() => setRange({ from: iso(a), to: iso(b) })}>{l}</button>)}
        {isAdmin && <select aria-label="Kasir" value={cashier} onChange={(e) => setCashier(e.target.value)}><option value="">Semua kasir</option>{cashiers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
        {tab === 'trx' && <select aria-label="Metode bayar" value={method} onChange={(e) => setMethod(e.target.value)}><option value="">Semua metode</option>{Object.entries(M).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
      </div>
      {!isAdmin && <p className="hint left mt">Menampilkan hanya shift dan transaksi milik Anda ({getName()}).</p>}
      {error && <p className="error mt">{error}</p>}
      <div className="stats">{cards.map(([l, v]) => <div className="card stat" key={l}><small>{l}</small><b>{v}</b></div>)}</div>
      {tab === 'trx' && s && <p className="hint left mt">Per metode — {Object.entries(s.by_method).map(([k, v]) => `${M[k]}: ${rupiah(v)}`).join(' · ')}</p>}
      <div className="card table-wrap mt">
        <table>
          <thead><tr>{cfg.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{typeof v === 'number' ? rupiah(v) : v}</td>)}</tr>)}
            {rep && !rows.length && <tr><td colSpan={cfg.head.length} className="empty">Tidak ada data pada periode ini.</td></tr>}
            {!rep && !error && <tr><td colSpan={cfg.head.length} className="empty">Memuat...</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}
