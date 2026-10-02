import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { clearSession, getRole, getToken, getName, landingFor, ROLE_LABEL } from './api';
import { NotifyProvider } from './Notify';
import Logo from './Logo';
import Tables from './pages/Tables';
import UserAdmin from './pages/UserAdmin';
import Account from './pages/Account';
import Home from './pages/Home';
import Login from './pages/Login';
import Orders from './pages/Orders';
import Dashboard from './pages/Dashboard';
import MenuAdmin from './pages/MenuAdmin';
import Kitchen from './pages/Kitchen';
import OrderDetail from './pages/OrderDetail';
import CreateOrder from './pages/CreateOrder';
import Reports from './pages/Reports';

const Protected = ({ children, roles }) => {
  if (!getToken()) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(getRole())) return <Navigate to={landingFor(getRole())} replace />;
  return children;
};

function Navbar() {
  const navigate = useNavigate();
  const loggedIn = !!getToken();
  const role = getRole();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const logout = () => { clearSession(); navigate('/login'); };
  const links = [
    ['/dashboard', 'Dashboard', ['ADMIN', 'KASIR']],
    ['/orders', 'Orders', ['ADMIN', 'KASIR']],
    ['/tables', 'Meja', ['ADMIN', 'KASIR']],
    ['/kitchen', 'Dapur', ['ADMIN', 'DAPUR']],
    ['/reports', 'Laporan', ['ADMIN', 'KASIR']],
    ['/menu-admin', 'Kelola Menu', ['ADMIN']],
    ['/users', 'Kelola Akun', ['ADMIN']],
  ];
  return (
    <nav className="nav">
      <Link to="/" className="brand"><Logo /> Restoku</Link>
      {loggedIn && (
        <>
          <button className="nav-toggle" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
          </button>
          <div className={`nav-links ${open ? 'open' : ''}`}>
            {links.filter(([, , roles]) => roles.includes(role)).map(([to, label]) => <NavLink key={to} to={to} className={({ isActive }) => (isActive || (to === '/orders' && pathname === '/create') ? 'active' : '')}>{label}</NavLink>)}
            <Link to="/account" className="who" title="Akun Saya">{getName()} · {ROLE_LABEL[role]}</Link>
            <button className="btn btn-ghost" onClick={logout}>Logout</button>
          </div>
        </>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <NotifyProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={getToken() ? <Navigate to={landingFor(getRole())} replace /> : <Login />} />
        <Route path="/dashboard" element={<Protected roles={['ADMIN', 'KASIR']}><Dashboard /></Protected>} />
        <Route path="/kitchen" element={<Protected roles={['ADMIN', 'DAPUR']}><Kitchen /></Protected>} />
        <Route path="/tables" element={<Protected roles={['ADMIN', 'KASIR']}><Tables /></Protected>} />
        <Route path="/shift" element={<Navigate to="/dashboard" replace />} />
        <Route path="/reports" element={<Protected roles={['ADMIN', 'KASIR']}><Reports /></Protected>} />
        <Route path="/menu-admin" element={<Protected roles={['ADMIN']}><MenuAdmin /></Protected>} />
        <Route path="/users" element={<Protected roles={['ADMIN']}><UserAdmin /></Protected>} />
        <Route path="/account" element={<Protected><Account /></Protected>} />
        <Route path="/orders" element={<Protected roles={['ADMIN', 'KASIR']}><Orders /></Protected>} />
        <Route path="/orders/:id" element={<Protected roles={['ADMIN', 'KASIR']}><OrderDetail /></Protected>} />
        <Route path="/create" element={<Protected roles={['ADMIN', 'KASIR']}><CreateOrder /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="footer">© {new Date().getFullYear()} Restoku · Sistem kasir & manajemen restoran</footer>
    </NotifyProvider>
  );
}
