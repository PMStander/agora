import { useEffect } from 'react';
import { useAgentStore } from '../stores/agents';
import { useMissionControlStore } from '../stores/missionControl';

export function useKeyboardShortcuts() {
  const teams = useAgentStore((s) => s.teams);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const setActiveAgent = useAgentStore((s) => s.setActiveAgent);
  
  // Flatten agents for quick switching
  const allAgents = teams.flatMap(t => t.agents);
  const currentIndex = allAgents.findIndex(a => a.id === activeAgentId);
  const teamLeads = {
    orchestrator: teams.find((t) => t.id === 'orchestrator')?.agents[0]?.id,
    personal: teams.find((t) => t.id === 'personal')?.agents[0]?.id,
    business: teams.find((t) => t.id === 'business')?.agents[0]?.id,
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + number to switch agents
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < allAgents.length) {
          setActiveAgent(allAgents[index].id);
        }
      }

      // Cmd/Ctrl + [ or ] to navigate agents
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '[' && currentIndex > 0) {
          e.preventDefault();
          setActiveAgent(allAgents[currentIndex - 1].id);
        } else if (e.key === ']' && currentIndex < allAgents.length - 1) {
          e.preventDefault();
          setActiveAgent(allAgents[currentIndex + 1].id);
        }
      }

      // Cmd/Ctrl + Shift + O/P/B routes to Orchestrator/Personal/Business lead
      // Cmd/Ctrl + Shift + N opens Launch Operation wizard
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === 'o' && teamLeads.orchestrator) {
          e.preventDefault();
          setActiveAgent(teamLeads.orchestrator);
        } else if (key === 'p' && teamLeads.personal) {
          e.preventDefault();
          setActiveAgent(teamLeads.personal);
        } else if (key === 'b' && teamLeads.business) {
          e.preventDefault();
          setActiveAgent(teamLeads.business);
        } else if (key === 'n') {
          e.preventDefault();
          useMissionControlStore.getState().setOperationWizardOpen(true);
        }
      }

      // Escape to focus chat input
      if (e.key === 'Escape') {
        const input = document.querySelector('textarea');
        input?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allAgents, currentIndex, setActiveAgent, teamLeads.business, teamLeads.orchestrator, teamLeads.personal]);
}
