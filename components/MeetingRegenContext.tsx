"use client";

import { createContext, useContext, useState } from "react";

const Ctx = createContext<{ regenerating: boolean; setRegenerating: (v: boolean) => void }>({
  regenerating: false,
  setRegenerating: () => {},
});

export function MeetingRegenProvider({ children }: { children: React.ReactNode }) {
  const [regenerating, setRegenerating] = useState(false);
  return <Ctx.Provider value={{ regenerating, setRegenerating }}>{children}</Ctx.Provider>;
}

export function useMeetingRegen() {
  return useContext(Ctx);
}
