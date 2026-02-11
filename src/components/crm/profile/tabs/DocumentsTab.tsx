import { DocumentSection } from '../../../documents/DocumentSection';
import type { DocumentEntityType } from '../../../../types/documents';

export default function DocumentsTab({ entityType, entityId }: { entityType: string; entityId: string }) {
  return <DocumentSection entityType={entityType as DocumentEntityType} entityId={entityId} />;
}
