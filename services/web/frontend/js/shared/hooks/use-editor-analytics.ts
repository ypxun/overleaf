import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import {
  Segmentation,
  sendMB,
  sendMBOnce,
  sendMBSampled,
} from '@/infrastructure/event-tracking'
import { useCallback } from 'react'

export const useEditorAnalytics = () => {
  const editorRedesign = useIsNewEditorEnabled()

  const populateSegmentation = useCallback(
    (segmentation: Segmentation | undefined = {}): Segmentation => {
      return editorRedesign
        ? { ...segmentation, 'editor-redesign': 'enabled' }
        : segmentation
    },
    [editorRedesign]
  )

  const sendEvent: typeof sendMB = useCallback(
    (key, segmentation) => {
      sendMB(key, populateSegmentation(segmentation))
    },
    [populateSegmentation]
  )

  const sendEventOnce: typeof sendMBOnce = useCallback(
    (key, segmentation) => {
      sendMBOnce(key, populateSegmentation(segmentation))
    },
    [populateSegmentation]
  )

  const sendEventSampled: typeof sendMBSampled = useCallback(
    (key, segmentation, rate) => {
      sendMBSampled(key, populateSegmentation(segmentation), rate)
    },
    [populateSegmentation]
  )

  return { sendEvent, sendEventOnce, sendEventSampled }
}
