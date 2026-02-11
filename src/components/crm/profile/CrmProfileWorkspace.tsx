import { lazy, Suspense } from 'react';
import { useCrmStore } from '../../../stores/crm';
import { ProfileBreadcrumb } from './ProfileBreadcrumb';

const ContactProfile = lazy(() => import('./ContactProfile'));
const CompanyProfile = lazy(() => import('./CompanyProfile'));
const DealProfile = lazy(() => import('./DealProfile'));
const QuoteProfile = lazy(() => import('./QuoteProfile'));
const InvoiceProfile = lazy(() => import('./InvoiceProfile'));
const ProjectProfile = lazy(() => import('./ProjectProfile'));

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64 text-zinc-500">
      Loading...
    </div>
  );
}

export function CrmProfileWorkspace() {
  const entityType = useCrmStore((s) => s.profileWorkspaceEntityType);
  const entityId = useCrmStore((s) => s.profileWorkspaceEntityId);

  if (!entityType || !entityId) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        No entity selected
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <ProfileBreadcrumb />
      <Suspense fallback={<TabLoadingFallback />}>
        {entityType === 'contact' && <ContactProfile contactId={entityId} />}
        {entityType === 'company' && <CompanyProfile companyId={entityId} />}
        {entityType === 'deal' && <DealProfile dealId={entityId} />}
        {entityType === 'quote' && <QuoteProfile quoteId={entityId} />}
        {entityType === 'invoice' && <InvoiceProfile invoiceId={entityId} />}
        {entityType === 'project' && <ProjectProfile projectId={entityId} />}
      </Suspense>
    </div>
  );
}
