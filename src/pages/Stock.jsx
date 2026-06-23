import { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Boxes, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import { ErrorState, LoadingState } from '../components/DataState';

export default function Stock() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [products, setProducts] = useState([]);

  const load = async () => {
    try {
      const [stock, movements, productList] = await Promise.all([
        api('/stock/current'),
        api('/stock/movements'),
        api('/products?page=1&limit=500'),
      ]);
      setData({ stock: stock.data || [], movements: movements.data || [] });
      setProducts(Array.isArray(productList.data) ? productList.data : []);
      setError(null);
    } catch (requestError) {
      setError(requestError);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    values.quantity = Number(values.quantity);
    try {
      await api(`/stock/${modal.type}`, { method: 'POST', body: values });
      setNotice(`Stock ${modal.type === 'in' ? 'received' : 'issued'} successfully.`);
      setModal(null);
      await load();
    } catch (requestError) {
      setNotice(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data && !error) return <LoadingState label="Counting inventory" />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return <div className="page-stack">
    <div className="page-heading">
      <div>
        <p className="eyebrow">Inventory command</p>
        <h1>Stock Management</h1>
        <p>Current balances and an immutable movement trail.</p>
      </div>
      <div className="heading-actions">
        <button className="button button-positive" onClick={() => setModal({ type: 'in' })}><ArrowDownToLine size={17} /> Stock in</button>
        <button className="button button-danger-soft" onClick={() => setModal({ type: 'out' })}><ArrowUpFromLine size={17} /> Stock out</button>
      </div>
    </div>

    {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}

    <div className="stock-grid">
      {data.stock.map((item) => {
        const percent = Math.min(100, Math.round((item.currentStock / Math.max(item.minStockLevel * 3, 1)) * 100));
        return <article className="card stock-card" key={item._id}>
          <div className="stock-card-top">
            <div className="stock-icon"><Boxes /></div>
            <span className={item.currentStock <= item.minStockLevel ? 'danger-text' : 'positive-text'}>
              {item.currentStock <= item.minStockLevel ? 'Low stock' : 'Healthy'}
            </span>
          </div>
          <h3>{item.productName}</h3>
          <p>{item.productCode} · {item.brand}</p>
          <div className="stock-count">
            <strong>{item.currentStock}</strong>
            <span>units / minimum {item.minStockLevel}</span>
          </div>
          <div className="stock-meter"><i style={{ width: `${percent}%` }} /></div>
        </article>;
      })}
    </div>

    <section className="card table-card">
      <div className="table-toolbar">
        <div>
          <p className="eyebrow">Ledger</p>
          <h2>Recent movements</h2>
        </div>
        <button className="button button-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Movement</th>
              <th>Quantity</th>
              <th>Remarks</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {data.movements.map((item) => (
              <tr key={item._id}>
                <td>{new Date(item.createdAt).toLocaleDateString('en-IN')}</td>
                <td><strong>{item.productId?.productName || item.productId}</strong><small>{item.productId?.productCode}</small></td>
                <td><span className={`status-pill status-${item.type}`}>{item.type.replaceAll('_', ' ')}</span></td>
                <td className={item.quantity >= 0 ? 'positive-text' : 'danger-text'}><strong>{item.quantity > 0 ? '+' : ''}{item.quantity}</strong></td>
                <td>{item.remarks || 'System movement'}</td>
                <td className="id-cell">{item.referenceId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    {modal && <Modal title={modal.type === 'in' ? 'Receive stock' : 'Issue stock'} subtitle="This creates a permanent stock movement." onClose={() => setModal(null)}>
      <form onSubmit={submit}>
        <div className="form-grid form-grid-single">
          <label>
            <span>Product *</span>
            <select name="productId" required defaultValue="">
              <option value="" disabled>Select a product</option>
              {products.map((product) => (
                <option key={product._id} value={product._id}>
                  {product.productName}{product.brand ? ` · ${product.brand}` : ''}{product.productCode ? ` · ${product.productCode}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Quantity *</span>
            <input name="quantity" type="number" min="1" required />
          </label>
          <label>
            <span>Remarks *</span>
            <textarea name="remarks" rows="3" required />
          </label>
        </div>
        <footer className="modal-actions">
          <button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancel</button>
          <button className={`button ${modal.type === 'in' ? 'button-positive' : 'button-danger'}`} disabled={busy}>
            {busy ? 'Recording...' : modal.type === 'in' ? 'Receive stock' : 'Issue stock'}
          </button>
        </footer>
      </form>
    </Modal>}
  </div>;
}
