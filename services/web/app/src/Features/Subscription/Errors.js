const Errors = require('../Errors/Errors')
const OError = require('@overleaf/o-error')

class RecurlyTransactionError extends Errors.BackwardCompatibleError {
  constructor(options) {
    super({
      message: 'Unknown transaction error',
      ...options,
    })
  }
}

class DuplicateAddOnError extends OError {}

class AddOnNotPresentError extends OError {}

class MissingBillingInfoError extends OError {}

class ManuallyCollectedError extends OError {}

class PendingChangeError extends OError {}

class InactiveError extends OError {}

class SubtotalLimitExceededError extends OError {}

class HasPastDueInvoiceError extends OError {}

module.exports = {
  RecurlyTransactionError,
  DuplicateAddOnError,
  AddOnNotPresentError,
  MissingBillingInfoError,
  ManuallyCollectedError,
  PendingChangeError,
  InactiveError,
  SubtotalLimitExceededError,
  HasPastDueInvoiceError,
}
