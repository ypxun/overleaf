// @ts-check

import SessionManager from '../Authentication/SessionManager.js'
import LearnedWordsManager from './LearnedWordsManager.js'
import { z, validateReq } from '../../infrastructure/Validation.js'

const learnSchema = z.object({
  body: z.object({
    word: z.string().min(1),
  }),
})

const unlearnSchema = z.object({
  body: z.object({
    word: z.string().min(1),
  }),
})

export default {
  learn(req, res, next) {
    const { body } = validateReq(req, learnSchema)
    const { word } = body
    const userId = SessionManager.getLoggedInUserId(req.session)
    LearnedWordsManager.learnWord(userId, word, err => {
      if (err) return next(err)
      res.sendStatus(204)
    })
  },

  unlearn(req, res, next) {
    const { body } = validateReq(req, unlearnSchema)
    const { word } = body
    const userId = SessionManager.getLoggedInUserId(req.session)
    LearnedWordsManager.unlearnWord(userId, word, err => {
      if (err) return next(err)
      res.sendStatus(204)
    })
  },
}
