import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api, queryString } from '../lib/api';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState';

export default function SearchResults() {
  const [params] = useSearchParams(); const query = params.get('q') || ''; const [result, setResult] = useState(null); const [error, setError] = useState(null);
  const load = async () => { setResult(null); try { const payload = await api(`/search/global${queryString({ q: query })}`); setResult(payload.data); setError(null); } catch (err) { setError(err); } };
  useEffect(() => { load(); }, [query]);
  const groups = result && !Array.isArray(result) ? Object.entries(result).filter(([, records]) => Array.isArray(records)) : [['Results', result || []]];
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">Global lookup</p><h1>Search Results</h1><p>Matches for “{query}” across Movan records.</p></div></div>{!result && !error ? <LoadingState /> : error ? <ErrorState error={error} onRetry={load} /> : groups.every(([, records]) => !records.length) ? <EmptyState title="No matching records" message="Try a mobile number, vehicle number, battery serial, or invoice." /> : <div className="search-results-grid">{groups.map(([name, records]) => records.length > 0 && <section className="card" key={name}><div className="section-heading"><div><p className="eyebrow">{records.length} matches</p><h2>{name.replace(/([A-Z])/g, ' $1')}</h2></div><Search size={18} /></div><div className="result-list">{records.map((record, index) => <article key={record._id || index}><strong>{record.name || record.batterySerialNumber || record.invoiceNumber || record.title || 'Record'}</strong><span>{record.mobileNumber || record.vehicleNumber || record.batteryModel || record.problemDescription || record._id}</span></article>)}</div></section>)}</div>}</div>;
}

