import { useCrmStore } from '../../../../stores/crm';
import { LeadScoreDetail } from '../../LeadScoreDetail';
import { ProfileEmptyState } from '../ProfileEmptyState';

export default function LeadScoreTab({ contactId }: { contactId: string }) {
  const contact = useCrmStore(s => s.contacts).find(c => c.id === contactId);

  if (!contact) return <ProfileEmptyState message="Contact not found" />;

  return <LeadScoreDetail contact={contact} />;
}
