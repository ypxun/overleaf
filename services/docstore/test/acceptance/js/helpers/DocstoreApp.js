const app = require('../../../../app')
const Settings = require('@overleaf/settings')
require('./MongoHelper')

function startApp() {
  return new Promise((resolve, reject) => {
    app.listen(
      Settings.internal.docstore.port,
      Settings.internal.docstore.host,
      error => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      }
    )
  })
}

let appStartedPromise

async function ensureRunning() {
  if (!appStartedPromise) {
    appStartedPromise = startApp()
  }
  await appStartedPromise
}

module.exports = {
  ensureRunning,
}
