import { Link } from 'react-router-dom';
import { getRole, getToken, landingFor } from '../api';

export default function Home() {
  return (
    <main className="hero">
      <div>
        <p className="eyebrow">Sistem Kasir Restoran</p>
        <h1>Selamat Datang di <span>Restoku</span></h1>
        <p className="sub">Catat pesanan, pantau dapur, dan selesaikan order dengan cepat.</p>
        <Link to={getToken() ? landingFor(getRole()) : '/login'} className="btn">
          {getToken() ? 'Buka Dashboard' : 'Login'}
        </Link>
        <div className="features">
          <div className="feature"><b>Order & Meja</b>Pesanan, diskon, dan denah meja real-time.</div>
          <div className="feature"><b>Dapur & Kasir</b>Antrian dapur, pembayaran, dan shift kasir.</div>
          <div className="feature"><b>Laporan</b>Ringkasan penjualan, PDF, dan CSV.</div>
        </div>
      </div>
      <div className="hero-emoji">🍜🍛🥗</div>
    </main>
  );
}
