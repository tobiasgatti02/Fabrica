import '../workspace.css';
import { WorkspaceSkeleton } from '@/components/fabrica/workspace-skeleton';

export default function WorkspaceLoading() {
  return (
    <main className="workspace-app" aria-busy="true">
      <WorkspaceSkeleton />
    </main>
  );
}
