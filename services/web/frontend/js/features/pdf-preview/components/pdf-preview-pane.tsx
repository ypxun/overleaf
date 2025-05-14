import { ElementType, memo, Suspense } from 'react'
import classNames from 'classnames'
import PdfLogsViewer from './pdf-logs-viewer'
import PdfViewer from './pdf-viewer'
import { FullSizeLoadingSpinner } from '../../../shared/components/loading-spinner'
import PdfHybridPreviewToolbar from './pdf-preview-hybrid-toolbar'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import { PdfPreviewMessages } from './pdf-preview-messages'
import CompileTimeWarningUpgradePrompt from './compile-time-warning-upgrade-prompt'
import { PdfPreviewProvider } from './pdf-preview-provider'
import PdfPreviewHybridToolbarNew from '@/features/ide-redesign/components/pdf-preview/pdf-preview-hybrid-toolbar'
import PdfErrorState from '@/features/ide-redesign/components/pdf-preview/pdf-error-state'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'

function PdfPreviewPane() {
  const { pdfUrl, hasShortCompileTimeout } = useCompileContext()
  const classes = classNames('pdf', 'full-size', {
    'pdf-empty': !pdfUrl,
  })
  const newEditor = useIsNewEditorEnabled()
  const pdfPromotions = importOverleafModules('pdfPreviewPromotions') as {
    import: { default: ElementType }
    path: string
  }[]

  return (
    <div className={classes}>
      <PdfPreviewProvider>
        {newEditor ? (
          <PdfPreviewHybridToolbarNew />
        ) : (
          <PdfHybridPreviewToolbar />
        )}
        <PdfPreviewMessages>
          {hasShortCompileTimeout && <CompileTimeWarningUpgradePrompt />}
        </PdfPreviewMessages>
        <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
          <div className="pdf-viewer">
            <PdfViewer />
          </div>
        </Suspense>
        {newEditor ? <PdfErrorState /> : <PdfLogsViewer />}
        {pdfPromotions.map(({ import: { default: Component }, path }) => (
          <Component key={path} />
        ))}
      </PdfPreviewProvider>
    </div>
  )
}

export default memo(PdfPreviewPane)
