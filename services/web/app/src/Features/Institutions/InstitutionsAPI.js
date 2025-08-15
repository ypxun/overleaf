const { callbackify } = require('util')
const OError = require('@overleaf/o-error')
const logger = require('@overleaf/logger')
const settings = require('@overleaf/settings')
const request = require('requestretry')
const { promisifyAll } = require('@overleaf/promise-utils')
const NotificationsBuilder = require('../Notifications/NotificationsBuilder')
const {
  V1ConnectionError,
  InvalidInstitutionalEmailError,
} = require('../Errors/Errors')
const { fetchJson, fetchNothing } = require('@overleaf/fetch-utils')
const { promiseMapWithLimit } = require('@overleaf/promise-utils')
const Modules = require('../../infrastructure/Modules')

function _makeRequestOptions(options) {
  const requestOptions = {
    method: options.method,
    basicAuth: { user: settings.apis.v1.user, password: settings.apis.v1.pass },
    signal: AbortSignal.timeout(settings.apis.v1.timeout),
  }

  if (options.body) {
    requestOptions.json = options.body
  }

  return requestOptions
}

function _responseErrorHandling(options, error) {
  const status = error.response.status

  if (status >= 500) {
    throw new V1ConnectionError({
      message: 'error getting affiliations from v1',
      info: {
        status,
        body: error.body,
      },
    })
  }

  let errorBody

  try {
    if (error.body) {
      errorBody = JSON.parse(error.body)
    }
  } catch (e) {}

  let errorMessage
  if (errorBody?.errors) {
    errorMessage = `${status}: ${errorBody.errors}`
  } else {
    errorMessage = `${options.defaultErrorMessage}: ${status}`
  }

  throw new OError(errorMessage, { status })
}

async function _affiliationRequestFetchJson(options) {
  if (!settings.apis.v1.url) {
    return
  } // service is not configured

  const url = `${settings.apis.v1.url}${options.path}`

  const requestOptions = _makeRequestOptions(options)

  try {
    return await fetchJson(url, requestOptions)
  } catch (error) {
    _responseErrorHandling(options, error)
  }
}

async function _affiliationRequestFetchNothing(options) {
  if (!settings.apis.v1.url) {
    return
  } // service is not configured

  const url = `${settings.apis.v1.url}${options.path}`

  const requestOptions = _makeRequestOptions(options)

  try {
    await fetchNothing(url, requestOptions)
  } catch (error) {
    _responseErrorHandling(options, error)
  }
}

async function _affiliationRequestFetchNothing404Ok(options) {
  try {
    await _affiliationRequestFetchNothing(options)
  } catch (error) {
    const status = error.info?.status
    if (status !== 404) {
      throw error
    }
  }
}

function getInstitutionAffiliations(institutionId, callback) {
  makeAffiliationRequest(
    {
      method: 'GET',
      path: `/api/v2/institutions/${institutionId.toString()}/affiliations`,
      defaultErrorMessage: "Couldn't get institution affiliations",
    },
    (error, body) => callback(error, body || [])
  )
}

function getConfirmedInstitutionAffiliations(institutionId, callback) {
  makeAffiliationRequest(
    {
      method: 'GET',
      path: `/api/v2/institutions/${institutionId.toString()}/confirmed_affiliations`,
      defaultErrorMessage: "Couldn't get institution affiliations",
    },
    (error, body) => callback(error, body || [])
  )
}

function getInstitutionAffiliationsCounts(institutionId, callback) {
  makeAffiliationRequest(
    {
      method: 'GET',
      path: `/api/v2/institutions/${institutionId.toString()}/affiliations_counts`,
      defaultErrorMessage: "Couldn't get institution counts",
    },
    (error, body) => callback(error, body || [])
  )
}

function getLicencesForAnalytics(lag, queryDate, callback) {
  makeAffiliationRequest(
    {
      method: 'GET',
      path: `/api/v2/institutions/institutions_licences`,
      body: { query_date: queryDate, lag },
      defaultErrorMessage: 'Could not get institutions licences',
    },
    callback
  )
}

function getUserAffiliations(userId, callback) {
  makeAffiliationRequest(
    {
      method: 'GET',
      path: `/api/v2/users/${userId.toString()}/affiliations`,
      defaultErrorMessage: "Couldn't get user affiliations",
    },
    async (error, body) => {
      if (error) {
        return callback(error, [])
      }

      const affiliations = []

      if (body?.length > 0) {
        const concurrencyLimit = 10
        await promiseMapWithLimit(concurrencyLimit, body, async affiliation => {
          if (!affiliation.institution.commonsAccount) {
            const group = (
              await Modules.promises.hooks.fire(
                'getGroupWithDomainCaptureByV1Id',
                affiliation.institution.id
              )
            )?.[0]

            if (group) {
              affiliation.group = {
                domainCaptureEnabled: Boolean(group.domainCaptureEnabled),
              }
            }
          }

          affiliations.push(affiliation)
        })
      }

      callback(null, affiliations)
    }
  )
}

async function getUsersNeedingReconfirmationsLapsedProcessed() {
  return await _affiliationRequestFetchJson({
    method: 'GET',
    path: '/api/v2/institutions/need_reconfirmation_lapsed_processed',
    defaultErrorMessage:
      'Could not get users that need reconfirmations lapsed processed',
  })
}

async function addAffiliation(userId, email, affiliationOptions) {
  const {
    university,
    department,
    role,
    confirmedAt,
    entitlement,
    rejectIfBlocklisted,
  } = affiliationOptions

  try {
    await _affiliationRequestFetchNothing({
      method: 'POST',
      path: `/api/v2/users/${userId.toString()}/affiliations`,
      body: {
        email,
        university,
        department,
        role,
        confirmedAt,
        entitlement,
        rejectIfBlocklisted,
      },
      defaultErrorMessage: "Couldn't create affiliation",
    })
  } catch (error) {
    if (error.info?.status === 422) {
      throw new InvalidInstitutionalEmailError(error.message).withCause(error)
    }
    throw error
  }

  if (!university) {
    return
  }

  // have notifications delete any ip matcher notifications for this university
  try {
    await NotificationsBuilder.promises
      .ipMatcherAffiliation(userId)
      .read(university.id)
  } catch (err) {
    // log and ignore error
    logger.err({ err }, 'Something went wrong marking ip notifications read')
  }
}

async function removeAffiliation(userId, email) {
  await _affiliationRequestFetchNothing404Ok({
    method: 'POST',
    path: `/api/v2/users/${userId.toString()}/affiliations/remove`,
    body: { email },
    defaultErrorMessage: "Couldn't remove affiliation",
  })
}

function endorseAffiliation(userId, email, role, department, callback) {
  makeAffiliationRequest(
    {
      method: 'POST',
      path: `/api/v2/users/${userId.toString()}/affiliations/endorse`,
      body: { email, role, department },
      defaultErrorMessage: "Couldn't endorse affiliation",
    },
    callback
  )
}

function deleteAffiliations(userId, callback) {
  makeAffiliationRequest(
    {
      method: 'DELETE',
      path: `/api/v2/users/${userId.toString()}/affiliations`,
      defaultErrorMessage: "Couldn't delete affiliations",
    },
    callback
  )
}

function addEntitlement(userId, email, callback) {
  makeAffiliationRequest(
    {
      method: 'POST',
      path: `/api/v2/users/${userId}/affiliations/add_entitlement`,
      body: { email },
      defaultErrorMessage: "Couldn't add entitlement",
    },
    callback
  )
}

function removeEntitlement(userId, email, callback) {
  makeAffiliationRequest(
    {
      method: 'POST',
      path: `/api/v2/users/${userId}/affiliations/remove_entitlement`,
      body: { email },
      defaultErrorMessage: "Couldn't remove entitlement",
      extraSuccessStatusCodes: [404],
    },
    callback
  )
}

function sendUsersWithReconfirmationsLapsedProcessed(users, callback) {
  makeAffiliationRequest(
    {
      method: 'POST',
      path: '/api/v2/institutions/reconfirmation_lapsed_processed',
      body: { users },
      defaultErrorMessage:
        'Could not update reconfirmation_lapsed_processed_at',
    },
    (error, body) => callback(error, body || [])
  )
}

const InstitutionsAPI = {
  getInstitutionAffiliations,

  getConfirmedInstitutionAffiliations,

  getInstitutionAffiliationsCounts,

  getLicencesForAnalytics,

  getUserAffiliations,

  getUsersNeedingReconfirmationsLapsedProcessed: callbackify(
    getUsersNeedingReconfirmationsLapsedProcessed
  ),

  addAffiliation: callbackify(addAffiliation),

  removeAffiliation: callbackify(removeAffiliation),

  endorseAffiliation,

  deleteAffiliations,

  addEntitlement,

  removeEntitlement,

  sendUsersWithReconfirmationsLapsedProcessed,
}

function makeAffiliationRequest(options, callback) {
  if (!settings.apis.v1.url) {
    return callback(null)
  } // service is not configured
  if (!options.extraSuccessStatusCodes) {
    options.extraSuccessStatusCodes = []
  }
  const requestOptions = {
    method: options.method,
    url: `${settings.apis.v1.url}${options.path}`,
    body: options.body,
    auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass },
    json: true,
    timeout: settings.apis.v1.timeout,
  }
  if (options.method === 'GET') {
    requestOptions.maxAttempts = 3
    requestOptions.retryDelay = 500
  } else {
    requestOptions.maxAttempts = 0
  }
  request(requestOptions, function (error, response, body) {
    if (error) {
      return callback(
        new V1ConnectionError('error getting affiliations from v1').withCause(
          error
        )
      )
    }
    if (response && response.statusCode >= 500) {
      return callback(
        new V1ConnectionError({
          message: 'error getting affiliations from v1',
          info: {
            status: response.statusCode,
            body,
          },
        })
      )
    }
    let isSuccess = response.statusCode >= 200 && response.statusCode < 300
    if (!isSuccess) {
      isSuccess = options.extraSuccessStatusCodes.includes(response.statusCode)
    }
    if (!isSuccess) {
      let errorMessage
      if (body && body.errors) {
        errorMessage = `${response.statusCode}: ${body.errors}`
      } else {
        errorMessage = `${options.defaultErrorMessage}: ${response.statusCode}`
      }

      logger.warn({ path: options.path, body: options.body }, errorMessage)
      return callback(
        new OError(errorMessage, { statusCode: response.statusCode })
      )
    }

    callback(null, body)
  })
}

InstitutionsAPI.promises = promisifyAll(InstitutionsAPI, {
  without: [
    'addAffiliation',
    'removeAffiliation',
    'getUsersNeedingReconfirmationsLapsedProcessed',
  ],
})

InstitutionsAPI.promises.addAffiliation = addAffiliation
InstitutionsAPI.promises.removeAffiliation = removeAffiliation
InstitutionsAPI.promises.getUsersNeedingReconfirmationsLapsedProcessed =
  getUsersNeedingReconfirmationsLapsedProcessed

module.exports = InstitutionsAPI
