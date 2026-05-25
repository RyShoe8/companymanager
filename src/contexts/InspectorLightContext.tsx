'use client';

import { createContext, useContext, type ReactNode } from 'react';

const InspectorLightContext = createContext(false);

export function InspectorLightProvider({
  value = true,
  children,
}: {
  value?: boolean;
  children: ReactNode;
}) {
  return (
    <InspectorLightContext.Provider value={value}>
      {children}
    </InspectorLightContext.Provider>
  );
}

export function useInspectorLight(): boolean {
  return useContext(InspectorLightContext);
}

/** When isLight, return only light classes; otherwise include dark pair. */
export function lightSurface(light: string, dark: string, isLight: boolean): string {
  return isLight ? light : `${light} ${dark}`;
}
