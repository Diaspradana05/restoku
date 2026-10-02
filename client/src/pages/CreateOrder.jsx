import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, calc, discountAmount, discountError, rupiah } from '../api';
import { useNotify } from '../Notify';
import { Pagination, Stars } from '../components';
import MenuModal from '../MenuModal';

const filters = ['All', 'Appetizers', 'Main Course', 'Drinks', 'Desserts'];

export default function CreateOrder() {
  const notify = useNotify();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || 'All';
  const [menus, setMenus] = useState([]);
  const [pg, setPg] = useState(null);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [tick, setTick] = useState(0);
  const [settings, setSettings] = useState({ tax: 0.1, service: 0.05 });
  useEffect(() => { api('/settings').then((r) => setSettings(r.data)).catch(() => {}); }, []);
  const [cart, setCart] = useState({}); // id -> {item, quantity}
  const [customerName, setCustomerName] = useState('');
  const [tableNumber, setTableNumber] = useState(params.get('table') || '');
  const [guests, setGuests] = useState('');
  const [tables, setTables] = useState([]);
  useEffect(() => { api('/tables').then((r) => setTables(r.data)).catch(() => {}); }, []);
  const [submitting, setSubmitting] = useState(false);
  const [discType, setDiscType] = useState('NONE');
  const [discValue, setDiscValue] = useState('');

  useEffect(() => {
    const q = `?page=${page}&pageSize=6` + (category === 'All' ? '' : `&category=${encodeURIComponent(category)}`);
    api('/menu' + q).then((r) => { setMenus(r.data); setPg(r.pagination); }).catch(() => setMenus([]));
  }, [category, page, tick]);

  const change = (item, delta) =>
    setCart((prev) => {
      const qty = (prev[item.id]?.quantity || 0) + delta;
      const next = { ...prev };
      if (qty <= 0) delete next[item.id]; else next[item.id] = { item, quantity: qty, notes: prev[item.id]?.notes || '' };
      return next;
    });

  const lines = Object.values(cart);
  const count = lines.reduce((s, l) => s + l.quantity, 0);
  const total = lines.reduce((s, l) => s + l.item.price * l.quantity, 0);
  const dErr = discountError(total, discType, discValue);
  const disc = dErr ? 0 : discountAmount(total, discType, discValue);
  const t = calc(total, settings, disc);
  const sel = tables.find((x) => String(x.number) === String(tableNumber));
  const free = sel ? sel.capacity - (sel.occupied_seats || 0) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!lines.length) return notify.error('Keranjang masih kosong. Pilih menu dulu.');
    if (!sel) return notify.error('Pilih meja terlebih dahulu');
    if (dErr) return notify.error(dErr);
    if (Number(guests) < 1 || Number(guests) > free) return notify.error(`Jumlah tamu harus 1–${free} (sisa kursi Meja ${sel.number})`);
    setSubmitting(true);
    try {
      await api('/orders', {
        method: 'POST',
        body: { customerName, tableNumber: Number(tableNumber), guests: Number(guests), discountType: discType, discountValue: discType === 'NONE' ? 0 : Number(discValue || 0), cart: lines.map((l) => ({ menuId: l.item.id, quantity: l.quantity, notes: l.notes })) },
      });
      notify.success(`Order dibuat — Meja ${tableNumber} terisi ${guests} kursi`); navigate('/tables');
    } catch (err) { notify.error(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <main className="page create">
      <section>
        <h1>Pilih Menu Terbaik Kami</h1>
        <div className="filters">
          {filters.map((f) => (
            <button key={f} className={`btn btn-sm ${f === category ? '' : 'btn-ghost'}`}
              onClick={() => { setPage(1); setParams(f === 'All' ? {} : { category: f }); }}>{f}</button>
          ))}
        </div>
        <div className="menu-grid">
          {menus.map((m) => (
            <div className={`card menu-item ${m.available ? '' : 'sold'}`} key={m.id}>
              <img className="menu-img" src={m.image_url} alt={m.name} onClick={() => setDetail(m)} />
              <h3>{m.name}</h3>
              <div className="rate" onClick={() => setDetail(m)}>
                <Stars value={m.rating} /> <b>{m.rating || '-'}</b> <small>({m.review_count} ulasan)</small>
              </div>
              <p className="desc">{m.description}</p>
              <div className="row">
                <b className="price">{rupiah(m.price)}</b>
                {m.available ? <button className="btn btn-sm" onClick={() => change(m, 1)}>+ Order</button> : <span className="badge soldout">HABIS</span>}
              </div>
            </div>
          ))}
        </div>
        <Pagination pagination={pg} onChange={setPage} />
      </section>

      <form className="card cart" onSubmit={submit}>
        <h2>Keranjang ({count})</h2>
        <div className="cart-lines">
          {!lines.length && <p className="empty">Belum ada item</p>}
          {lines.map(({ item, quantity, notes }) => (
            <div className="cart-line" key={item.id}>
              <span>{item.name}<br /><small>{rupiah(item.price * quantity)}</small></span>
              <div className="qty">
                <button type="button" onClick={() => change(item, -1)}>−</button>
                <b>{quantity}</b>
                <button type="button" onClick={() => change(item, 1)}>+</button>
              </div>
              <input className="note-in" placeholder="Catatan (mis. tanpa pedas)" maxLength="100" value={notes || ''}
                onChange={(e) => setCart((p) => ({ ...p, [item.id]: { ...p[item.id], notes: e.target.value } }))} />
            </div>
          ))}
        </div>
        <label>Nama Pelanggan
          <input required placeholder="Masukkan nama" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </label>
        <label>Meja
          <select required value={tableNumber} onChange={(e) => { setTableNumber(e.target.value); setGuests(''); }}>
            <option value="">Pilih meja...</option>
            {tables.map((x) => { const f = x.capacity - (x.occupied_seats || 0); return <option key={x.id} value={x.number} disabled={f <= 0}>Meja {x.number} — sisa {f}/{x.capacity} kursi{x.status === 'RESERVED' ? ' (reservasi)' : ''}</option>; })}
          </select>
        </label>
        <label>Jumlah Tamu
          <input required type="number" min="1" max={free || undefined} disabled={!sel} placeholder={sel ? `Maks. ${free} orang` : 'Pilih meja dulu'} value={guests} onChange={(e) => setGuests(e.target.value)} />
        </label>
        <label>Diskon (opsional)
          <div className="disc-row">
            <select value={discType} onChange={(e) => { setDiscType(e.target.value); setDiscValue(''); }}>
              <option value="NONE">Tanpa diskon</option><option value="PERCENT">Persen (%)</option><option value="AMOUNT">Nominal (Rp)</option>
            </select>
            <input type="number" min="0" step={discType === 'PERCENT' ? '0.01' : '1'} max={discType === 'PERCENT' ? 100 : total || undefined} disabled={discType === 'NONE'}
              placeholder={discType === 'PERCENT' ? '0–100' : 'Rp'} value={discValue} onChange={(e) => setDiscValue(e.target.value)} />
          </div>
        </label>
        {dErr && <p className="error">{dErr}</p>}
        <div className="sum">
          <div className="row"><span>Subtotal</span><span>{rupiah(t.subtotal)}</span></div>
          {disc > 0 && <div className="row disc"><span>Diskon{discType === 'PERCENT' ? ` (${Number(discValue)}%)` : ''}</span><span>− {rupiah(disc)}</span></div>}
          <div className="row"><span>Service ({Math.round(settings.service * 100)}%)</span><span>{rupiah(t.service)}</span></div>
          <div className="row"><span>Pajak ({Math.round(settings.tax * 100)}%)</span><span>{rupiah(t.tax)}</span></div>
          <div className="row total-row"><span>Total</span><b>{rupiah(t.total)}</b></div>
        </div>
        <button className="btn" disabled={submitting}>{submitting ? 'Memproses...' : 'Buat Order'}</button>
      </form>
      {detail && <MenuModal item={detail} onClose={() => setDetail(null)} onAdd={(m) => change(m, 1)} onChanged={() => setTick((t) => t + 1)} />}
    </main>
  );
}
