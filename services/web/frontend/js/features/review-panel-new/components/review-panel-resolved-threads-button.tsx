import React, { FC, useRef, useState } from 'react'
import OLOverlay from '@/features/ui/components/ol/ol-overlay'
import OLPopover from '@/features/ui/components/ol/ol-popover'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import { ReviewPanelResolvedThreadsMenu } from './review-panel-resolved-threads-menu'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'
import getMeta from '@/utils/meta'

export const ReviewPanelResolvedThreadsButton: FC = () => {
  const [expanded, setExpanded] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { t } = useTranslation()

  return (
    <>
      <OLTooltip
        id="resolved-comments"
        overlayProps={{ placement: 'bottom' }}
        description={t('resolved_comments')}
      >
        <button
          className={
            getMeta('ol-isReviewerRoleEnabled')
              ? 'review-panel-resolved-comments-toggle-reviewer-role'
              : 'review-panel-resolved-comments-toggle'
          }
          ref={buttonRef}
          onClick={() => setExpanded(true)}
          aria-label={t('resolved_comments')}
        >
          <MaterialIcon type="inbox" />
        </button>
      </OLTooltip>
      {expanded && (
        <OLOverlay
          show
          onHide={() => setExpanded(false)}
          transition={false}
          container={this}
          containerPadding={0}
          placement="bottom"
          rootClose
          target={buttonRef.current}
        >
          <OLPopover
            id="popover-resolved-threads"
            className="review-panel-resolved-comments"
          >
            <ReviewPanelResolvedThreadsMenu />
          </OLPopover>
        </OLOverlay>
      )}
    </>
  )
}
