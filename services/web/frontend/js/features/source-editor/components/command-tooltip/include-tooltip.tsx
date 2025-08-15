import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useIncludedFile } from '@/features/source-editor/hooks/use-included-file'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'

export const IncludeTooltipContent: FC = () => {
  const { t } = useTranslation()
  const { openIncludedFile } = useIncludedFile('IncludeArgument')

  return (
    <div className="ol-cm-command-tooltip-content">
      <OLButton
        variant="link"
        type="button"
        className="ol-cm-command-tooltip-link"
        onClick={openIncludedFile}
      >
        <MaterialIcon type="edit" />
        {t('open_file')}
      </OLButton>
    </div>
  )
}
