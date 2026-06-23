import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, RefreshCw, Route } from 'lucide-react';
import { api } from '../lib/api';
import Modal from '../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState';

const statuses = ['pending', 'in_service', 'sent_to_company', 'replacement', 'ready', 'delivered', 'closed'];
const blank = { customerId: '', batteryRegistrationId: '', batteryBrand: '', batteryModel: '', batterySerialNumber: '', problemDescription: '', warrantyStatus: 'unknown' };

function renderRemarkText(remarks) {
  if (!Array.isArray(remarks) || remarks.length === 0) {
    return <p className="muted">No remarks added yet.</p>;
  }

  return (
    <div className="remarks-list">
      {remarks.map((remark, index) => {
        const content = typeof remark === 'string' ? remark : remark?.content;
        return (
          <div className="remark-item" key={remark?._id || `${index}-${content || 'remark'}`}>
            <p>{content || 'No remark content available.'}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function ServiceCases() {
  const [records, setRecords] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null); const [modal, setModal] = useState(null); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  const load = async () => { setLoading(true); try { const payload = await api('/service-cases?page=1&limit=100'); setRecords(payload.data || []); setError(null); } catch (err) { setError(err); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const save = async (event) => { event.preventDefault(); setBusy(true); const body = Object.fromEntries(new FormData(event.currentTarget)); if (!body.batteryRegistrationId) delete body.batteryRegistrationId; try { await api(modal.type === 'edit' ? `/service-cases/${modal.record._id}` : '/service-cases', { method: modal.type === 'edit' ? 'PATCH' : 'POST', body }); setModal(null); setNotice('Service case saved.'); await load(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
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
  const changeStatus = async (event) => { event.preventDefault(); setBusy(true); const status = new FormData(event.currentTarget).get('status'); try { await api(`/service-cases/${modal.record._id}/status`, { method: 'POST', body: { status } }); setModal(null); setNotice(`Case moved to ${status.replaceAll('_', ' ')}.`); await load(); } catch (err) { setNotice(err.message); } finally { setBusy(false); } };
  const form = modal?.record || blank;
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">End-to-end service control</p><h1>Service Cases</h1><p>Move warranty and service work through a controlled lifecycle.</p></div><button className="button button-primary" onClick={() => setModal({ type: 'create' })}><Plus size={17} /> New case</button></div>{notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice('')}>Dismiss</button></div>}<section className="card table-card"><div className="table-toolbar"><div className="queue-tabs"><span className="active">All cases <b>{records.length}</b></span><span>Pending <b>{records.filter((item) => item.batteryStatus === 'pending').length}</b></span><span>Ready <b>{records.filter((item) => item.batteryStatus === 'ready').length}</b></span></div><button className="button button-secondary" onClick={load}><RefreshCw size={16} /> Refresh</button></div>{loading ? <LoadingState /> : error ? <ErrorState error={error} onRetry={load} /> : !records.length ? <EmptyState /> : <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Battery</th><th>Problem</th><th>Warranty</th><th>Status</th><th>Requested</th><th>Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record._id}><td><strong>{record.customerId?.name || 'Unknown'}</strong><small>{record.customerId?.mobileNumber}</small></td><td><strong>{record.batterySerialNumber}</strong><small>{record.batteryBrand} {record.batteryModel}</small></td><td className="wrap-cell">{record.problemDescription}</td><td><span className={`status-pill status-${record.warrantyStatus}`}>{record.warrantyStatus?.replaceAll('_', ' ')}</span></td><td><span className={`status-pill status-${record.batteryStatus}`}>{record.batteryStatus?.replaceAll('_', ' ')}</span></td><td>{new Date(record.serviceRequestDate).toLocaleDateString('en-IN')}</td><td><div className="row-actions"><button className="action-button action-view" onClick={() => setModal({ type: 'view', record })}><Eye size={16} /><span>View</span></button><button className="action-button action-edit" onClick={() => setModal({ type: 'edit', record })}><Pencil size={16} /><span>Edit</span></button><button className="action-button action-flow" onClick={() => setModal({ type: 'status', record })}><Route size={16} /><span>Status</span></button></div></td></tr>)}</tbody></table></div>}</section>
    {(modal?.type === 'create' || modal?.type === 'edit') && <Modal title={modal.type === 'create' ? 'Create service case' : 'Edit service case'} size="large" onClose={() => setModal(null)}><form onSubmit={save}><div className="form-grid"><label><span>Customer ID *</span><input name="customerId" defaultValue={typeof form.customerId === 'object' ? form.customerId._id : form.customerId} required /></label><label><span>Battery registration ID</span><input name="batteryRegistrationId" defaultValue={form.batteryRegistrationId} /></label><label><span>Brand *</span><input name="batteryBrand" defaultValue={form.batteryBrand} required /></label><label><span>Model *</span><input name="batteryModel" defaultValue={form.batteryModel} required /></label><label><span>Serial number *</span><input name="batterySerialNumber" defaultValue={form.batterySerialNumber} required /></label><label><span>Warranty status</span><select name="warrantyStatus" defaultValue={form.warrantyStatus}><option value="unknown">Unknown</option><option value="in_warranty">In warranty</option><option value="out_of_warranty">Out of warranty</option></select></label><label className="field-wide"><span>Problem description *</span><textarea name="problemDescription" defaultValue={form.problemDescription} rows="4" required /></label></div><footer className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancel</button>{modal.type === 'edit' && <button type="button" className="button button-danger-soft" onClick={remove} disabled={busy}>{busy ? 'Deleting...' : 'Delete case'}</button>}<button className="button button-primary" disabled={busy}>{busy ? 'Saving...' : 'Save case'}</button></footer></form></Modal>}
    {modal?.type === 'status' && <Modal title="Update service status" subtitle={`Current status: ${modal.record.batteryStatus?.replaceAll('_', ' ')}`} onClose={() => setModal(null)}><form onSubmit={changeStatus}><label><span>Move case to</span><select name="status" defaultValue={modal.record.batteryStatus}>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><div className="workflow-note"><Route size={18} /><p>This records a status transition in the case history and may trigger customer alerts.</p></div><footer className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancel</button><button className="button button-primary" disabled={busy}>Update status</button></footer></form></Modal>}
    {modal?.type === 'view' && <Modal title="Service case details" size="large" onClose={() => setModal(null)}><div className="case-profile"><div><span>Customer</span><strong>{modal.record.customerId?.name}</strong><small>{modal.record.customerId?.mobileNumber}</small></div><div><span>Battery</span><strong>{modal.record.batterySerialNumber}</strong><small>{modal.record.batteryBrand} {modal.record.batteryModel}</small></div><div><span>Current status</span><strong>{modal.record.batteryStatus?.replaceAll('_', ' ')}</strong></div><div><span>Warranty</span><strong>{modal.record.warrantyStatus?.replaceAll('_', ' ')}</strong></div></div><div className="detail-block"><span>Problem description</span><p>{modal.record.problemDescription}</p></div><div className="detail-block"><span>Remarks</span>{renderRemarkText(modal.record.remarks)}</div></Modal>}
  </div>;
}
