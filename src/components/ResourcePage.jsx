import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { api, queryString } from '../lib/api';
import { labels } from '../config/resources';
import Modal from './Modal';
import { EmptyState, ErrorState, LoadingState } from './DataState';

const dateKeys = new Set(['createdAt', 'updatedAt', 'purchaseDate', 'saleDate', 'date', 'serviceRequestDate']);
const moneyKeys = new Set(['amount', 'totalAmount', 'unitPrice', 'unitCost', 'outstandingBalance']);

function getRecordId(value) {
  return typeof value === 'object' && value !== null ? value._id || '' : value || '';
}

function displayObject(value) {
  return value.name || value.productName || value.serialNumber || value.batterySerialNumber || value.mobileNumber || value._id || 'Record';
}

function buildCustomerOptions(customers) {
  return customers
    .map((customer) => ({
      value: customer._id,
      label: customer.mobileNumber ? `${customer.name} - ${customer.mobileNumber}` : customer.name,
    }))
    .filter((customer) => customer.value && customer.label);
}

function buildShopOptions(shops) {
  return shops
    .map((shop) => ({
      value: shop._id,
      label: shop.branchCode ? `${shop.name} - ${shop.branchCode}` : shop.name,
    }))
    .filter((shop) => shop.value && shop.label);
}

function buildProductOptions(products) {
  return products
    .map((product) => ({
      value: product._id,
      label: [product.productName, product.brand, product.productCode].filter(Boolean).join(' - '),
    }))
    .filter((product) => product.value && product.label);
}

function buildDealerOptions(dealers) {
  return dealers
    .map((dealer) => ({
      value: dealer._id,
      label: [dealer.name, dealer.mobile || dealer.contactPerson].filter(Boolean).join(' - '),
    }))
    .filter((dealer) => dealer.value && dealer.label);
}

function buildShopLookup(shops) {
  return shops.reduce((lookup, shop) => {
    if (!shop?._id) return lookup;
    lookup[shop._id] = shop.name || shop.branchCode || shop._id;
    return lookup;
  }, {});
}

function buildLookup(records, labelBuilder) {
  return records.reduce((lookup, record) => {
    if (!record?._id) return lookup;
    lookup[record._id] = labelBuilder(record);
    return lookup;
  }, {});
}

function normalizeLineItems(value, field) {
  const priceField = field.priceField || 'unitPrice';
  const items = Array.isArray(value) ? value : [];
  const normalized = items.map((item) => ({
    productId: getRecordId(item?.productId),
    quantity: item?.quantity ?? '',
    [priceField]: item?.[priceField] ?? '',
  }));
  return normalized.length ? normalized : [{ productId: '', quantity: '', [priceField]: '' }];
}

function displayReference(value, key, referenceLookup = {}) {
  if (!value) return displayValue(value, key);
  if (typeof value === 'object') return displayObject(value);
  return referenceLookup[key]?.[value] || value;
}

function renderNoteList(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return <span className="muted">No notes yet.</span>;
  return <div className="remarks-list">{notes.map((note, index) => <div className="remark-item" key={note?._id || `${index}-${note?.content || 'note'}`}><p>{note?.content || 'No note content available.'}</p></div>)}</div>;
}

function renderLineItems(items, productLookup = {}) {
  if (!Array.isArray(items) || items.length === 0) return <span className="muted">No items added.</span>;
  return <div className="line-item-summary">{items.map((item, index) => {
    const productId = getRecordId(item?.productId);
    const productName = typeof item?.productId === 'object' ? displayObject(item.productId) : productLookup[productId] || productId || 'Unknown product';
    const price = item?.unitCost ?? item?.unitPrice;
    return <div className="line-item-summary-row" key={item?._id || `${productId}-${index}`}>
      <div>
        <span>Item {index + 1}</span>
        <strong>{productName}</strong>
      </div>
      <div>
        <span>Quantity</span>
        <strong>{displayValue(item?.quantity, 'quantity')}</strong>
      </div>
      <div>
        <span>{item?.unitCost !== undefined ? 'Unit cost' : 'Unit price'}</span>
        <strong>{displayValue(price, item?.unitCost !== undefined ? 'unitCost' : 'unitPrice')}</strong>
      </div>
    </div>;
  })}</div>;
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function renderCustomerProfile(customer, shopLookup = {}) {
  if (!customer || typeof customer !== 'object' || Array.isArray(customer)) return displayValue(customer, 'customer');

  const vehicles = Array.isArray(customer.vehicleNumbers) ? customer.vehicleNumbers.filter(Boolean) : [];
  const tags = Array.isArray(customer.tags) ? customer.tags.filter(Boolean) : [];
  const notes = Array.isArray(customer.notes) ? customer.notes : [];
  const shopId = typeof customer.shopId === 'object' ? customer.shopId?._id : customer.shopId;
  const shopName = typeof customer.shopId === 'object'
    ? customer.shopId?.name || customer.shopId?.branchCode || customer.shopId?._id
    : shopLookup[shopId] || shopId;

  return <div className="customer-card">
    <div className="customer-card-head">
      <div>
        <span>Customer profile</span>
        <strong>{customer.name || 'Unnamed customer'}</strong>
        <small>{customer.mobileNumber || 'No mobile number'}</small>
      </div>
      {customer._id && <code>{customer._id}</code>}
    </div>
    <div className="customer-card-grid">
      <div>
        <span>Mobile</span>
        <strong>{customer.mobileNumber || <span className="muted">Not set</span>}</strong>
      </div>
      <div>
        <span>Address</span>
        <strong>{customer.address || <span className="muted">Not set</span>}</strong>
      </div>
      <div>
        <span>Vehicles</span>
        <strong>{vehicles.length ? vehicles.join(', ') : <span className="muted">None</span>}</strong>
      </div>
      <div>
        <span>Tags</span>
        <strong>{tags.length ? <div className="chip-wrap">{tags.map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}</div> : <span className="muted">None</span>}</strong>
      </div>
    </div>
    <div className="customer-card-grid customer-card-grid-compact">
      <div>
        <span>Shop</span>
        <strong>{shopName || <span className="muted">Not set</span>}</strong>
      </div>
      <div>
        <span>Created</span>
        <strong>{formatDateTime(customer.createdAt) || <span className="muted">Not set</span>}</strong>
      </div>
      <div>
        <span>Updated</span>
        <strong>{formatDateTime(customer.updatedAt) || <span className="muted">Not set</span>}</strong>
      </div>
      <div>
        <span>Notes</span>
        <strong>{notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'}` : <span className="muted">None</span>}</strong>
      </div>
    </div>
    {notes.length > 0 && <div className="detail-block"><span>Remarks</span>{renderNoteList(notes)}</div>}
  </div>;
}

function displayValue(value, key) {
  if (value === undefined || value === null || value === '') return <span className="muted">Not set</span>;
  if (typeof value === 'boolean') return <span className={`status-pill ${value ? 'status-positive' : 'status-neutral'}`}>{value ? 'Yes' : 'No'}</span>;
  if (dateKeys.has(key)) return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  if (moneyKeys.has(key)) return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  if (Array.isArray(value)) return value.length ? (value.length <= 3 && value.every((item) => typeof item !== 'object') ? value.join(', ') : `${value.length} item${value.length === 1 ? '' : 's'}`) : <span className="muted">None</span>;
  if (typeof value === 'object') return displayObject(value);
  if (key === 'status' || key === 'batteryStatus' || key === 'paymentStatus' || key === 'role') return <span className={`status-pill status-${String(value).toLowerCase().replaceAll('_', '-')}`}>{String(value).replaceAll('_', ' ')}</span>;
  return String(value);
}

function inputValue(record, field) {
  const value = record?.[field.name];
  if (field.type === 'date' && value) return String(value).slice(0, 10);
  if (field.type === 'json') return value ? JSON.stringify(value, null, 2) : '';
  if (field.type === 'lineItems') return normalizeLineItems(value, field);
  if (field.type === 'tags') return Array.isArray(value) ? value.join(', ') : '';
  if (typeof value === 'object' && value !== null) return value._id || '';
  return value ?? '';
}

function ResourceForm({ config, record, onSubmit, onCancel, busy, referenceOptions = {}, referenceLoading = {} }) {
  const activeFields = config.fields.filter((item) => !(record && item.createOnly));
  const [values, setValues] = useState(() => Object.fromEntries(activeFields.map((item) => [item.name, inputValue(record, item)])));
  const [formError, setFormError] = useState('');
  const updateValue = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  const addLineItem = (field) => {
    const priceField = field.priceField || 'unitPrice';
    updateValue(field.name, [...(Array.isArray(values[field.name]) ? values[field.name] : []), { productId: '', quantity: '', [priceField]: '' }]);
  };

  const updateLineItem = (field, index, key, value) => {
    const rows = Array.isArray(values[field.name]) ? values[field.name] : normalizeLineItems([], field);
    updateValue(field.name, rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)));
  };

  const removeLineItem = (field, index) => {
    const remaining = (Array.isArray(values[field.name]) ? values[field.name] : []).filter((_, rowIndex) => rowIndex !== index);
    updateValue(field.name, remaining.length ? remaining : normalizeLineItems([], field));
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    try {
      const body = {};
      activeFields.forEach((item) => {
        let value = values[item.name];
        if (value === '' && !item.required) return;
        if (item.type === 'number') value = Number(value);
        if (item.type === 'tags') value = value.split(',').map((part) => part.trim()).filter(Boolean);
        if (item.type === 'json') value = JSON.parse(value);
        if (item.type === 'lineItems') {
          const priceField = item.priceField || 'unitPrice';
          value = (Array.isArray(value) ? value : [])
            .map((row) => ({
              productId: getRecordId(row.productId),
              quantity: Number(row.quantity),
              [priceField]: Number(row[priceField]),
            }))
            .filter((row) => row.productId && Number.isFinite(row.quantity) && row.quantity > 0 && Number.isFinite(row[priceField]) && row[priceField] >= 0);
          if (item.required && value.length === 0) throw new Error('Add at least one valid item with product, quantity, and price.');
        }
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        body[item.name] = value;
      });
      await onSubmit(body);
    } catch (error) {
      setFormError(error instanceof SyntaxError ? 'Items are not valid.' : error.message);
    }
  };

  return <form onSubmit={submit}>
    <div className="form-grid">
      {activeFields.map((item) => item.type === 'lineItems' ? <div key={item.name} className="field-wide line-items-field">
        <div className="line-items-head">
          <span>{item.label}{item.required && ' *'}</span>
          <button type="button" className="button button-secondary" onClick={() => addLineItem(item)}>Add item</button>
        </div>
        <div className="line-items-editor">
          {(Array.isArray(values[item.name]) ? values[item.name] : normalizeLineItems([], item)).map((row, index) => {
            const priceField = item.priceField || 'unitPrice';
            return <div className="line-item-editor-row" key={`${item.name}-${index}`}>
              <label>
                <span>Product</span>
                <select required={item.required} value={row.productId || ''} onChange={(event) => updateLineItem(item, index, 'productId', event.target.value)}>
                  <option value="">{referenceLoading.productId ? 'Loading products...' : 'Select product'}</option>
                  {(referenceOptions.productId || []).map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span>Quantity</span>
                <input type="number" min="1" required={item.required} value={row.quantity} onChange={(event) => updateLineItem(item, index, 'quantity', event.target.value)} />
              </label>
              <label>
                <span>{item.priceLabel || 'Unit price'}</span>
                <input type="number" min="0" step="0.01" required={item.required} value={row[priceField]} onChange={(event) => updateLineItem(item, index, priceField, event.target.value)} />
              </label>
              <button type="button" className="button button-danger-soft line-item-remove" onClick={() => removeLineItem(item, index)}>Remove</button>
            </div>;
          })}
        </div>
      </div> : <label key={item.name} className={item.type === 'textarea' || item.type === 'json' ? 'field-wide' : ''}>
        <span>{item.label}{item.required && ' *'}</span>
        {item.type === 'select' ? <select required={item.required} value={values[item.name]} onChange={(event) => updateValue(item.name, event.target.value)}>
          <option value="">{referenceLoading[item.name] ? `Loading ${item.label.toLowerCase()}...` : `Select ${item.label.toLowerCase()}`}</option>
          {(item.options || referenceOptions[item.name] || []).map((option) => {
            const normalized = typeof option === 'object' ? option : { value: option, label: String(option).replaceAll('_', ' ') };
            return <option key={String(normalized.value)} value={String(normalized.value)}>{normalized.label}</option>;
          })}
        </select> : item.type === 'textarea' || item.type === 'json' ? <textarea rows={item.type === 'json' ? 6 : 3} required={item.required} placeholder={item.placeholder} value={values[item.name]} onChange={(event) => updateValue(item.name, event.target.value)} /> : <input type={item.type === 'tags' ? 'text' : item.type} required={item.required} placeholder={item.placeholder} value={values[item.name]} onChange={(event) => updateValue(item.name, event.target.value)} />}
      </label>)}
    </div>
    {formError && <div className="inline-error">{formError}</div>}
    <footer className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving...' : record ? 'Save changes' : `Create ${config.title.replace(/s$/, '').toLowerCase()}`}</button></footer>
  </form>;
}

function RecordDetails({ record, shopLookup, referenceLookup }) {
  return <div className="detail-list">{Object.entries(record).filter(([key]) => !['__v'].includes(key)).map(([key, value]) => <div className="detail-row" key={key}><span>{labels[key] || key.replace(/([A-Z])/g, ' $1')}</span><div className="detail-value">{(key === 'customer' || key === 'customerId') && value && typeof value === 'object' && !Array.isArray(value) ? renderCustomerProfile(value, shopLookup) : key === 'items' ? renderLineItems(value, referenceLookup.productId) : key === 'notes' ? renderNoteList(value) : ['dealerId', 'shopId', 'customerId'].includes(key) ? displayReference(value, key, referenceLookup) : typeof value === 'object' && value !== null && !Array.isArray(value) ? <div className="object-view">{Object.entries(value).filter(([innerKey]) => innerKey !== '__v').slice(0, 12).map(([innerKey, innerValue]) => <div key={innerKey}><span>{labels[innerKey] || innerKey.replace(/([A-Z])/g, ' $1')}</span><strong>{displayValue(innerValue, innerKey)}</strong></div>)}</div> : Array.isArray(value) && value.some((item) => typeof item === 'object') ? <div className="object-view">{value.slice(0, 6).map((item, index) => <div key={item?._id || index}><span>Item {index + 1}</span><strong>{displayObject(item)}</strong></div>)}</div> : displayValue(value, key)}</div></div>)}</div>;
}

export default function ResourcePage({ config }) {
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [referenceOptions, setReferenceOptions] = useState({});
  const [referenceLoading, setReferenceLoading] = useState({});
  const [shopLookup, setShopLookup] = useState({});
  const [referenceLookup, setReferenceLookup] = useState({});

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const payload = await api(`${config.endpoint}${queryString({ page, limit: 10, search: query })}`);
      setRecords(Array.isArray(payload.data) ? payload.data : []);
      setMeta(payload.meta || { page, totalPages: 1, total: payload.data?.length || 0 });
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [config.endpoint, page, query]);

  useEffect(() => {
    let active = true;
    const sources = new Set(config.fields.flatMap((field) => {
      const fieldSources = [];
      if (field.optionsSource) fieldSources.push(field.optionsSource);
      if (field.type === 'lineItems') fieldSources.push('products');
      return fieldSources;
    }));
    const loadShopLookup = sources.has('shops') || config.endpoint === '/batteries';
    const loadingState = {};
    if (sources.has('customers')) loadingState.customerId = true;
    if (sources.has('shops')) loadingState.shopId = true;
    if (sources.has('dealers')) loadingState.dealerId = true;
    if (sources.has('products')) loadingState.productId = true;
    setReferenceLoading(loadingState);

    if (!sources.size && !loadShopLookup) {
      setReferenceOptions({});
      setReferenceLoading({});
      setShopLookup({});
      setReferenceLookup({});
      return () => { active = false; };
    }

    Promise.all([
      sources.has('customers') ? api('/customers?page=1&limit=500').catch(() => ({ data: [] })) : Promise.resolve(null),
      sources.has('dealers') ? api('/dealers?page=1&limit=500').catch(() => ({ data: [] })) : Promise.resolve(null),
      sources.has('products') ? api('/products?page=1&limit=500').catch(() => ({ data: [] })) : Promise.resolve(null),
      loadShopLookup ? api('/shops?page=1&limit=500').catch(() => ({ data: [] })) : Promise.resolve(null),
    ]).then(([customersPayload, dealersPayload, productsPayload, shopsPayload]) => {
      if (!active) return;
      const customers = Array.isArray(customersPayload?.data) ? customersPayload.data : [];
      const dealers = Array.isArray(dealersPayload?.data) ? dealersPayload.data : [];
      const products = Array.isArray(productsPayload?.data) ? productsPayload.data : [];
      const shops = Array.isArray(shopsPayload?.data) ? shopsPayload.data : [];
      setReferenceOptions((current) => ({
        ...current,
        ...(sources.has('customers') ? { customerId: buildCustomerOptions(customers) } : {}),
        ...(sources.has('shops') ? { shopId: buildShopOptions(shops) } : {}),
        ...(sources.has('dealers') ? { dealerId: buildDealerOptions(dealers) } : {}),
        ...(sources.has('products') ? { productId: buildProductOptions(products) } : {}),
      }));
      setReferenceLookup((current) => ({
        ...current,
        ...(sources.has('customers') ? { customerId: buildLookup(customers, (customer) => (customer.mobileNumber ? `${customer.name} - ${customer.mobileNumber}` : customer.name || customer._id)) } : {}),
        ...(sources.has('shops') ? { shopId: buildLookup(shops, (shop) => shop.branchCode ? `${shop.name} - ${shop.branchCode}` : shop.name || shop._id) } : {}),
        ...(sources.has('dealers') ? { dealerId: buildLookup(dealers, (dealer) => [dealer.name, dealer.mobile || dealer.contactPerson].filter(Boolean).join(' - ') || dealer._id) } : {}),
        ...(sources.has('products') ? { productId: buildLookup(products, (product) => [product.productName, product.brand, product.productCode].filter(Boolean).join(' - ') || product._id) } : {}),
      }));
      if (loadShopLookup) setShopLookup(buildShopLookup(shops));
    }).finally(() => {
      if (!active) return;
      setReferenceLoading({
        ...(sources.has('customers') ? { customerId: false } : {}),
        ...(sources.has('shops') ? { shopId: false } : {}),
        ...(sources.has('dealers') ? { dealerId: false } : {}),
        ...(sources.has('products') ? { productId: false } : {}),
      });
    });

    return () => { active = false; };
  }, [config.endpoint]);

  useEffect(() => {
    if (modal?.type !== 'view' || !modal.record) {
      setDetailRecord(null);
      setDetailLoading(false);
      setDetailError('');
      return;
    }

    if (config.endpoint !== '/customers') {
      setDetailRecord(modal.record);
      setDetailLoading(false);
      setDetailError('');
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError('');
    api(`${config.endpoint}/${modal.record._id}`)
      .then((payload) => {
        if (!active) return;
        setDetailRecord(payload.data || modal.record);
      })
      .catch((requestError) => {
        if (!active) return;
        setDetailError(requestError.message);
        setDetailRecord(modal.record);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => { active = false; };
  }, [config.endpoint, modal]);

  const save = async (body) => {
    setBusy(true);
    try {
      const editing = modal?.type === 'edit';
      await api(editing ? `${config.endpoint}/${modal.record._id}` : config.endpoint, { method: editing ? 'PATCH' : 'POST', body });
      setModal(null); setNotice(editing ? 'Changes saved successfully.' : 'Record created successfully.'); await load();
    } catch (requestError) { setNotice(requestError.message); throw requestError; }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await api(`${config.endpoint}/${modal.record._id}`, { method: 'DELETE' }); setModal(null); setNotice('Record deleted successfully.'); await load(); }
    catch (requestError) { setNotice(requestError.message); }
    finally { setBusy(false); }
  };

  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">{config.eyebrow}</p><h1>{config.title}</h1><p>Live administration data from the Movan platform.</p></div>{config.create && <button className="button button-primary" onClick={() => setModal({ type: 'create' })}><Plus size={17} /> Add new</button>}</div>
    {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
    <section className="card table-card">
      <div className="table-toolbar"><div className="search-box"><Search size={17} /><input aria-label={`Search ${config.title}`} value={query} placeholder={`Search ${config.title.toLowerCase()}...`} onChange={(event) => { setPage(1); setQuery(event.target.value); }} /></div><button className="button button-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
      {loading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={load} /> : records.length === 0 ? <EmptyState /> : <div className="table-scroll"><table><thead><tr>{config.columns.map((column) => <th key={column}>{labels[column] || column}</th>)}<th className="actions-column">Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record._id}>{config.columns.map((column) => <td key={column}>{displayValue(record[column], column)}</td>)}<td><div className="row-actions"><button className="action-button action-view" title="View" onClick={() => setModal({ type: 'view', record })}><Eye size={16} /><span>View</span></button>{config.edit && <button className="action-button action-edit" title="Edit" onClick={() => setModal({ type: 'edit', record })}><Pencil size={16} /><span>Edit</span></button>}{config.delete && <button className="action-button action-delete" title="Delete" onClick={() => setModal({ type: 'delete', record })}><Trash2 size={16} /><span>Delete</span></button>}</div></td></tr>)}</tbody></table></div>}
      {!loading && !error && <div className="pagination"><span>{meta.total ?? records.length} total records</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button><span>Page {meta.page || page} of {Math.max(meta.totalPages || 1, 1)}</span><button disabled={page >= (meta.totalPages || 1)} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></div>}
    </section>
    {modal?.type === 'view' && <Modal title={`${config.title.replace(/s$/, '')} details`} size="large" onClose={() => setModal(null)}>{detailLoading ? <div className="state-panel"><strong>Loading customer details...</strong><span>Fetching the full record from the live API.</span></div> : detailError ? <div className="state-panel state-error"><strong>Could not load full details</strong><span>{detailError}</span></div> : <RecordDetails record={detailRecord || modal.record} shopLookup={shopLookup} referenceLookup={referenceLookup} />}</Modal>}
    {(modal?.type === 'create' || modal?.type === 'edit') && <Modal title={modal.type === 'edit' ? `Edit ${config.title.replace(/s$/, '').toLowerCase()}` : `Create ${config.title.replace(/s$/, '').toLowerCase()}`} subtitle="Required fields are marked with an asterisk." size="large" onClose={() => setModal(null)}><ResourceForm config={config} record={modal.record} onSubmit={save} onCancel={() => setModal(null)} busy={busy} referenceOptions={referenceOptions} referenceLoading={referenceLoading} /></Modal>}
    {modal?.type === 'delete' && <Modal title="Confirm deletion" onClose={() => setModal(null)}><div className="danger-copy"><Trash2 /><p>This permanently removes the selected record. This action cannot be undone.</p></div><footer className="modal-actions"><button className="button button-quiet" onClick={() => setModal(null)}>Cancel</button><button className="button button-danger" disabled={busy} onClick={remove}>{busy ? 'Deleting...' : 'Delete permanently'}</button></footer></Modal>}
  </div>;
}
