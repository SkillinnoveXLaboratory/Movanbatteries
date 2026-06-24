import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Eye, Link2, MessageSquare, Pencil, Plus, RefreshCw, Search, Tag, Trash2, Upload } from 'lucide-react';
import { api, queryString } from '../lib/api';
import { labels } from '../config/resources';
import { prepareCustomerImportRows } from '../lib/customerImport';
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

function buildBatteryBrandOptions(brands) {
  return brands
    .filter((brand) => brand?.isActive !== false)
    .map((brand) => ({
      value: brand.name,
      label: brand.name,
      id: brand._id,
    }))
    .filter((brand) => brand.value && brand.label);
}

function buildBatteryModelOptions(models) {
  return models
    .filter((model) => model?.isActive !== false)
    .map((model) => ({
      value: model.modelName,
      label: model.brand ? `${model.modelName} - ${model.brand}` : model.modelName,
      brand: model.brand,
      id: model._id,
    }))
    .filter((model) => model.value && model.label);
}

function buildWarrantyPolicyLookup(policies) {
  return policies
    .filter((policy) => policy?.isActive !== false && policy.brand)
    .reduce((lookup, policy) => {
      lookup[policy.brand] = policy;
      return lookup;
    }, {});
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

function renderPermissionList(permissions) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return <span className="muted">No permissions assigned.</span>;
  }

  return (
    <div className="chip-wrap">
      {permissions.map((permission) => (
        <span key={permission} className="tag-chip tag-chip-soft">
          {permission}
        </span>
      ))}
    </div>
  );
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

function ResourceForm({ config, record, onSubmit, onCancel, busy, referenceOptions = {}, referenceLoading = {}, formId, showFooter = true, hiddenFields = [] }) {
  const hiddenFieldSet = new Set(hiddenFields);
  const activeFields = config.fields.filter((item) => !(record && item.createOnly) && !hiddenFieldSet.has(item.name));
  const [values, setValues] = useState(() => Object.fromEntries(activeFields.map((item) => [item.name, inputValue(record, item)])));
  const [formError, setFormError] = useState('');
  const updateValue = (name, value) => setValues((current) => ({ ...current, [name]: value }));

  const getOptions = (item) => {
    const options = item.options || referenceOptions[item.name] || [];
    if (!item.dependsOn || !item.optionFilterKey || !values[item.dependsOn]) return options;
    return options.filter((option) => {
      const normalized = typeof option === 'object' ? option : { value: option };
      return normalized[item.optionFilterKey] === values[item.dependsOn];
    });
  };

  const updateField = (item, value) => {
    setValues((current) => {
      const next = { ...current, [item.name]: value };
      (item.clears || []).forEach((fieldName) => {
        next[fieldName] = '';
      });
      if (item.name === 'batteryBrand') {
        const policy = referenceOptions.warrantyPoliciesByBrand?.[value];
        if (policy?.defaultWarrantyMonths && !current.warrantyPeriodMonths) {
          next.warrantyPeriodMonths = policy.defaultWarrantyMonths;
        }
      }
      return next;
    });
  };

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

  return <form id={formId} onSubmit={submit}>
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
        {item.type === 'select' ? <select required={item.required} value={values[item.name]} onChange={(event) => updateField(item, event.target.value)}>
          <option value="">{referenceLoading[item.name] ? `Loading ${item.label.toLowerCase()}...` : `Select ${item.label.toLowerCase()}`}</option>
          {getOptions(item).map((option) => {
            const normalized = typeof option === 'object' ? option : { value: option, label: String(option).replaceAll('_', ' ') };
            return <option key={String(normalized.value)} value={String(normalized.value)}>{normalized.label}</option>;
          })}
        </select> : item.type === 'textarea' || item.type === 'json' ? <textarea rows={item.type === 'json' ? 6 : 3} required={item.required} placeholder={item.placeholder} value={values[item.name]} onChange={(event) => updateValue(item.name, event.target.value)} /> : <input type={item.type === 'tags' ? 'text' : item.type} required={item.required} placeholder={item.placeholder} value={values[item.name]} onChange={(event) => updateValue(item.name, event.target.value)} />}
      </label>)}
    </div>
    {formError && <div className="inline-error">{formError}</div>}
    {showFooter && <footer className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving...' : record ? 'Save changes' : `Create ${config.title.replace(/s$/, '').toLowerCase()}`}</button></footer>}
  </form>;
}

function RecordDetails({ record, shopLookup, referenceLookup }) {
  const rolePermissions = Array.isArray(record.permissions) ? record.permissions : [];

  return <div className="detail-list">
    {Object.entries(record).filter(([key]) => !['__v'].includes(key)).map(([key, value]) => {
      const isRoleRecord = key === 'name' && rolePermissions.length > 0;
      return <div className="detail-row" key={key}>
        <span>{labels[key] || key.replace(/([A-Z])/g, ' $1')}</span>
        <div className="detail-value">
          {isRoleRecord ? <div className="role-detail-card"><strong>{String(value)}</strong><span>Role permissions</span></div> : (key === 'customer' || key === 'customerId') && value && typeof value === 'object' && !Array.isArray(value) ? renderCustomerProfile(value, shopLookup) : key === 'permissions' ? renderPermissionList(value) : key === 'items' ? renderLineItems(value, referenceLookup.productId) : key === 'notes' ? renderNoteList(value) : ['dealerId', 'shopId', 'customerId'].includes(key) ? displayReference(value, key, referenceLookup) : typeof value === 'object' && value !== null && !Array.isArray(value) ? <div className="object-view">{Object.entries(value).filter(([innerKey]) => innerKey !== '__v').slice(0, 12).map(([innerKey, innerValue]) => <div key={innerKey}><span>{labels[innerKey] || innerKey.replace(/([A-Z])/g, ' $1')}</span><strong>{displayValue(innerValue, innerKey)}</strong></div>)}</div> : Array.isArray(value) && value.some((item) => typeof item === 'object') ? <div className="object-view">{value.slice(0, 6).map((item, index) => <div key={item?._id || index}><span>Item {index + 1}</span><strong>{displayObject(item)}</strong></div>)}</div> : displayValue(value, key)}
        </div>
      </div>;
    })}
  </div>;
}

function CustomerWorkspace({ config, mode, record, shopLookup, onDelete, onClose, onSave, busy, referenceOptions, referenceLoading }) {
  const customerId = record?._id || '';
  const editFormId = customerId ? `customer-edit-form-${customerId}` : 'customer-edit-form';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customer, setCustomer] = useState(record || null);
  const [history, setHistory] = useState(null);
  const [batteries, setBatteries] = useState([]);
  const [serviceCases, setServiceCases] = useState([]);
  const [notes, setNotes] = useState([]);
  const [whatsappLink, setWhatsappLink] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [noteContent, setNoteContent] = useState('');
  const [tagText, setTagText] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const currentTags = Array.isArray(customer?.tags) ? customer.tags.filter(Boolean) : Array.isArray(record?.tags) ? record.tags.filter(Boolean) : [];

  const loadCustomerWorkspace = async () => {
    if (!customerId) return;
    setLoading(true);
    setError('');

    const safe = async (path, fallback) => {
      try {
        const payload = await api(path);
        return payload.data ?? fallback;
      } catch {
        return fallback;
      }
    };

    try {
      const [customerPayload, historyPayload, batteriesPayload, serviceCasesPayload, notesPayload, whatsappPayload] = await Promise.all([
        safe(`/customers/${customerId}`, null),
        safe(`/customers/${customerId}/history`, null),
        safe(`/customers/${customerId}/batteries`, []),
        safe(`/customers/${customerId}/service-cases`, []),
        safe(`/customers/${customerId}/notes`, []),
        safe(`/customers/${customerId}/whatsapp-link`, null),
      ]);

      const nextCustomer = customerPayload || historyPayload?.customer || record;
      setCustomer(nextCustomer);
      setHistory(historyPayload || null);
      setBatteries(Array.isArray(batteriesPayload) ? batteriesPayload : historyPayload?.batteries || []);
      setServiceCases(Array.isArray(serviceCasesPayload) ? serviceCasesPayload : historyPayload?.serviceCases || []);
      setNotes(Array.isArray(notesPayload) ? notesPayload : nextCustomer?.notes || []);
      setWhatsappLink(whatsappPayload?.whatsappLink || '');
      setActiveTab('overview');
      setNoteContent('');
      setTagText('');

      if (!customerPayload && !historyPayload) {
        setError('Could not load all customer details. Showing the available record.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== 'view' && mode !== 'edit') return;
    loadCustomerWorkspace();
    return undefined;
  }, [customerId, mode]);

  const refreshWorkspace = async () => {
    await loadCustomerWorkspace();
  };

  const addNote = async () => {
    const content = noteContent.trim();
    if (!content || !customerId) return;
    setActionBusy(true);
    setActionError('');
    try {
      await api(`/customers/${customerId}/notes`, { method: 'POST', body: { content } });
      setNoteContent('');
      await refreshWorkspace();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  const addTags = async () => {
    const tags = tagText.split(',').map((item) => item.trim()).filter(Boolean);
    if (!tags.length || !customerId) return;
    setActionBusy(true);
    setActionError('');
    try {
      for (const tag of tags) {
        await api(`/customers/${customerId}/tags`, { method: 'POST', body: { tag } });
      }
      setTagText('');
      await refreshWorkspace();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  const removeTag = async (tag) => {
    if (!customerId || !tag) return;
    setActionBusy(true);
    setActionError('');
    try {
      await api(`/customers/${customerId}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' });
      await refreshWorkspace();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  const openWhatsapp = async () => {
    setActionBusy(true);
    setActionError('');
    try {
      let link = whatsappLink;
      if (!link) {
        const payload = await api(`/customers/${customerId}/whatsapp-link`);
        link = payload.data?.whatsappLink || '';
        setWhatsappLink(link);
      }
      if (link) window.open(link, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  const copyWhatsapp = async () => {
    try {
      if (!whatsappLink) return;
      await navigator.clipboard.writeText(whatsappLink);
      setActionError('WhatsApp link copied to clipboard.');
    } catch (requestError) {
      setActionError(requestError.message);
    }
  };

  const renderTableRows = (rows, kind) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return <tr><td colSpan={kind === 'batteries' ? 5 : 5}><div className="state-panel"><strong>No records found</strong><span>This customer has no {kind.replace('-', ' ')} yet.</span></div></td></tr>;
    }

    if (kind === 'batteries') {
      return rows.map((item) => <tr key={item._id}><td><strong>{item.batterySerialNumber || item.serialNumber || '-'}</strong><small>{item.batteryBrand || item.brand} {item.batteryModel}</small></td><td>{displayValue(item.purchaseDate, 'purchaseDate')}</td><td>{item.warrantyPeriodMonths || '-'}</td><td>{displayValue(item.createdAt, 'createdAt')}</td><td>{displayValue(item.updatedAt, 'updatedAt')}</td></tr>);
    }

    if (kind === 'service-cases') {
      return rows.map((item) => <tr key={item._id}><td><strong>{item.batterySerialNumber || '-'}</strong><small>{item.batteryBrand} {item.batteryModel}</small></td><td className="wrap-cell">{item.problemDescription}</td><td><span className={`status-pill status-${item.warrantyStatus}`}>{String(item.warrantyStatus || '-').replaceAll('_', ' ')}</span></td><td><span className={`status-pill status-${item.batteryStatus}`}>{String(item.batteryStatus || '-').replaceAll('_', ' ')}</span></td><td>{displayValue(item.serviceRequestDate || item.createdAt, 'serviceRequestDate')}</td></tr>);
    }

    return null;
  };

  const renderHistoryContent = () => {
    const snapshot = history?.customer || customer || record;
    return <div className="customer-workflow-stack">
      <div className="section-heading"><div><p className="eyebrow">Full history</p><h3>Customer snapshot and activity</h3></div></div>
      <div className="customer-history-summary">
        {snapshot && renderCustomerProfile(snapshot, shopLookup)}
      </div>
      <div className="customer-history-grid">
        <article className="customer-mini-card"><span>Batteries</span><strong>{(history?.batteries || batteries).length}</strong><small>Total registered batteries for this customer.</small></article>
        <article className="customer-mini-card"><span>Service cases</span><strong>{(history?.serviceCases || serviceCases).length}</strong><small>Open and closed service records.</small></article>
        <article className="customer-mini-card"><span>Notes</span><strong>{notes.length}</strong><small>Internal notes attached to the customer.</small></article>
      </div>
    </div>;
  };

  const renderViewTab = () => {
    if (loading) return <div className="state-panel"><strong>Loading customer data...</strong><span>Fetching the live customer record and related activity.</span></div>;
    if (error && !customer) return <div className="state-panel state-error"><strong>Could not load customer details</strong><span>{error}</span></div>;

    if (activeTab === 'overview') return renderCustomerProfile(customer || record, shopLookup);
    if (activeTab === 'history') return renderHistoryContent();
    if (activeTab === 'batteries') return <div className="table-scroll"><table><thead><tr><th>Serial</th><th>Purchase</th><th>Warranty</th><th>Created</th><th>Updated</th></tr></thead><tbody>{renderTableRows(history?.batteries || batteries, 'batteries')}</tbody></table></div>;
    if (activeTab === 'service-cases') return <div className="table-scroll"><table><thead><tr><th>Battery</th><th>Problem</th><th>Warranty</th><th>Status</th><th>Requested</th></tr></thead><tbody>{renderTableRows(history?.serviceCases || serviceCases, 'service-cases')}</tbody></table></div>;
    if (activeTab === 'notes') return <div className="detail-block"><span>Notes</span>{renderNoteList(notes)}</div>;
    if (activeTab === 'whatsapp') return <div className="customer-whatsapp-panel"><div><span>WhatsApp contact link</span><strong>{whatsappLink || 'Generate the link from the API.'}</strong></div><div className="heading-actions"><button type="button" className="button button-primary" onClick={openWhatsapp} disabled={actionBusy}><Link2 size={16} /> Open link</button><button type="button" className="button button-secondary" onClick={copyWhatsapp} disabled={!whatsappLink}><Copy size={16} /> Copy</button></div></div>;
    return null;
  };

  if (mode === 'view') {
    return <div className="customer-workspace">
      <div className="customer-tabs">
        {['overview', 'history', 'batteries', 'service-cases', 'notes', 'whatsapp'].map((tab) => <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab.replace('-', ' ')}</button>)}
      </div>
      {actionError && <div className="inline-error">{actionError}</div>}
      {renderViewTab()}
    </div>;
  }

  return <div className="customer-workspace">
    <ResourceForm config={config} record={record} onSubmit={onSave} onCancel={onClose} busy={busy} referenceOptions={referenceOptions} referenceLoading={referenceLoading} formId={editFormId} showFooter={false} hiddenFields={['tags']} />
    <div className="customer-admin-grid">
      <section className="customer-admin-card">
        <div className="section-heading"><div><p className="eyebrow">Notes</p><h3>Add note</h3></div></div>
        <label className="field-wide">
          <span>Note content</span>
          <textarea rows="3" value={noteContent} onChange={(event) => setNoteContent(event.target.value)} placeholder="Add an internal note for this customer..." />
        </label>
        <div className="heading-actions">
          <button type="button" className="button button-primary" onClick={addNote} disabled={actionBusy || !noteContent.trim()}><MessageSquare size={16} /> Save note</button>
        </div>
        <div className="detail-block"><span>Recent notes</span>{renderNoteList(notes)}</div>
      </section>
      <section className="customer-admin-card">
        <div className="section-heading"><div><p className="eyebrow">Tags</p><h3>Manage tags</h3></div></div>
        <label className="field-wide">
          <span>New tags</span>
          <input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="premium, urgent" />
        </label>
        <div className="heading-actions">
          <button type="button" className="button button-primary" onClick={addTags} disabled={actionBusy || !tagText.trim()}><Tag size={16} /> Add tags</button>
        </div>
        <div className="chip-wrap">{currentTags.length ? currentTags.map((tag) => <span key={tag} className="tag-chip tag-chip-remove">{tag}<button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} disabled={actionBusy}>x</button></span>) : <span className="muted">No tags yet.</span>}</div>
      </section>
      <section className="customer-admin-card">
        <div className="section-heading"><div><p className="eyebrow">WhatsApp</p><h3>Customer link</h3></div></div>
        <p className="muted">Generate a direct WhatsApp contact link from the API.</p>
        <div className="heading-actions">
          <button type="button" className="button button-primary" onClick={openWhatsapp} disabled={actionBusy || !customerId}><Link2 size={16} /> Open link</button>
          <button type="button" className="button button-secondary" onClick={copyWhatsapp} disabled={!whatsappLink}><Copy size={16} /> Copy</button>
        </div>
        {whatsappLink && <code className="customer-link-code">{whatsappLink}</code>}
      </section>
      <section className="customer-admin-card customer-admin-card-danger">
        <div className="section-heading"><div><p className="eyebrow">Delete</p><h3>Soft delete customer</h3></div></div>
        <p className="muted">This will move the customer out of the active list without erasing the relationship history.</p>
        <button type="button" className="button button-danger-soft" onClick={onDelete} disabled={busy}><Trash2 size={16} /> Delete customer</button>
      </section>
      {actionError && <div className="inline-error field-wide">{actionError}</div>}
    </div>
    <footer className="customer-edit-footer modal-actions">
      <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
      <button type="submit" form={editFormId} className="button button-primary" disabled={busy}>
        {busy ? 'Saving...' : 'Save changes'}
      </button>
    </footer>
  </div>;
}

function getDocumentUrls(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value?.invoiceDocumentUrl) return [value.invoiceDocumentUrl];
  if (Array.isArray(value?.documents)) return value.documents.filter(Boolean);
  return [];
}

function BatteryCatalogWorkspace({ initialTab = 'brand', brandOptions = [], onClose, onSaved, busy }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [brandName, setBrandName] = useState('');
  const [modelBrand, setModelBrand] = useState('');
  const [modelName, setModelName] = useState('');
  const [policyBrand, setPolicyBrand] = useState('');
  const [policyMonths, setPolicyMonths] = useState('');
  const [policyDescription, setPolicyDescription] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const submitBrand = async (event) => {
    event.preventDefault();
    const name = brandName.trim();
    if (!name) return;
    setActionBusy(true);
    setActionError('');
    try {
      await api('/batteries/battery-brands', { method: 'POST', body: { name } });
      setBrandName('');
      await onSaved?.();
      setActionError('Battery brand created.');
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  const submitModel = async (event) => {
    event.preventDefault();
    const brand = modelBrand.trim();
    const model = modelName.trim();
    if (!brand || !model) return;
    setActionBusy(true);
    setActionError('');
    try {
      await api('/batteries/battery-models', { method: 'POST', body: { brand, modelName: model } });
      setModelName('');
      await onSaved?.();
      setActionError('Battery model created.');
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  const submitPolicy = async (event) => {
    event.preventDefault();
    const brand = policyBrand.trim();
    if (!brand) return;
    setActionBusy(true);
    setActionError('');
    try {
      await api('/batteries/warranty-policies', {
        method: 'POST',
        body: {
          brand,
          defaultWarrantyMonths: Number(policyMonths || 0),
          description: policyDescription.trim(),
        },
      });
      setPolicyBrand('');
      setPolicyMonths('');
      setPolicyDescription('');
      await onSaved?.();
      setActionError('Warranty policy created.');
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  return <div className="catalog-workspace">
    <div className="customer-tabs">
      {['brand', 'model', 'policy'].map((tab) => <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab.replace('-', ' ')}</button>)}
    </div>
    {actionError && <div className="inline-error">{actionError}</div>}
    {activeTab === 'brand' && <form onSubmit={submitBrand} className="customer-admin-card">
      <div className="section-heading"><div><p className="eyebrow">Battery master data</p><h3>Create brand</h3></div></div>
      <label className="field-wide"><span>Brand name</span><input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="AMARON" /></label>
      <div className="heading-actions">
        <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
        <button className="button button-primary" disabled={busy || actionBusy || !brandName.trim()}>Create brand</button>
      </div>
    </form>}
    {activeTab === 'model' && <form onSubmit={submitModel} className="customer-admin-card">
      <div className="section-heading"><div><p className="eyebrow">Battery master data</p><h3>Create model</h3></div></div>
      <label>
        <span>Brand</span>
        <select value={modelBrand} onChange={(event) => setModelBrand(event.target.value)}>
          <option value="">Select brand</option>
          {brandOptions.map((option) => {
            const normalized = typeof option === 'object' ? option : { value: option, label: String(option) };
            return <option key={String(normalized.value)} value={String(normalized.value)}>{normalized.label}</option>;
          })}
        </select>
      </label>
      <label className="field-wide"><span>Model name</span><input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="AAM-GO-00105D31L" /></label>
      <div className="heading-actions">
        <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
        <button className="button button-primary" disabled={busy || actionBusy || !modelBrand.trim() || !modelName.trim()}>Create model</button>
      </div>
    </form>}
    {activeTab === 'policy' && <form onSubmit={submitPolicy} className="customer-admin-card">
      <div className="section-heading"><div><p className="eyebrow">Battery master data</p><h3>Create warranty policy</h3></div></div>
      <label><span>Brand</span><select value={policyBrand} onChange={(event) => setPolicyBrand(event.target.value)}><option value="">Select brand</option>{brandOptions.map((option) => { const normalized = typeof option === 'object' ? option : { value: option, label: String(option) }; return <option key={String(normalized.value)} value={String(normalized.value)}>{normalized.label}</option>; })}</select></label>
      <label><span>Default warranty months</span><input type="number" min="0" value={policyMonths} onChange={(event) => setPolicyMonths(event.target.value)} placeholder="24" /></label>
      <label className="field-wide"><span>Description</span><textarea rows="3" value={policyDescription} onChange={(event) => setPolicyDescription(event.target.value)} placeholder="Optional policy note..." /></label>
      <div className="heading-actions">
        <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
        <button className="button button-primary" disabled={busy || actionBusy || !policyBrand.trim()}>Create policy</button>
      </div>
    </form>}
  </div>;
}

function BatteryWorkspace({ config, mode, record, shopLookup, referenceLookup, onDelete, onClose, onSave, busy, referenceOptions, referenceLoading }) {
  const batteryId = record?._id || '';
  const editFormId = batteryId ? `battery-edit-form-${batteryId}` : 'battery-edit-form';
  const [loading, setLoading] = useState(true);
  const [battery, setBattery] = useState(record || null);
  const [warranty, setWarranty] = useState(null);
  const [serviceHistory, setServiceHistory] = useState([]);
  const [documents, setDocuments] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [warrantyValues, setWarrantyValues] = useState({ purchaseDate: inputValue(record, { name: 'purchaseDate', type: 'date' }), warrantyPeriodMonths: record?.warrantyPeriodMonths || '' });
  const [documentUrl, setDocumentUrl] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadBatteryWorkspace = async () => {
    if (!batteryId) return;
    setLoading(true);
    setActionError('');

    const safe = async (path, fallback) => {
      try {
        const payload = await api(path);
        return payload.data ?? fallback;
      } catch {
        return fallback;
      }
    };

    try {
      const [batteryPayload, warrantyPayload, historyPayload, documentsPayload] = await Promise.all([
        safe(`/batteries/${batteryId}`, record),
        safe(`/batteries/${batteryId}/warranty`, null),
        safe(`/batteries/${batteryId}/service-history`, []),
        safe(`/batteries/${batteryId}/documents`, null),
      ]);
      const nextBattery = batteryPayload || record;
      setBattery(nextBattery);
      setWarranty(warrantyPayload);
      setServiceHistory(Array.isArray(historyPayload) ? historyPayload : []);
      setDocuments(documentsPayload);
      setWarrantyValues({
        purchaseDate: inputValue(nextBattery, { name: 'purchaseDate', type: 'date' }),
        warrantyPeriodMonths: nextBattery?.warrantyPeriodMonths || warrantyPayload?.warrantyPeriodMonths || '',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== 'view' && mode !== 'edit') return;
    loadBatteryWorkspace();
    return undefined;
  }, [batteryId, mode]);

  const updateWarranty = async () => {
    if (!batteryId) return;
    setActionBusy(true);
    setActionError('');
    try {
      await api(`/batteries/${batteryId}/warranty`, {
        method: 'PATCH',
        body: {
          purchaseDate: warrantyValues.purchaseDate,
          warrantyPeriodMonths: Number(warrantyValues.warrantyPeriodMonths),
        },
      });
      await loadBatteryWorkspace();
      setActionError('Warranty metadata updated.');
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  const recalculateWarranty = async () => {
    if (!batteryId) return;
    setActionBusy(true);
    setActionError('');
    try {
      const payload = await api(`/batteries/${batteryId}/warranty/recalculate`, { method: 'POST' });
      setWarranty(payload.data || null);
      setActionError('Warranty status recalculated.');
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  const attachDocument = async () => {
    const url = documentUrl.trim();
    if (!batteryId || !url) return;
    setActionBusy(true);
    setActionError('');
    try {
      await api(`/batteries/${batteryId}/documents`, { method: 'POST', body: { documentUrl: url } });
      setDocumentUrl('');
      await loadBatteryWorkspace();
      setActionError('Document URL attached.');
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setActionBusy(false);
    }
  };

  const renderWarrantyPanel = () => <div className="customer-history-grid">
    <article className="customer-mini-card"><span>Status</span><strong>{String(warranty?.status || (warranty?.isInWarranty ? 'in_warranty' : 'unknown')).replaceAll('_', ' ')}</strong><small>Current warranty state.</small></article>
    <article className="customer-mini-card"><span>Warranty end</span><strong>{displayValue(warranty?.warrantyEndDate, 'purchaseDate')}</strong><small>Calculated from purchase date and months.</small></article>
    <article className="customer-mini-card"><span>Warranty months</span><strong>{warranty?.warrantyPeriodMonths || battery?.warrantyPeriodMonths || '-'}</strong><small>Registered coverage period.</small></article>
  </div>;

  const renderDocuments = () => {
    const urls = getDocumentUrls(documents);
    if (!urls.length) return <span className="muted">No documents attached.</span>;
    return <div className="remarks-list">{urls.map((url) => <div className="remark-item" key={url}><p><a href={url} target="_blank" rel="noreferrer">{url}</a></p></div>)}</div>;
  };

  const renderServiceHistory = () => {
    if (!serviceHistory.length) return <div className="state-panel"><strong>No service history</strong><span>This battery has no service cases yet.</span></div>;
    return <div className="table-scroll"><table><thead><tr><th>Case</th><th>Problem</th><th>Status</th><th>Warranty</th><th>Requested</th></tr></thead><tbody>{serviceHistory.map((item) => <tr key={item._id}><td><strong>{item.batterySerialNumber || item._id}</strong><small>{item.customerId?.name || ''}</small></td><td className="wrap-cell">{item.problemDescription || '-'}</td><td>{displayValue(item.batteryStatus, 'status')}</td><td>{displayValue(item.warrantyStatus, 'status')}</td><td>{displayValue(item.serviceRequestDate || item.createdAt, 'serviceRequestDate')}</td></tr>)}</tbody></table></div>;
  };

  const renderViewTab = () => {
    if (loading) return <div className="state-panel"><strong>Loading battery data...</strong><span>Fetching warranty, service, and document records.</span></div>;
    if (activeTab === 'overview') return <RecordDetails record={battery || record} shopLookup={shopLookup} referenceLookup={referenceLookup} />;
    if (activeTab === 'warranty') return renderWarrantyPanel();
    if (activeTab === 'service-history') return renderServiceHistory();
    if (activeTab === 'documents') return <div className="detail-block"><span>Documents</span>{renderDocuments()}</div>;
    return null;
  };

  if (mode === 'view') {
    return <div className="customer-workspace battery-workspace">
      <div className="customer-tabs">
        {['overview', 'warranty', 'service-history', 'documents'].map((tab) => <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab.replace('-', ' ')}</button>)}
      </div>
      {actionError && <div className="inline-error">{actionError}</div>}
      {renderViewTab()}
    </div>;
  }

  return <div className="customer-workspace battery-workspace">
    <ResourceForm config={config} record={record} onSubmit={onSave} onCancel={onClose} busy={busy} referenceOptions={referenceOptions} referenceLoading={referenceLoading} formId={editFormId} showFooter={false} />
    <div className="customer-admin-grid">
      <section className="customer-admin-card">
        <div className="section-heading"><div><p className="eyebrow">Warranty</p><h3>Update metadata</h3></div></div>
        <label><span>Purchase date</span><input type="date" value={warrantyValues.purchaseDate} onChange={(event) => setWarrantyValues((current) => ({ ...current, purchaseDate: event.target.value }))} /></label>
        <label><span>Warranty months</span><input type="number" min="0" value={warrantyValues.warrantyPeriodMonths} onChange={(event) => setWarrantyValues((current) => ({ ...current, warrantyPeriodMonths: event.target.value }))} /></label>
        <div className="heading-actions">
          <button type="button" className="button button-primary" onClick={updateWarranty} disabled={actionBusy || !warrantyValues.purchaseDate || warrantyValues.warrantyPeriodMonths === ''}>Save warranty</button>
          <button type="button" className="button button-secondary" onClick={recalculateWarranty} disabled={actionBusy}><RefreshCw size={16} /> Recalculate</button>
        </div>
        {warranty && renderWarrantyPanel()}
      </section>
      <section className="customer-admin-card">
        <div className="section-heading"><div><p className="eyebrow">Documents</p><h3>Attach invoice URL</h3></div></div>
        <label className="field-wide"><span>Document URL</span><input value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} placeholder="https://cloudinary.com/invoice.pdf" /></label>
        <div className="heading-actions">
          <button type="button" className="button button-primary" onClick={attachDocument} disabled={actionBusy || !documentUrl.trim()}><Link2 size={16} /> Attach document</button>
        </div>
        <div className="detail-block"><span>Current documents</span>{renderDocuments()}</div>
      </section>
      <section className="customer-admin-card">
        <div className="section-heading"><div><p className="eyebrow">Service</p><h3>Battery service history</h3></div></div>
        {renderServiceHistory()}
      </section>
      <section className="customer-admin-card customer-admin-card-danger">
        <div className="section-heading"><div><p className="eyebrow">Delete</p><h3>Delete registration</h3></div></div>
        <p className="muted">This removes the selected battery registration from the active registry.</p>
        <button type="button" className="button button-danger-soft" onClick={onDelete} disabled={busy}><Trash2 size={16} /> Delete battery</button>
      </section>
      {actionError && <div className="inline-error field-wide">{actionError}</div>}
    </div>
    <footer className="customer-edit-footer modal-actions">
      <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
      <button type="submit" form={editFormId} className="button button-primary" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
    </footer>
  </div>;
}

function sheetRowsToObjects(sheetRows) {
  if (!Array.isArray(sheetRows) || sheetRows.length < 2) return [];

  const [headers, ...rows] = sheetRows;
  const columnNames = (Array.isArray(headers) ? headers : []).map((header, index) => {
    const value = String(header || '').trim();
    return value || `column_${index + 1}`;
  });

  return rows
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row) => Object.fromEntries(columnNames.map((columnName, index) => [columnName, row[index] ?? ''])));
}

function BulkImportForm({ shops, shopOptions, onSubmit, onCancel, busy }) {
  const [sourceRows, setSourceRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [defaultShopId, setDefaultShopId] = useState('');
  const [parsing, setParsing] = useState(false);
  const [formError, setFormError] = useState('');

  const review = prepareCustomerImportRows(sourceRows, shops, defaultShopId);
  const previewRows = review.rows.slice(0, 5);

  const parseFile = async (event) => {
    const [file] = Array.from(event.target.files || []);
    if (!file) return;

    setParsing(true);
    setFormError('');
    setFileName(file.name);

    try {
      const { readSheet } = await import('read-excel-file/browser');
      const rows = sheetRowsToObjects(await readSheet(file));
      if (!rows.length) throw new Error('The uploaded file is empty.');
      setSourceRows(rows);
    } catch (error) {
      setSourceRows([]);
      setFormError(error.message || 'Could not read this Excel file.');
    } finally {
      setParsing(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!sourceRows.length) {
      setFormError('Upload an Excel file with customer rows first.');
      return;
    }

    if (review.errors.length) {
      setFormError(review.errors[0]);
      return;
    }

    await onSubmit(review.rows);
  };

  return <form onSubmit={submit}>
    <div className="bulk-import-shell">
      <div className="bulk-import-intro">
        <div>
          <p className="eyebrow">Customer import</p>
          <h3>Upload an Excel sheet and send one JSON array to the import API.</h3>
        </div>
        <div className="bulk-import-meta">
          <span>Accepted: `.xlsx`</span>
          <span>Headers: `id`, `name`, `mobileNumber`, `vehicleNumbers`, `address`, `shopId`</span>
        </div>
      </div>
      <div className="form-grid">
        <label className="field-wide">
          <span>Excel file *</span>
          <input type="file" accept=".xlsx" onChange={parseFile} />
        </label>
        <label>
          <span>Default shop for missing rows</span>
          <select value={defaultShopId} onChange={(event) => setDefaultShopId(event.target.value)}>
            <option value="">Keep shop from file</option>
            {shopOptions.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
          </select>
        </label>
        <div className="bulk-import-stat">
          <span>Import status</span>
          <strong>{parsing ? 'Reading file...' : sourceRows.length ? `${review.rows.length} ready row${review.rows.length === 1 ? '' : 's'}` : 'Waiting for file'}</strong>
          <small>{fileName || 'No file selected yet.'}</small>
        </div>
      </div>
      {review.errors.length > 0 && <div className="inline-error">{review.errors.slice(0, 4).join(' | ')}</div>}
      {formError && <div className="inline-error">{formError}</div>}
      <div className="bulk-import-preview">
        <div className="bulk-import-preview-head">
          <strong>Preview</strong>
          <span>{sourceRows.length ? `Showing ${previewRows.length} of ${review.rows.length} parsed customers` : 'Upload a file to see preview rows'}</span>
        </div>
        {!previewRows.length ? <div className="state-panel"><Upload size={22} /><strong>No preview rows yet</strong><span>Use one worksheet with customer columns. Vehicle numbers can be comma-separated.</span></div> : <div className="table-scroll"><table><thead><tr><th>Name</th><th>Mobile</th><th>Vehicles</th><th>Address</th><th>Shop</th></tr></thead><tbody>{previewRows.map((row, index) => <tr key={`${row.mobileNumber}-${index}`}><td>{row.name}</td><td>{row.mobileNumber}</td><td>{row.vehicleNumbers.length ? row.vehicleNumbers.join(', ') : '-'}</td><td>{row.address || '-'}</td><td>{row.shopId}</td></tr>)}</tbody></table></div>}
      </div>
    </div>
    <footer className="modal-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={busy || parsing || !review.rows.length || review.errors.length > 0}>{busy ? 'Importing...' : `Import ${review.rows.length || ''} customer${review.rows.length === 1 ? '' : 's'}`.trim()}</button></footer>
  </form>;
}

export default function ResourcePage({ config }) {
  const isCustomerResource = config.endpoint === '/customers';
  const isBatteryResource = config.endpoint === '/batteries';
  const hasFilters = Array.isArray(config.filters) && config.filters.length > 0;
  const [records, setRecords] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});
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
  const [shopRecords, setShopRecords] = useState([]);
  const [referenceLookup, setReferenceLookup] = useState({});
  const [referenceRefreshKey, setReferenceRefreshKey] = useState(0);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const payload = await api(`${config.endpoint}${queryString({ page, limit: 10, search: hasFilters ? undefined : query, ...filters })}`);
      setRecords(Array.isArray(payload.data) ? payload.data : []);
      setMeta(payload.meta || { page, totalPages: 1, total: payload.data?.length || 0 });
    } catch (requestError) { setError(requestError); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [config.endpoint, page, query, filters]);

  useEffect(() => {
    let active = true;
    const optionFields = [...config.fields, ...(config.filters || [])];
    const sources = new Set(optionFields.flatMap((field) => {
      const fieldSources = [];
      if (field.optionsSource) fieldSources.push(field.optionsSource);
      if (field.type === 'lineItems') fieldSources.push('products');
      return fieldSources;
    }));
    const loadShopLookup = sources.has('shops') || config.endpoint === '/batteries';
    const loadingState = {};
    optionFields.forEach((field) => {
      if (field.optionsSource) loadingState[field.name] = true;
      if (field.type === 'lineItems') loadingState.productId = true;
    });
    setReferenceLoading(loadingState);

    if (!sources.size && !loadShopLookup) {
      setReferenceOptions({});
      setReferenceLoading({});
      setShopLookup({});
      setShopRecords([]);
      setReferenceLookup({});
      return () => { active = false; };
    }

    Promise.all([
      sources.has('customers') ? api('/customers?page=1&limit=500').catch(() => ({ data: [] })) : Promise.resolve(null),
      sources.has('dealers') ? api('/dealers?page=1&limit=500').catch(() => ({ data: [] })) : Promise.resolve(null),
      sources.has('products') ? api('/products?page=1&limit=500').catch(() => ({ data: [] })) : Promise.resolve(null),
      loadShopLookup ? api('/shops?page=1&limit=500').catch(() => ({ data: [] })) : Promise.resolve(null),
      sources.has('batteryBrands') ? api('/batteries/battery-brands').catch(() => ({ data: [] })) : Promise.resolve(null),
      sources.has('batteryModels') ? api('/batteries/battery-models').catch(() => ({ data: [] })) : Promise.resolve(null),
      api('/batteries/warranty-policies').catch(() => ({ data: [] })),
    ]).then(([customersPayload, dealersPayload, productsPayload, shopsPayload, batteryBrandsPayload, batteryModelsPayload, warrantyPoliciesPayload]) => {
      if (!active) return;
      const customers = Array.isArray(customersPayload?.data) ? customersPayload.data : [];
      const dealers = Array.isArray(dealersPayload?.data) ? dealersPayload.data : [];
      const products = Array.isArray(productsPayload?.data) ? productsPayload.data : [];
      const shops = Array.isArray(shopsPayload?.data) ? shopsPayload.data : [];
      const batteryBrands = buildBatteryBrandOptions(Array.isArray(batteryBrandsPayload?.data) ? batteryBrandsPayload.data : []);
      const batteryModels = buildBatteryModelOptions(Array.isArray(batteryModelsPayload?.data) ? batteryModelsPayload.data : []);
      const warrantyPolicies = Array.isArray(warrantyPoliciesPayload?.data) ? warrantyPoliciesPayload.data : [];
      setReferenceOptions((current) => ({
        ...current,
        ...(sources.has('customers') ? { customerId: buildCustomerOptions(customers) } : {}),
        ...(sources.has('shops') ? { shopId: buildShopOptions(shops) } : {}),
        ...(sources.has('dealers') ? { dealerId: buildDealerOptions(dealers) } : {}),
        ...(sources.has('products') ? { productId: buildProductOptions(products) } : {}),
        ...(sources.has('batteryBrands') ? { batteryBrand: batteryBrands, brand: batteryBrands } : {}),
        ...(sources.has('batteryModels') ? { batteryModel: batteryModels, model: batteryModels } : {}),
        warrantyPoliciesByBrand: buildWarrantyPolicyLookup(warrantyPolicies),
      }));
      setReferenceLookup((current) => ({
        ...current,
        ...(sources.has('customers') ? { customerId: buildLookup(customers, (customer) => (customer.mobileNumber ? `${customer.name} - ${customer.mobileNumber}` : customer.name || customer._id)) } : {}),
        ...(sources.has('shops') ? { shopId: buildLookup(shops, (shop) => shop.branchCode ? `${shop.name} - ${shop.branchCode}` : shop.name || shop._id) } : {}),
        ...(sources.has('dealers') ? { dealerId: buildLookup(dealers, (dealer) => [dealer.name, dealer.mobile || dealer.contactPerson].filter(Boolean).join(' - ') || dealer._id) } : {}),
        ...(sources.has('products') ? { productId: buildLookup(products, (product) => [product.productName, product.brand, product.productCode].filter(Boolean).join(' - ') || product._id) } : {}),
      }));
      if (loadShopLookup) {
        setShopLookup(buildShopLookup(shops));
        setShopRecords(shops);
      }
    }).finally(() => {
      if (!active) return;
      setReferenceLoading(Object.fromEntries(Object.keys(loadingState).map((key) => [key, false])));
    });

    return () => { active = false; };
  }, [config.endpoint, referenceRefreshKey]);

  useEffect(() => {
    if (isCustomerResource) {
      setDetailRecord(null);
      setDetailLoading(false);
      setDetailError('');
      return;
    }

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
  }, [config.endpoint, modal, isCustomerResource]);

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

  const bulkImport = async (rows) => {
    setBusy(true);
    try {
      await api(config.bulkImport?.endpoint || `${config.endpoint}/import`, { method: 'POST', body: { customers: rows } });
      setModal(null);
      setNotice(`${rows.length} customer${rows.length === 1 ? '' : 's'} imported successfully.`);
      await load();
    } catch (requestError) {
      setNotice(requestError.message);
      throw requestError;
    } finally {
      setBusy(false);
    }
  };

  const refreshReferenceData = async () => {
    setReferenceRefreshKey((value) => value + 1);
    await load();
  };

  const getFilterOptions = (filter) => {
    const options = filter.options || referenceOptions[filter.name] || [];
    if (!filter.dependsOn || !filter.optionFilterKey || !filters[filter.dependsOn]) return options;
    return options.filter((option) => {
      const normalized = typeof option === 'object' ? option : { value: option };
      return normalized[filter.optionFilterKey] === filters[filter.dependsOn];
    });
  };

  const updateFilter = (filter, value) => {
    setPage(1);
    setFilters((current) => {
      const next = { ...current };
      if (value) next[filter.name] = value;
      else delete next[filter.name];
      if (filter.name === 'brand') delete next.model;
      return next;
    });
  };

  const clearFilters = () => {
    setPage(1);
    setFilters({});
  };

  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">{config.eyebrow}</p><h1>{config.title}</h1><p>Live administration data from the Movan platform.</p></div>{(config.create || config.bulkImport || isBatteryResource) && <div className="heading-actions">{isBatteryResource && <><button className="button button-secondary" onClick={() => setModal({ type: 'battery-catalog', tab: 'brand' })}><Plus size={17} /> Create brand</button><button className="button button-secondary" onClick={() => setModal({ type: 'battery-catalog', tab: 'model' })}><Plus size={17} /> Create model</button><button className="button button-secondary" onClick={() => setModal({ type: 'battery-catalog', tab: 'policy' })}><Plus size={17} /> Warranty policy</button></>}{config.bulkImport && <button className="button button-secondary" onClick={() => setModal({ type: 'bulk-import' })}><Upload size={17} /> Bulk import</button>}{config.create && <button className="button button-primary" onClick={() => setModal({ type: 'create' })}><Plus size={17} /> Add new</button>}</div>}</div>
    {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
    <section className="card table-card">
      <div className="table-toolbar">{hasFilters ? <div className="filter-bar">{config.filters.map((filter) => <label key={filter.name} className="filter-field"><span>{filter.label}</span><select value={filters[filter.name] || ''} onChange={(event) => updateFilter(filter, event.target.value)}><option value="">{referenceLoading[filter.name] ? `Loading ${filter.label.toLowerCase()}...` : `All ${filter.label.toLowerCase()}`}</option>{getFilterOptions(filter).map((option) => { const normalized = typeof option === 'object' ? option : { value: option, label: String(option) }; return <option key={String(normalized.value)} value={String(normalized.value)}>{normalized.label}</option>; })}</select></label>)}<button className="button button-secondary" type="button" onClick={clearFilters}>Clear</button></div> : <div className="search-box"><Search size={17} /><input aria-label={`Search ${config.title}`} value={query} placeholder={`Search ${config.title.toLowerCase()}...`} onChange={(event) => { setPage(1); setQuery(event.target.value); }} /></div>}<button className="button button-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
      {loading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={load} /> : records.length === 0 ? <EmptyState /> : <div className="table-scroll"><table><thead><tr>{config.columns.map((column) => <th key={column}>{labels[column] || column}</th>)}<th className="actions-column">Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record._id}>{config.columns.map((column) => <td key={column}>{displayValue(record[column], column)}</td>)}<td><div className="row-actions"><button className="action-button action-view" title="View" onClick={() => setModal({ type: 'view', record })}><Eye size={16} /><span>View</span></button>{config.edit && <button className="action-button action-edit" title="Edit" onClick={() => setModal({ type: 'edit', record })}><Pencil size={16} /><span>Edit</span></button>}{config.delete && <button className="action-button action-delete" title="Delete" onClick={() => setModal({ type: 'delete', record })}><Trash2 size={16} /><span>Delete</span></button>}</div></td></tr>)}</tbody></table></div>}
      {!loading && !error && <div className="pagination"><span>{meta.total ?? records.length} total records</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button><span>Page {meta.page || page} of {Math.max(meta.totalPages || 1, 1)}</span><button disabled={page >= (meta.totalPages || 1)} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div></div>}
    </section>
    {modal?.type === 'view' && <Modal title={`${config.title.replace(/s$/, '')} details`} size="large" onClose={() => setModal(null)}>{isCustomerResource ? <CustomerWorkspace config={config} mode="view" record={modal.record} shopLookup={shopLookup} onDelete={remove} onClose={() => setModal(null)} onSave={save} busy={busy} referenceOptions={referenceOptions} referenceLoading={referenceLoading} /> : isBatteryResource ? <BatteryWorkspace config={config} mode="view" record={modal.record} shopLookup={shopLookup} referenceLookup={referenceLookup} onDelete={remove} onClose={() => setModal(null)} onSave={save} busy={busy} referenceOptions={referenceOptions} referenceLoading={referenceLoading} /> : detailLoading ? <div className="state-panel"><strong>Loading customer details...</strong><span>Fetching the full record from the live API.</span></div> : detailError ? <div className="state-panel state-error"><strong>Could not load full details</strong><span>{detailError}</span></div> : <RecordDetails record={detailRecord || modal.record} shopLookup={shopLookup} referenceLookup={referenceLookup} />}</Modal>}
    {(modal?.type === 'create' || modal?.type === 'edit') && <Modal title={modal.type === 'edit' ? `Edit ${config.title.replace(/s$/, '').toLowerCase()}` : `Create ${config.title.replace(/s$/, '').toLowerCase()}`} subtitle="Required fields are marked with an asterisk." size="large" onClose={() => setModal(null)}>{isCustomerResource && modal.type === 'edit' ? <CustomerWorkspace config={config} mode="edit" record={modal.record} shopLookup={shopLookup} onDelete={remove} onClose={() => setModal(null)} onSave={save} busy={busy} referenceOptions={referenceOptions} referenceLoading={referenceLoading} /> : isBatteryResource && modal.type === 'edit' ? <BatteryWorkspace config={config} mode="edit" record={modal.record} shopLookup={shopLookup} referenceLookup={referenceLookup} onDelete={remove} onClose={() => setModal(null)} onSave={save} busy={busy} referenceOptions={referenceOptions} referenceLoading={referenceLoading} /> : <ResourceForm config={config} record={modal.record} onSubmit={save} onCancel={() => setModal(null)} busy={busy} referenceOptions={referenceOptions} referenceLoading={referenceLoading} />}</Modal>}
    {modal?.type === 'battery-catalog' && <Modal title="Battery master data" subtitle="Create brand, model, or warranty policy records from the live APIs." size="large" onClose={() => setModal(null)}><BatteryCatalogWorkspace initialTab={modal.tab || 'brand'} brandOptions={referenceOptions.batteryBrand || referenceOptions.brand || []} onClose={() => setModal(null)} onSaved={refreshReferenceData} busy={busy} /></Modal>}
    {modal?.type === 'bulk-import' && <Modal title="Bulk import customers" subtitle="Upload an Excel sheet, preview the parsed rows, then send the customers array inside the API payload." size="large" onClose={() => setModal(null)}><BulkImportForm shops={shopRecords} shopOptions={referenceOptions.shopId || []} onSubmit={bulkImport} onCancel={() => setModal(null)} busy={busy} /></Modal>}
    {modal?.type === 'delete' && <Modal title="Confirm deletion" onClose={() => setModal(null)}><div className="danger-copy"><Trash2 /><p>This permanently removes the selected record. This action cannot be undone.</p></div><footer className="modal-actions"><button className="button button-quiet" onClick={() => setModal(null)}>Cancel</button><button className="button button-danger" disabled={busy} onClick={remove}>{busy ? 'Deleting...' : 'Delete permanently'}</button></footer></Modal>}
  </div>;
}
