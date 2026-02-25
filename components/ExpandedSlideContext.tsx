"use client";

import { createContext, useContext, useState } from "react";

type ExpandedSlideContextValue = {
  expandedSlideId: string | null;
  setExpandedSlideId: (id: string | null) => void;
};

const ExpandedSlideContext = createContext<ExpandedSlideContextValue | null>(null);

export function ExpandedSlideProvider({ children }: { children: React.ReactNode }) {
  const [expandedSlideId, setExpandedSlideId] = useState<string | null>(null);
  return (
    <ExpandedSlideContext.Provider value={{ expandedSlideId, setExpandedSlideId }}>
      {children}
    </ExpandedSlideContext.Provider>
  );
}

export function useExpandedSlide(): ExpandedSlideContextValue {
  const ctx = useContext(ExpandedSlideContext);
  if (!ctx) throw new Error("useExpandedSlide must be used within ExpandedSlideProvider");
  return ctx;
}
