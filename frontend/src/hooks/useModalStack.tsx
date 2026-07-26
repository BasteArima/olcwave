import { createContext, useContext, useRef, useCallback, type ReactNode } from 'react'

interface ModalStackContextType {
  register: () => symbol
  unregister: (id: symbol) => void
  isTop: (id: symbol) => boolean
}

const ModalStackContext = createContext<ModalStackContextType | null>(null)

export function ModalStackProvider({ children }: { children: ReactNode }) {
  const stackRef = useRef<symbol[]>([])

  const register = useCallback(() => {
    const id = Symbol('modal')
    stackRef.current.push(id)
    if (stackRef.current.length === 1) {
      document.body.style.overflow = 'hidden'
    }
    return id
  }, [])

  const unregister = useCallback((id: symbol) => {
    const idx = stackRef.current.lastIndexOf(id)
    if (idx !== -1) {
      stackRef.current.splice(idx, 1)
    }
    if (stackRef.current.length === 0) {
      document.body.style.overflow = ''
    }
  }, [])

  const isTop = useCallback((id: symbol) => {
    const s = stackRef.current
    return s.length > 0 && s[s.length - 1] === id
  }, [])

  return (
    <ModalStackContext.Provider value={{ register, unregister, isTop }}>
      {children}
    </ModalStackContext.Provider>
  )
}

export function useModalStack() {
  const ctx = useContext(ModalStackContext)
  if (!ctx) throw new Error('useModalStack must be used within ModalStackProvider')
  return ctx
}
