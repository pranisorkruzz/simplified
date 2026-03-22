import { createContext, useContext, useMemo, useState } from 'react';
import type { EmailBrief } from '@/lib/briefs';

type KanbanContextValue = {
  activeBriefId: string | null;
  activeBrief: EmailBrief | null;
  isGenerating: boolean;
  setActiveBrief: (briefId: string | null, brief: EmailBrief | null) => void;
  setIsGenerating: (value: boolean) => void;
};

const KanbanContext = createContext<KanbanContextValue | undefined>(undefined);

export function KanbanProvider({ children }: { children: React.ReactNode }) {
  const [activeBriefId, setActiveBriefId] = useState<string | null>(null);
  const [activeBrief, setActiveBrief] = useState<EmailBrief | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const setActive = (briefId: string | null, brief: EmailBrief | null) => {
    setActiveBriefId(briefId);
    setActiveBrief(brief);
  };

  const value = useMemo(
    () => ({
      activeBriefId,
      activeBrief,
      isGenerating,
      setActiveBrief: setActive,
      setIsGenerating,
    }),
    [activeBriefId, activeBrief, isGenerating],
  );

  return (
    <KanbanContext.Provider value={value}>{children}</KanbanContext.Provider>
  );
}

export function useKanban() {
  const context = useContext(KanbanContext);

  if (!context) {
    throw new Error('useKanban must be used within a KanbanProvider');
  }

  return context;
}
