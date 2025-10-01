import { Trans, useTranslation } from 'react-i18next'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import StartFreeTrialButton from '../../../shared/components/start-free-trial-button'
import { memo, useCallback, useMemo } from 'react'
import PdfLogEntry from './pdf-log-entry'
import { useStopOnFirstError } from '../../../shared/hooks/use-stop-on-first-error'
import OLButton from '@/shared/components/ol/ol-button'
import * as eventTracking from '../../../infrastructure/event-tracking'
import getMeta from '@/utils/meta'
import {
  populateEditorRedesignSegmentation,
  useEditorAnalytics,
} from '@/shared/hooks/use-editor-analytics'
import {
  isNewUser,
  useIsNewEditorEnabled,
  useIsNewErrorLogsPositionEnabled,
} from '@/features/ide-redesign/utils/new-editor-utils'
import { getSplitTestVariant } from '@/utils/splitTestUtils'

function TimeoutUpgradePromptNew() {
  const {
    startCompile,
    lastCompileOptions,
    setAnimateCompileDropdownArrow,
    isProjectOwner,
  } = useDetachCompileContext()
  const newEditor = useIsNewEditorEnabled()

  const { enableStopOnFirstError } = useStopOnFirstError({
    eventSource: 'timeout-new',
  })

  const handleEnableStopOnFirstErrorClick = useCallback(() => {
    enableStopOnFirstError()
    startCompile({ stopOnFirstError: true })
    setAnimateCompileDropdownArrow(true)
  }, [enableStopOnFirstError, startCompile, setAnimateCompileDropdownArrow])

  const { compileTimeout } = getMeta('ol-compileSettings')

  const sharedSegmentation = useMemo(
    () =>
      populateEditorRedesignSegmentation(
        {
          'is-owner': isProjectOwner,
          compileTime: compileTimeout,
          location: 'logs',
        },
        newEditor
      ),
    [isProjectOwner, compileTimeout, newEditor]
  )

  return (
    <>
      <CompileTimeout
        isProjectOwner={isProjectOwner}
        segmentation={sharedSegmentation}
      />
      {getMeta('ol-ExposedSettings').enableSubscriptions && (
        <PreventTimeoutHelpMessage
          handleEnableStopOnFirstErrorClick={handleEnableStopOnFirstErrorClick}
          lastCompileOptions={lastCompileOptions}
          segmentation={sharedSegmentation}
        />
      )}
    </>
  )
}

type CompileTimeoutProps = {
  isProjectOwner: boolean
  segmentation: eventTracking.Segmentation
}

const CompileTimeout = memo(function CompileTimeout({
  isProjectOwner,
  segmentation,
}: CompileTimeoutProps) {
  const { t } = useTranslation()
  const newLogsPosition = useIsNewErrorLogsPositionEnabled()

  const extraSearchParams = useMemo(() => {
    if (!isNewUser()) {
      return undefined
    }

    const variant = getSplitTestVariant('editor-redesign-new-users')

    if (!variant) {
      return undefined
    }

    return {
      itm_content: variant,
    }
  }, [])

  return (
    <PdfLogEntry
      autoExpand={!newLogsPosition}
      headerTitle={t('your_compile_timed_out')}
      formattedContent={
        getMeta('ol-ExposedSettings').enableSubscriptions && (
          <>
            <p>
              {isProjectOwner
                ? t('your_project_exceeded_compile_timeout_limit_on_free_plan')
                : t('this_project_exceeded_compile_timeout_limit_on_free_plan')}
            </p>
            {isProjectOwner ? (
              <p>
                <strong>{t('upgrade_for_more_compile_time')}</strong>{' '}
                {t(
                  'plus_additional_collaborators_document_history_track_changes_and_more'
                )}
              </p>
            ) : (
              <Trans
                i18nKey="tell_the_project_owner_and_ask_them_to_upgrade"
                components={[
                  // eslint-disable-next-line react/jsx-key
                  <strong />,
                ]}
              />
            )}

            {isProjectOwner && (
              <p className="text-center">
                <StartFreeTrialButton
                  source="compile-timeout"
                  buttonProps={{ variant: 'primary', className: 'w-100' }}
                  segmentation={segmentation}
                  extraSearchParams={extraSearchParams}
                >
                  {t('start_a_free_trial')}
                </StartFreeTrialButton>
              </p>
            )}
          </>
        )
      }
      // @ts-ignore
      entryAriaLabel={t('your_compile_timed_out')}
      level="error"
    />
  )
})

type PreventTimeoutHelpMessageProps = {
  lastCompileOptions: any
  handleEnableStopOnFirstErrorClick: () => void
  segmentation: eventTracking.Segmentation
}

const PreventTimeoutHelpMessage = memo(function PreventTimeoutHelpMessage({
  lastCompileOptions,
  handleEnableStopOnFirstErrorClick,
  segmentation,
}: PreventTimeoutHelpMessageProps) {
  const { t } = useTranslation()
  const { sendEvent } = useEditorAnalytics()
  const newLogsPosition = useIsNewErrorLogsPositionEnabled()

  function sendInfoClickEvent() {
    sendEvent('paywall-info-click', {
      ...segmentation,
      'paywall-type': 'compile-timeout',
      content: 'blog',
    })
  }

  const compileTimeoutChangesBlogLink = (
    /* eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key */
    <a
      aria-label={t('read_more_about_free_compile_timeouts_servers')}
      href="/blog/changes-to-free-compile-timeout"
      rel="noopener noreferrer"
      target="_blank"
      onClick={sendInfoClickEvent}
    />
  )

  return (
    <PdfLogEntry
      autoExpand={!newLogsPosition}
      headerTitle={t('reasons_for_compile_timeouts')}
      formattedContent={
        <>
          <p>
            <em>
              <Trans
                i18nKey="weve_reduced_compile_timeout"
                components={[compileTimeoutChangesBlogLink]}
              />
            </em>
          </p>
          <p>{t('common_causes_of_compile_timeouts_include')}:</p>
          <ul>
            <li>
              <Trans
                i18nKey="project_timed_out_optimize_images"
                components={[
                  // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                  <a
                    href="/learn/how-to/Optimising_very_large_image_files"
                    rel="noopener noreferrer"
                    target="_blank"
                  />,
                ]}
              />
            </li>
            <li>
              <Trans
                i18nKey="a_fatal_compile_error_that_completely_blocks_compilation"
                components={[
                  // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                  <a
                    href="/learn/how-to/Fixing_and_preventing_compile_timeouts#Step_3:_Assess_your_project_for_time-consuming_tasks_and_fatal_errors"
                    rel="noopener noreferrer"
                    target="_blank"
                  />,
                ]}
              />
              {!lastCompileOptions.stopOnFirstError && (
                <>
                  {' '}
                  <Trans
                    i18nKey="enable_stop_on_first_error_under_recompile_dropdown_menu"
                    components={[
                      // eslint-disable-next-line react/jsx-key
                      <OLButton
                        variant="link"
                        className="btn-inline-link fw-bold"
                        size="sm"
                        onClick={handleEnableStopOnFirstErrorClick}
                      />,
                      // eslint-disable-next-line react/jsx-key
                      <strong />,
                    ]}
                  />{' '}
                </>
              )}
            </li>
          </ul>
          <p>
            <Trans
              i18nKey="project_timed_out_learn_more"
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content, react/jsx-key
                <a
                  href="/learn/how-to/Fixing_and_preventing_compile_timeouts"
                  rel="noopener noreferrer"
                  target="_blank"
                />,
              ]}
            />
          </p>
        </>
      }
      // @ts-ignore
      entryAriaLabel={t('reasons_for_compile_timeouts')}
      level="raw"
    />
  )
})

export default memo(TimeoutUpgradePromptNew)
