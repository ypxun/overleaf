import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRefWithAutoFocus } from '../../../../shared/hooks/use-ref-with-auto-focus'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import { DuplicateFilenameError } from '../../errors'
import { isCleanFilename } from '../../util/safe-path'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLButton from '@/features/ui/components/ol/ol-button'

function FileTreeModalCreateFolder() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [validName, setValidName] = useState(true)

  const { isCreatingFolder, inFlight, finishCreatingFolder, cancel, error } =
    useFileTreeActionable()

  useEffect(() => {
    if (!isCreatingFolder) {
      // clear the input when the modal is closed
      setName('')
    }
  }, [isCreatingFolder])

  if (!isCreatingFolder) return null // the modal will not be rendered; return early

  function handleHide() {
    cancel()
  }

  function handleCreateFolder() {
    finishCreatingFolder(name)
  }

  function errorMessage() {
    switch (error.constructor) {
      case DuplicateFilenameError:
        return t('file_already_exists')
      default:
        return t('generic_something_went_wrong')
    }
  }

  return (
    <OLModal show onHide={handleHide}>
      <OLModalHeader>
        <OLModalTitle>{t('new_folder')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <InputName
          name={name}
          setName={setName}
          validName={validName}
          setValidName={setValidName}
          handleCreateFolder={handleCreateFolder}
        />
        {!validName ? (
          <div
            role="alert"
            aria-label={t('files_cannot_include_invalid_characters')}
            className="alert alert-danger file-tree-modal-alert"
          >
            {t('files_cannot_include_invalid_characters')}
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            aria-label={errorMessage()}
            className="alert alert-danger file-tree-modal-alert"
          >
            {errorMessage()}
          </div>
        ) : null}
      </OLModalBody>

      <OLModalFooter>
        {inFlight ? (
          <OLButton variant="primary" disabled isLoading={inFlight} />
        ) : (
          <>
            <OLButton variant="secondary" onClick={handleHide}>
              {t('cancel')}
            </OLButton>
            <OLButton
              variant="primary"
              onClick={handleCreateFolder}
              disabled={!validName}
            >
              {t('create')}
            </OLButton>
          </>
        )}
      </OLModalFooter>
    </OLModal>
  )
}

function InputName({
  name,
  setName,
  validName,
  setValidName,
  handleCreateFolder,
}: {
  name: string
  setName: (name: string) => void
  validName: boolean
  setValidName: (validName: boolean) => void
  handleCreateFolder: () => void
}) {
  const { autoFocusedRef } = useRefWithAutoFocus<HTMLInputElement>()

  function handleFocus(ev: React.FocusEvent<HTMLInputElement>) {
    ev.target.setSelectionRange(0, -1)
  }

  function handleChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setValidName(isCleanFilename(ev.target.value.trim()))
    setName(ev.target.value)
  }

  function handleKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === 'Enter' && validName) {
      handleCreateFolder()
    }
  }

  return (
    <input
      ref={autoFocusedRef}
      className="form-control"
      type="text"
      value={name}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      onFocus={handleFocus}
    />
  )
}

export default FileTreeModalCreateFolder
