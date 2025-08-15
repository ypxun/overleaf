const Settings = require('@overleaf/settings')
const Modules = require('../../infrastructure/Modules')
const { expressify } = require('@overleaf/promise-utils')
const SessionManager = require('../Authentication/SessionManager')
const logger = require('@overleaf/logger')

module.exports = {
  hasAdminAccess,
  hasAdminCapability,
  canRedirectToAdminDomain,
  getAdminCapabilities,
  useHasAdminCapability,
  useAdminCapabilities: expressify(useAdminCapabilities),
}

function hasAdminAccess(user) {
  if (!Settings.adminPrivilegeAvailable) return false
  if (!user) return false
  return Boolean(user.isAdmin)
}

function hasAdminCapability(capability) {
  return req => {
    if (!hasAdminAccess(SessionManager.getSessionUser(req.session))) {
      return false
    }
    const { adminCapabilitiesAvailable, adminCapabilities } = req
    if (!adminCapabilitiesAvailable) {
      // We can't know which capabilities are possible, so we assume all are available for admins.
      return true
    }
    return adminCapabilities?.includes(capability)
  }
}

async function getAdminCapabilities(user) {
  const rawAdminCapabilties = await Modules.promises.hooks.fire(
    'getAdminCapabilities',
    user
  )

  return {
    adminCapabilities: [...new Set(rawAdminCapabilties.flat())],
    adminCapabilitiesAvailable: rawAdminCapabilties.length > 0,
  }
}

async function useAdminCapabilities(req, res, next) {
  if (req.adminCapabilities) {
    return next()
  }
  const user = SessionManager.getSessionUser(req.session)
  if (!hasAdminAccess(user)) {
    req.adminCapabilities = []
    return next()
  }
  try {
    const { adminCapabilities, adminCapabilitiesAvailable } =
      await getAdminCapabilities(user)
    req.adminCapabilities = adminCapabilities
    req.adminCapabilitiesAvailable = adminCapabilitiesAvailable
  } catch (err) {
    logger.warn({ err, req }, 'Failed to get admin capabilities')
    req.adminCapabilities = []
    // Admin capabilities are likely available because we shouldn't throw otherwise.
    req.adminCapabilitiesAvailable = true
  }
  next()
}

function useHasAdminCapability(req, res, next) {
  res.locals.hasAdminCapability = capability =>
    hasAdminCapability(capability)(req)
  next()
}

function canRedirectToAdminDomain(user) {
  if (Settings.adminPrivilegeAvailable) return false
  if (!Settings.adminUrl) return false
  if (!user) return false
  return Boolean(user.isAdmin)
}
