import { Spinner } from 'react-bootstrap'

export type OLSpinnerSize = 'sm' | 'lg'

function OLSpinner({ size = 'sm' }: { size: OLSpinnerSize }) {
  return (
    <Spinner
      size={size === 'sm' ? 'sm' : undefined}
      animation="border"
      aria-hidden="true"
      role="status"
    />
  )
}

export default OLSpinner
