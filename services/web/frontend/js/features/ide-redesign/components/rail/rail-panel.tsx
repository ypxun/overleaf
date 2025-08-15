import { useFeatureFlag } from '@/shared/context/split-test-context'
import { Panel } from 'react-resizable-panels'
import { useRailContext } from '../../contexts/rail-context'
import classNames from 'classnames'
import { useCallback, useMemo } from 'react'
import usePreviousValue from '@/shared/hooks/use-previous-value'
import { HistorySidebar } from '@/features/ide-react/components/history-sidebar'
import { Tab } from 'react-bootstrap'
import { RailElement } from '../../utils/rail-types'

export default function RailPanel({
  isReviewPanelOpen,
  isHistoryView,
  railTabs,
}: {
  isReviewPanelOpen: boolean
  isHistoryView: boolean
  railTabs: RailElement[]
}) {
  const { selectedTab, panelRef, handlePaneExpand, handlePaneCollapse } =
    useRailContext()

  const newErrorlogs = useFeatureFlag('new-editor-error-logs-redesign')

  const prevTab = usePreviousValue(selectedTab)

  const tabHasChanged = useMemo(() => {
    return prevTab !== selectedTab
  }, [prevTab, selectedTab])

  const onCollapse = useCallback(() => {
    if (!tabHasChanged) {
      handlePaneCollapse()
    }
  }, [tabHasChanged, handlePaneCollapse])

  return (
    <Panel
      id={
        newErrorlogs
          ? `ide-redesign-sidebar-panel-${selectedTab}`
          : 'ide-redesign-sidebar-panel'
      }
      className={classNames({ hidden: isReviewPanelOpen })}
      order={1}
      defaultSize={15}
      minSize={5}
      maxSize={80}
      ref={panelRef}
      collapsible
      onCollapse={onCollapse}
      onExpand={handlePaneExpand}
    >
      {isHistoryView && <HistorySidebar />}
      <div
        className={classNames('ide-rail-content', {
          hidden: isHistoryView,
        })}
      >
        <Tab.Content className="ide-rail-tab-content">
          {railTabs
            .filter(({ hide }) => !hide)
            .map(({ key, component, mountOnFirstLoad }) => (
              <Tab.Pane
                eventKey={key}
                key={key}
                mountOnEnter={!mountOnFirstLoad}
              >
                {component}
              </Tab.Pane>
            ))}
        </Tab.Content>
      </div>
    </Panel>
  )
}
