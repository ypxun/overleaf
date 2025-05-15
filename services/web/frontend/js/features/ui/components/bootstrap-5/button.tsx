import { forwardRef } from 'react'
import { Button as BS5Button, Spinner } from 'react-bootstrap-5'
import type { ButtonProps } from '@/features/ui/components/types/button-props'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import MaterialIcon from '@/shared/components/material-icon'

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      leadingIcon,
      isLoading = false,
      loadingLabel,
      trailingIcon,
      variant = 'primary',
      ...props
    },
    ref
  ) => {
    const { t } = useTranslation()

    const buttonClassName = classNames('d-inline-grid', className, {
      'button-loading': isLoading,
    })

    const loadingSpinnerClassName =
      props.size === 'lg' ? 'loading-spinner-large' : 'loading-spinner-small'
    const materialIconClassName =
      props.size === 'lg' ? 'icon-large' : 'icon-small'

    const leadingIconComponent =
      leadingIcon && typeof leadingIcon === 'string' ? (
        <MaterialIcon type={leadingIcon} className={materialIconClassName} />
      ) : (
        leadingIcon
      )

    const trailingIconComponent =
      trailingIcon && typeof trailingIcon === 'string' ? (
        <MaterialIcon type={trailingIcon} className={materialIconClassName} />
      ) : (
        trailingIcon
      )

    return (
      <BS5Button
        className={buttonClassName}
        variant={variant}
        {...props}
        ref={ref}
        disabled={isLoading || props.disabled}
        data-ol-loading={isLoading}
        role={undefined}
      >
        {isLoading && (
          <span className="spinner-container">
            <Spinner
              animation="border"
              aria-hidden="true"
              as="span"
              className={loadingSpinnerClassName}
              role="status"
            />
            <span className="visually-hidden">
              {loadingLabel ?? t('loading')}
            </span>
          </span>
        )}
        <span className="button-content" aria-hidden={isLoading}>
          {leadingIconComponent}
          {children}
          {trailingIconComponent}
        </span>
      </BS5Button>
    )
  }
)
Button.displayName = 'Button'

export default Button
