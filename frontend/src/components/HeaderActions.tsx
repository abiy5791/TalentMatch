import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

/**
 * Lets a page hand its primary action button up to the app header, so the CTA
 * always sits in the same place regardless of which screen is open.
 */
interface HeaderActionsValue {
  actions: ReactNode
  setActions: (node: ReactNode) => void
}

const HeaderActionsContext = createContext<HeaderActionsValue>({
  actions: null,
  setActions: () => {},
})

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null)
  return (
    <HeaderActionsContext.Provider value={{ actions, setActions }}>{children}</HeaderActionsContext.Provider>
  )
}

/** Read the currently registered action node — used by the header itself. */
export function useHeaderActionSlot() {
  return useContext(HeaderActionsContext).actions
}

/** Register this page's header action. Pass the same deps you would to useMemo. */
export function useHeaderActions(node: ReactNode, deps: unknown[]) {
  const { setActions } = useContext(HeaderActionsContext)
  useEffect(() => {
    setActions(node)
    return () => setActions(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
