import { createContext, FC, useCallback, useContext, useState } from 'react'
import useEventListener from '@/shared/hooks/use-event-listener'

type EditorLeftMenuState = {
  settingToFocus?: string
}

export const EditorLeftMenuContext = createContext<
  EditorLeftMenuState | undefined
>(undefined)

export const EditorLeftMenuProvider: FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [value, setValue] = useState<EditorLeftMenuState>(() => ({
    settingToFocus: undefined,
  }))

  useEventListener(
    'ui.focus-setting',
    useCallback((event: CustomEvent<string>) => {
      setValue(value => ({
        ...value,
        settingToFocus: event.detail,
      }))
    }, [])
  )

  return (
    <EditorLeftMenuContext.Provider value={value}>
      {children}
    </EditorLeftMenuContext.Provider>
  )
}

export const useEditorLeftMenuContext = () => {
  const value = useContext(EditorLeftMenuContext)

  if (!value) {
    throw new Error(
      `useEditorLeftMenuContext is only available inside EditorLeftMenuProvider`
    )
  }

  return value
}
