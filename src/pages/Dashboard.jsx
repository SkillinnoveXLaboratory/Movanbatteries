import { useEffect, useState } from 'react';
import { AlertCircle, BatteryCharging, CheckCircle2, Clock3, IndianRupee, Package, RefreshCw, Wrench } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { api } from '../lib/api';
import { ErrorState, LoadingState } from '../components/DataState';

const colors = ['#4d7cfe', '#ffb236', '#a162f7', '#00bcd4', '#ff4069'];
const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(value || 0);
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [summary, service, business, recent, stock] = await Promise.all([
        api('/dashboard/summary'), api('/dashboard/service-stats'), api('/business/dashboard'), api('/dashboard/recent-service-cases'), api('/products/stock-low'),
      ]);
      setData({ summary: summary.data, service: service.data, business: business.data, recent: recent.data, lowStock: stock.data });
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  if (loading) return <LoadingState label="Preparing command overview" />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  const chartData = [
    { name: 'Pending', value: data.summary.pending }, { name: 'In service', value: data.summary.inService },
    { name: 'Replacement', value: data.summary.replacement }, { name: 'Ready', value: data.summary.ready }, { name: 'Delivered', value: data.summary.delivered },
  ].filter((item) => item.value > 0);
  const kpis = [
    { label: 'Service cases', value: formatNumber(data.service.totalServiceCases), icon: Wrench, tone: 'teal' },
    { label: 'Pending attention', value: formatNumber(data.service.pendingCases), icon: Clock3, tone: 'amber' },
    { label: 'Total products', value: formatNumber(data.business.totalProducts), icon: Package, tone: 'blue' },
    { label: 'Low stock', value: formatNumber(data.business.lowStockProducts), icon: AlertCircle, tone: 'pink' },
  ];

  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">Live operational intelligence</p><h1>Good morning, Admin</h1><p>Here is what needs your attention across Movan today.</p></div><button className="button button-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
    <section className="hero-card">
      <div><span className="hero-kicker">MOVAN BATTERIES / CONTROL DESK</span><h2>Operations are visible.<br />Decisions stay fast.</h2><p>{data.summary.pending} service cases are waiting in the current queue.</p></div>
      <div className="hero-metric"><BatteryCharging /><strong>{data.summary.total}</strong><span>active service records</span></div>
    </section>
    <div className="kpi-grid">{kpis.map(({ label, value, icon: Icon, tone }) => <article className="card kpi-card" key={label}><div><span>{label}</span><strong>{value}</strong></div><div className={`kpi-icon tone-${tone}`}><Icon size={21} /></div></article>)}</div>
    <div className="dashboard-grid">
      <section className="card chart-card"><div className="section-heading"><div><p className="eyebrow">Service flow</p><h2>Case distribution</h2></div><span className="live-chip">Live</span></div>{chartData.length ? <div className="donut-layout"><div className="donut-wrap"><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95} paddingAngle={3}>{chartData.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{data.summary.total}</strong><span>Total</span></div></div><div className="chart-legend">{chartData.map((item, index) => <div key={item.name}><i style={{ background: colors[index % colors.length] }} /><span>{item.name}</span><strong>{item.value}</strong></div>)}</div></div> : <p className="muted">No service cases yet.</p>}</section>
      <section className="card finance-card"><div className="section-heading"><div><p className="eyebrow">Business pulse</p><h2>Revenue and spend</h2></div><IndianRupee /></div><div className="finance-row"><span>Gross sales</span><strong>{money(data.business.totalSales)}</strong><small>{formatNumber(data.business.totalSalesCount)} transactions</small></div><div className="finance-row"><span>Operating expenses</span><strong>{money(data.business.totalExpenses)}</strong><small>{formatNumber(data.business.totalExpensesCount)} records</small></div><div className={`net-result ${(data.business.totalSales - data.business.totalExpenses) >= 0 ? 'positive' : 'negative'}`}><span>Net position</span><strong>{money(data.business.totalSales - data.business.totalExpenses)}</strong></div></section>
    </div>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent service cases</h2></div></div><div className="activity-list">{data.recent.map((item) => <article key={item._id}><div className="activity-icon"><BatteryCharging size={18} /></div><div><strong>{item.customerId?.name || 'Customer'} · {item.batterySerialNumber}</strong><span>{item.problemDescription}</span></div><span className={`status-pill status-${item.batteryStatus}`}>{item.batteryStatus?.replaceAll('_', ' ')}</span></article>)}{!data.recent.length && <div className="state-panel"><CheckCircle2 /><strong>No recent cases</strong></div>}</div></section>
  </div>;
}

