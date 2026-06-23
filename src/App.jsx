import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { BatteryCharging } from 'lucide-react';
import { api, getToken } from './lib/api';
import { resources } from './config/resources';
import Layout from './components/Layout';
import ResourcePage from './components/ResourcePage';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ServiceCases = lazy(() => import('./pages/ServiceCases'));
const Stock = lazy(() => import('./pages/Stock'));
const Reports = lazy(() => import('./pages/Reports'));
const BatteryFinder = lazy(() => import('./pages/BatteryFinder'));
const SystemCenter = lazy(() => import('./pages/SystemCenter'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const Notifications = lazy(() => import('./pages/Notifications'));

function NotFound() {
  return <div className="card not-found"><strong>404</strong><h1>This control does not exist.</h1><p>The requested admin route is not part of the Movan API surface.</p></div>;
}

export default function App() {
  const [session, setSession] = useState(getToken() ? 'checking' : 'anonymous');

  useEffect(() => {
    if (session !== 'checking') return;
    api('/auth/me').then(() => setSession('authenticated')).catch(() => setSession('anonymous'));
  }, [session]);

  if (session === 'checking') return <div className="boot-screen"><BatteryCharging /><strong>MOVAN CONTROL</strong><span>Verifying secure session...</span></div>;
  if (session === 'anonymous') return <Login onLogin={() => setSession('checking')} />;

  return <Layout onLogout={() => setSession('anonymous')}>
    <Suspense fallback={<div className="state-panel"><BatteryCharging /><strong>Opening admin section...</strong></div>}>
      <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/service-cases" element={<ServiceCases />} />
      <Route path="/stock" element={<Stock />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/battery-finder" element={<BatteryFinder />} />
      <Route path="/system" element={<SystemCenter />} />
      <Route path="/search" element={<SearchResults />} />
      <Route path="/notifications" element={<Notifications />} />
      {Object.entries(resources).map(([key, config]) => <Route key={key} path={`/${key === 'alertRules' ? 'alert-rules' : key}`} element={<ResourcePage config={config} />} />)}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </Layout>;
}
