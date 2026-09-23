import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase, dinein } from '../lib/supabase';

const NAV = [
  { to: '/pedidos', label: 'Pedidos', icon: '🧾', roles: ['admin', 'manager', 'staff', 'kitchen'], countKey: 'pedidos' },
  { to: '/cargar-pedido', label: 'Cargar pedido', icon: '✍️', roles: ['admin', 'manager', 'staff'] },
  { to: '/cocina', label: 'Cocina', icon: '🔥', roles: ['admin', 'manager', 'kitchen'] },
  { to: '/mesas', label: 'Mesas', icon: '🗺️', roles: ['admin', 'manager', 'staff'] },
  { to: '/asistencia', label: 'Asistencia', icon: '🔔', roles: ['admin', 'manager', 'staff'], countKey: 'asistencia' },
  { to: '/ventas', label: 'Ventas', icon: '💰', roles: ['admin', 'manager'] },
  { to: '/historial', label: 'Historial', icon: '📜', roles: ['admin', 'manager'] },
  { to: '/productos', label: 'Productos', icon: '🥐', roles: ['admin', 'manager'] },
];

export default function Layout() {
  const { staff, restaurant, isPlatformAdmin, signOut } = useAuth();
  const role = staff?.role;
  const [counts, setCounts] = useState({ pedidos: 0, asistencia: 0 });

  useEffect(() => {
    if (!restaurant) return;
    async function load() {
      const { count: pedidos } = await dinein().from('orders').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id).eq('status', 'confirmed');
      const { count: asist } = await dinein().from('assistance_requests').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id).eq('status', 'pending');
      const { count: bills } = await dinein().from('bill_requests').select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id).eq('status', 'pending');
      setCounts({ pedidos: pedidos || 0, asistencia: (asist || 0) + (bills || 0) });
    }
    load();
    const channel = supabase.channel('nav-counts-' + restaurant.id)
      .on('postgres_changes', { event: '*', schema: 'dinein', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'dinein', table: 'assistance_requests', filter: `restaurant_id=eq.${restaurant.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'dinein', table: 'bill_requests', filter: `restaurant_id=eq.${restaurant.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurant]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-mark">Panel<span>·</span></div>
        <div className="sidebar-restaurant">{restaurant?.name || '…'}</div>
        <nav>
          {NAV.filter((n) => n.roles.includes(role)).map((n) => {
            const badge = n.countKey ? counts[n.countKey] : 0;
            return (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
                <span className="nav-icon">{n.icon}</span>{n.label}
                {badge > 0 && <span className="nav-badge">{badge}</span>}
              </NavLink>
            );
          })}
          {isPlatformAdmin && (
            <NavLink to="/nuevo-cliente" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
              <span className="nav-icon">➕</span>Nuevo cliente
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-role">{staff?.full_name || 'Staff'} · {role}</div>
          <button className="signout-btn" onClick={signOut}>Salir</button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
