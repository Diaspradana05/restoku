import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { usePolling } from '../hooks';
import { useNotify } from '../Notify';

const LABEL = { AVAILABLE: 'Kosong', OCCUPIED: 'Terisi', RESERVED: 'Reservasi' };

export default function Tables() {
  const notify = useNotify();
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => api('/tables').then((r) => { setTables(r.data); setError(''); }).catch((e) => setError(e.message)), []);
  usePolling(load, 10000);

  const toggleReserve = async (t) => {
    try { await api(`/tables/${t.id}`, { method: 'PUT', body: { status: t.status === 'RESERVED' ? 'AVAILABLE' : 'RESERVED' } }); load(); }
    catch (e) { notify.error(e.message); }
  };
  const count = (s) => tables.filter((t) => t.status === s).length;

  return (
    <main className="page">
      <div className="head">
        <h1>Denah Meja</h1>
        <small>Status & kursi terisi otomatis dari order · klik "Reservasi" untuk menandai meja dipesan</small>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="legend">
        <span><i className="dot available" />Kosong ({count('AVAILABLE')})</span>
        <span><i className="dot occupied" />Terisi ({count('OCCUPIED')})</span>
        <span><i className="dot reserved" />Reservasi ({count('RESERVED')})</span>
      </div>
      <div className="table-grid">
        {tables.map((t) => {
          const used = t.occupied_seats || 0;
          return (
            <div key={t.id} className={`card table-card ${t.status.toLowerCase()}`}>
              <b>Meja {t.number}</b>
              <div className="seats" aria-label={`${used} dari ${t.capacity} kursi terisi`}>
                {Array.from({ length: t.capacity }, (_, i) => <i key={i} className={i < used ? 'seat on' : 'seat'} />)}
              </div>
              <small>{used}/{t.capacity} kursi terisi</small>
              <span className="badge2">{LABEL[t.status]}</span>
              <div className="actions">
                <button className="btn btn-sm" disabled={used >= t.capacity} onClick={() => navigate(`/create?table=${t.number}`)}>Buat Order</button>
                {used === 0 && <button className="btn btn-sm btn-ghost" onClick={() => toggleReserve(t)}>{t.status === 'RESERVED' ? 'Batal Resv.' : 'Reservasi'}</button>}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
