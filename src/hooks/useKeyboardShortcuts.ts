import { useEffect } from 'react';
import { useAgentStore } from '../stores/agents';

export function useKeyboardShortcuts() {
  const { teams, activeAgentId, setActiveAgent } = useAgentStore();
  
  // Flatten agents for quick switching
  const allAgents = teams.flatMap(t => t.agents);
  const currentIndex = allAgents.findIndex(a => a.id === activeAgentId);

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

      // Escape to focus chat input
      if (e.key === 'Escape') {
        const input = document.querySelector('textarea');
        input?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allAgents, currentIndex, setActiveAgent]);
}
