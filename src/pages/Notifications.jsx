import { useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState';

export default function Notifications() {
  const [records, setRecords] = useState(null); const [error, setError] = useState(null); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const load = async () => { try { const payload = await api('/notifications'); setRecords(payload.data || []); setError(null); } catch (err) { setError(err); } };
  useEffect(() => { load(); }, []);
  const markAll = async () => { setBusy(true); try { await api('/notifications/read-all', { method: 'PATCH' }); setNotice('All notifications marked as read.'); await load(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">Administrative inbox</p><h1>Notifications</h1><p>System and operational alerts addressed to your account.</p></div><div className="heading-actions"><button className="button button-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button><button className="button button-primary" disabled={busy || !records?.length} onClick={markAll}><CheckCheck size={16} /> Mark all read</button></div></div>{notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}{!records && !error ? <LoadingState /> : error ? <ErrorState error={error} onRetry={load} /> : !records.length ? <EmptyState title="Inbox is clear" message="No administrative notifications are waiting." /> : <section className="card notification-list">{records.map((item) => <article className={item.isRead ? '' : 'unread'} key={item._id}><div><Bell size={18} /></div><div><strong>{item.title || item.type || 'Movan notification'}</strong><p>{item.message || item.content}</p><span>{new Date(item.createdAt).toLocaleString('en-IN')}</span></div></article>)}</section>}</div>;
}
