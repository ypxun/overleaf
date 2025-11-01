import Queues from '../../infrastructure/Queues.js'
import EmailHandler from '../Email/EmailHandler.js'
import UserUpdater from './UserUpdater.js'
import UserGetter from './UserGetter.js'
import Settings from '@overleaf/settings'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

async function scheduleOnboardingEmail(user) {
  await Queues.createScheduledJob(
    'emails-onboarding',
    { data: { userId: user._id } },
    ONE_DAY_MS
  )
}

async function sendOnboardingEmail(userId) {
  const user = await UserGetter.promises.getUser({ _id: userId }, { email: 1 })
  if (Settings.enableOnboardingEmails && user) {
    await EmailHandler.promises.sendEmail('userOnboardingEmail', {
      to: user.email,
    })
    await UserUpdater.promises.updateUser(user._id, {
      $set: { onboardingEmailSentAt: new Date() },
    })
  }
}

export default { scheduleOnboardingEmail, sendOnboardingEmail }
