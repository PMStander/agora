import { ProfileEmptyState } from '../ProfileEmptyState';

export default function MissionsTab({ projectId }: { projectId: string }) {
  void projectId;
  return <ProfileEmptyState message="No missions linked yet" />;
}
