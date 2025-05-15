import getMeta from '@/utils/meta'
import { debounce } from 'lodash'

export const OFFSET_FOR_ENTRIES_ABOVE = 70
const COLLAPSED_HEADER_HEIGHT = getMeta('ol-isReviewerRoleEnabled') ? 42 : 75
const GAP_BETWEEN_ENTRIES = 4

export const positionItems = debounce(
  (
    element: HTMLDivElement,
    previousFocusedItemIndex: number | undefined,
    docId: string
  ) => {
    const items = Array.from(
      element.querySelectorAll<HTMLDivElement>('.review-panel-entry')
    )

    items.sort((a, b) => Number(a.dataset.pos) - Number(b.dataset.pos))

    if (!items.length) {
      return
    }

    let activeItemIndex = items.findIndex(item =>
      item.classList.contains('review-panel-entry-selected')
    )

    if (activeItemIndex === -1) {
      // if entry was not selected manually
      // check if there is an entry in selection and use that as the focused item
      activeItemIndex = items.findIndex(item =>
        item.classList.contains('review-panel-entry-highlighted')
      )
    }

    if (activeItemIndex === -1) {
      activeItemIndex = previousFocusedItemIndex || 0
    }

    const activeItem = items[activeItemIndex]
    if (!activeItem) {
      return
    }

    const activeItemTop = getTopPosition(activeItem, activeItemIndex === 0)

    const positions: [HTMLElement, number][] = []
    positions.push([activeItem, activeItemTop])

    // above the active item
    let topLimit = activeItemTop
    for (let i = activeItemIndex - 1; i >= 0; i--) {
      const item = items[i]
      const height = item.offsetHeight
      let top = getTopPosition(item, i === 0)
      const bottom = top + height
      if (bottom > topLimit) {
        top = topLimit - height - GAP_BETWEEN_ENTRIES
      }
      positions.push([item, top])
      topLimit = top
    }

    // below the active item
    let bottomLimit = activeItemTop + activeItem.offsetHeight
    for (let i = activeItemIndex + 1; i < items.length; i++) {
      const item = items[i]
      const height = item.offsetHeight
      let top = getTopPosition(item, false)
      if (top < bottomLimit) {
        top = bottomLimit + GAP_BETWEEN_ENTRIES
      }
      positions.push([item, top])
      bottomLimit = top + height
    }

    for (const [item, top] of positions) {
      item.style.top = `${top}px`
      item.style.visibility = 'visible'
    }

    return {
      docId,
      activeItemIndex,
    }
  },
  100,
  { leading: false, trailing: true, maxWait: 1000 }
)

function getTopPosition(item: HTMLDivElement, isFirstEntry: boolean) {
  const offset = isFirstEntry ? 0 : OFFSET_FOR_ENTRIES_ABOVE
  return Math.max(COLLAPSED_HEADER_HEIGHT + offset, Number(item.dataset.top))
}
