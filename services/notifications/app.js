// Metrics must be initialized before importing anything else
import '@overleaf/metrics/initialize.js'
import metrics from '@overleaf/metrics'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import express from 'express'
import methodOverride from 'method-override'
import { mongoClient } from './app/js/mongodb.js'
import NotificationsController from './app/js/NotificationsController.js'
import HealthCheckController from './app/js/HealthCheckController.js'

const app = express()

logger.initialize('notifications')

metrics.memory.monitor(logger)
metrics.open_sockets.monitor()

app.use(methodOverride())
app.use(express.json())
app.use(metrics.http.monitor(logger))

metrics.injectMetricsRoute(app)

app.post('/user/:user_id', NotificationsController.addNotification)
app.get('/user/:user_id', NotificationsController.getUserNotifications)
app.delete(
  '/user/:user_id/notification/:notification_id',
  NotificationsController.removeNotificationId
)
app.delete('/user/:user_id', NotificationsController.removeNotificationKey)
app.delete('/key/:key', NotificationsController.removeNotificationByKeyOnly)
app.get('/key/:key/count', NotificationsController.countNotificationsByKeyOnly)
app.delete(
  '/key/:key/bulk',
  NotificationsController.deleteUnreadNotificationsByKeyOnlyBulk
)

app.get('/status', (req, res) => res.send('notifications is up'))

app.get('/health_check', HealthCheckController.check)

app.get('*', (req, res) => res.sendStatus(404))

const host = Settings.internal.notifications?.host || '127.0.0.1'
const port = Settings.internal.notifications?.port || 3042
try {
  await mongoClient.connect()
} catch (err) {
  logger.fatal({ err }, 'Cannot connect to mongo. Exiting.')
  process.exit(1)
}

app.listen(port, host, () =>
  logger.debug({}, `notifications starting up, listening on ${host}:${port}`)
)
