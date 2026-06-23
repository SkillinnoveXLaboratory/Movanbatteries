import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, RefreshCw, Route } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState';

const statuses = ['pending', 'in_service', 'sent_to_company', 'replacement', 'ready', 'delivered', 'closed'];
const blank = { customerId: '', batteryRegistrationId: '', batteryBrand: '', batteryModel: '', batterySerialNumber: '', problemDescription: '', warrantyStatus: 'unknown' };

function recordId(value) {
  return typeof value === 'object' && value !== null ? value._id || '' : value || '';
}

function customerLabel(customer) {
  return [customer.name, customer.mobileNumber].filter(Boolean).join(' - ') || customer._id;
}

function batteryLabel(battery) {
  return [battery.batterySerialNumber, battery.batteryBrand, battery.batteryModel].filter(Boolean).join(' - ') || battery._id;
}

function formFromRecord(record) {
  if (!record) return blank;
  return {
    customerId: recordId(record.customerId),
    batteryRegistrationId: recordId(record.batteryRegistrationId),
    batteryBrand: record.batteryBrand || '',
    batteryModel: record.batteryModel || '',
    batterySerialNumber: record.batterySerialNumber || '',
    problemDescription: record.problemDescription || '',
    warrantyStatus: record.warrantyStatus || 'unknown',
  };
}

function renderRemarkText(remarks) {
  if (!Array.isArray(remarks) || remarks.length === 0) return <p className="muted">No remarks added yet.</p>;

  return <div className="remarks-list">
    {remarks.map((remark, index) => {
      const content = typeof remark === 'string' ? remark : remark?.content;
      return <div className="remark-item" key={remark?._id || `${index}-${content || 'remark'}`}><p>{content || 'No remark content available.'}</p></div>;
    })}
  </div>;
}

export default function ServiceCases() {
  const [records, setRecords] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [batteries, setBatteries] = useState([]);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [formValues, setFormValues] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const payload = await api('/service-cases?page=1&limit=100');
      setRecords(payload.data || []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let active = true;
    setReferenceLoading(true);
    Promise.all([
      api('/customers?page=1&limit=500').catch(() => ({ data: [] })),
      api('/batteries?page=1&limit=500').catch(() => ({ data: [] })),
    ]).then(([customersPayload, batteriesPayload]) => {
      if (!active) return;
      setCustomers(Array.isArray(customersPayload.data) ? customersPayload.data : []);
      setBatteries(Array.isArray(batteriesPayload.data) ? batteriesPayload.data : []);
    }).finally(() => {
      if (active) setReferenceLoading(false);
    });
    return () => { active = false; };
  }, []);

  const openCreate = () => {
    setFormValues(blank);
    setModal({ type: 'create' });
  };

  const openEdit = (record) => {
    setFormValues(formFromRecord(record));
    setModal({ type: 'edit', record });
  };

  const updateForm = (name, value) => {
    setFormValues((current) => ({ ...current, [name]: value }));
  };

  const selectBattery = (batteryId) => {
    const battery = batteries.find((item) => item._id === batteryId);
    setFormValues((current) => ({
      ...current,
      batteryRegistrationId: batteryId,
      customerId: recordId(battery?.customerId) || current.customerId,
      batteryBrand: battery?.batteryBrand || current.batteryBrand,
      batteryModel: battery?.batteryModel || current.batteryModel,
      batterySerialNumber: battery?.batterySerialNumber || current.batterySerialNumber,
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    const body = { ...formValues };
    if (!body.batteryRegistrationId) delete body.batteryRegistrationId;
    try {
      await api(modal.type === 'edit' ? `/service-cases/${modal.record._id}` : '/service-cases', { method: modal.type === 'edit' ? 'PATCH' : 'POST', body });
      setModal(null);
      setNotice('Service case saved.');
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!modal?.record?._id) return;
    const confirmed = window.confirm('Soft delete this service case? This will hide it from active workflow.');
    if (!confirmed) return;
    setBusy(true);
    try {
      await api(`/service-cases/${modal.record._id}`, { method: 'DELETE' });
      setModal(null);
      setNotice('Service case deleted.');
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (event) => {
    event.preventDefault();
    setBusy(true);
    const status = new FormData(event.currentTarget).get('status');
    try {
      await api(`/service-cases/${modal.record._id}/status`, { method: 'POST', body: { status } });
      setModal(null);
      setNotice(`Case moved to ${status.replaceAll('_', ' ')}.`);
      await load();
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };

  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">End-to-end service control</p><h1>Service Cases</h1><p>Move warranty and service work through a controlled lifecycle.</p></div><button className="button button-primary" onClick={openCreate}><Plus size={17} /> New case</button></div>
    {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}
    <section className="card table-card">
      <div className="table-toolbar"><div className="queue-tabs"><span className="active">All cases <b>{records.length}</b></span><span>Pending <b>{records.filter((item) => item.batteryStatus === 'pending').length}</b></span><span>Ready <b>{records.filter((item) => item.batteryStatus === 'ready').length}</b></span></div><button className="button button-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></div>
      {loading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={load} /> : !records.length ? <EmptyState /> : <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Battery</th><th>Problem</th><th>Warranty</th><th>Status</th><th>Requested</th><th>Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record._id}><td><strong>{record.customerId?.name || 'Unknown'}</strong><small>{record.customerId?.mobileNumber}</small></td><td><strong>{record.batterySerialNumber}</strong><small>{record.batteryBrand} {record.batteryModel}</small></td><td className="wrap-cell">{record.problemDescription}</td><td><span className={`status-pill status-${record.warrantyStatus}`}>{record.warrantyStatus?.replaceAll('_', ' ')}</span></td><td><span className={`status-pill status-${record.batteryStatus}`}>{record.batteryStatus?.replaceAll('_', ' ')}</span></td><td>{new Date(record.serviceRequestDate).toLocaleDateString('en-IN')}</td><td><div className="row-actions"><button className="action-button action-view" onClick={() => setModal({ type: 'view', record })}><Eye size={16} /><span>View</span></button><button className="action-button action-edit" onClick={() => openEdit(record)}><Pencil size={16} /><span>Edit</span></button><button className="action-button action-flow" onClick={() => setModal({ type: 'status', record })}><Route size={16} /><span>Status</span></button></div></td></tr>)}</tbody></table></div>}
    </section>
    {(modal?.type === 'create' || modal?.type === 'edit') && <Modal title={modal.type === 'create' ? 'Create service case' : 'Edit service case'} size="large" onClose={() => setModal(null)}><form onSubmit={save}><div className="form-grid"><label><span>Customer *</span><select name="customerId" value={formValues.customerId} required onChange={(event) => updateForm('customerId', event.target.value)}><option value="">{referenceLoading ? 'Loading customers...' : 'Select customer'}</option>{customers.map((customer) => <option key={customer._id} value={customer._id}>{customerLabel(customer)}</option>)}</select></label><label><span>Battery registration</span><select name="batteryRegistrationId" value={formValues.batteryRegistrationId} onChange={(event) => selectBattery(event.target.value)}><option value="">{referenceLoading ? 'Loading batteries...' : 'Select registered battery'}</option>{batteries.map((battery) => <option key={battery._id} value={battery._id}>{batteryLabel(battery)}</option>)}</select></label><label><span>Brand *</span><input name="batteryBrand" value={formValues.batteryBrand} onChange={(event) => updateForm('batteryBrand', event.target.value)} required /></label><label><span>Model *</span><input name="batteryModel" value={formValues.batteryModel} onChange={(event) => updateForm('batteryModel', event.target.value)} required /></label><label><span>Serial number *</span><input name="batterySerialNumber" value={formValues.batterySerialNumber} onChange={(event) => updateForm('batterySerialNumber', event.target.value)} required /></label><label><span>Warranty status</span><select name="warrantyStatus" value={formValues.warrantyStatus} onChange={(event) => updateForm('warrantyStatus', event.target.value)}><option value="unknown">Unknown</option><option value="in_warranty">In warranty</option><option value="out_of_warranty">Out of warranty</option></select></label><label className="field-wide"><span>Problem description *</span><textarea name="problemDescription" value={formValues.problemDescription} onChange={(event) => updateForm('problemDescription', event.target.value)} rows="4" required /></label></div><footer className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancel</button>{modal.type === 'edit' && <button type="button" className="button button-danger-soft" onClick={remove} disabled={busy}>{busy ? 'Deleting...' : 'Delete case'}</button>}<button className="button button-primary" disabled={busy}>{busy ? 'Saving...' : 'Save case'}</button></footer></form></Modal>}
    {modal?.type === 'status' && <Modal title="Update service status" subtitle={`Current status: ${modal.record.batteryStatus?.replaceAll('_', ' ')}`} onClose={() => setModal(null)}><form onSubmit={changeStatus}><label><span>Move case to</span><select name="status" defaultValue={modal.record.batteryStatus}>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><div className="workflow-note"><Route size={18} /><p>This records a status transition in the case history and may trigger customer alerts.</p></div><footer className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy}>Update status</button></footer></form></Modal>}
    {modal?.type === 'view' && <Modal title="Service case details" size="large" onClose={() => setModal(null)}><div className="case-profile"><div><span>Customer</span><strong>{modal.record.customerId?.name}</strong><small>{modal.record.customerId?.mobileNumber}</small></div><div><span>Battery</span><strong>{modal.record.batterySerialNumber}</strong><small>{modal.record.batteryBrand} {modal.record.batteryModel}</small></div><div><span>Current status</span><strong>{modal.record.batteryStatus?.replaceAll('_', ' ')}</strong></div><div><span>Warranty</span><strong>{modal.record.warrantyStatus?.replaceAll('_', ' ')}</strong></div></div><div className="detail-block"><span>Problem description</span><p>{modal.record.problemDescription}</p></div><div className="detail-block"><span>Remarks</span>{renderRemarkText(modal.record.remarks)}</div></Modal>}
  </div>;
}
