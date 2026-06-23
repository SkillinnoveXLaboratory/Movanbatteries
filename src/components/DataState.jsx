import { AlertTriangle, Inbox, LoaderCircle, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading live records' }) {
  return <div className="state-panel"><LoaderCircle className="spin" /><strong>{label}</strong><span>Talking to the Movan API...</span></div>;
}

export function ErrorState({ error, onRetry }) {
  return <div className="state-panel state-error"><AlertTriangle /><strong>Could not load this section</strong><span>{error?.message || 'Unexpected API error'}</span>{onRetry && <button className="button button-secondary" onClick={onRetry}><RefreshCw size={16} /> Retry</button>}</div>;
}

export function EmptyState({ title = 'No records found', message = 'There is nothing to show for the current filters.' }) {
  return <div className="state-panel"><Inbox /><strong>{title}</strong><span>{message}</span></div>;
}

