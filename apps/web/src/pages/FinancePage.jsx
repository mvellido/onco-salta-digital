import { useState } from 'react';
import { useMe } from '../app/MeContext';
import BillingPage from './BillingPage';
import AuthorizationsBoard from '../features/coverage/AuthorizationsBoard';
import PayersPanel from '../features/coverage/PayersPanel';
import ReconciliationPanel from '../features/billing/ReconciliationPanel';

export default function FinancePage() {
  const { can } = useMe();
  const tabs = [
    { id: 'facturacion', label: 'Facturación', visible: can('billing:read') },
    { id: 'conciliacion', label: 'Conciliación', visible: can('billing:read') },
    { id: 'autorizaciones', label: 'Autorizaciones', visible: can('coverage:manage') || can('billing:read') },
    { id: 'obras-sociales', label: 'Obras sociales', visible: can('coverage:manage') || can('billing:read') },
  ].filter((tab) => tab.visible);
  const [tab, setTab] = useState(tabs[0]?.id);

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="segmented" role="tablist" aria-label="Finanzas">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'facturacion' ? <BillingPage /> : null}
      {tab === 'conciliacion' ? <ReconciliationPanel canWrite={can('billing:write')} /> : null}
      {tab === 'autorizaciones' ? <section className="section-card"><AuthorizationsBoard canWrite={can('coverage:manage')} /></section> : null}
      {tab === 'obras-sociales' ? <section className="section-card"><PayersPanel canWrite={can('coverage:manage') || can('billing:write')} /></section> : null}
    </div>
  );
}
