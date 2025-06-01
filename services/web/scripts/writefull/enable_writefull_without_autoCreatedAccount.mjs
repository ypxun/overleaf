import { db } from '../../app/src/infrastructure/mongodb.js'
import mongodb from 'mongodb-legacy'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { scriptRunner } from '../lib/ScriptRunner.mjs'

const { ObjectId } = mongodb

async function main() {
  // search for file of users to force into auto load
  const userIdsPath = process.argv[2]
  const userIdsFile = fs.readFileSync(userIdsPath, 'utf8')
  let userIdsList = userIdsFile
  userIdsList = userIdsList
    .split('\n')
    .filter(id => id?.length)
    .map(id => new ObjectId(id))

  console.log(
    `enabling writefull with autoCreatedAccount:false for ${userIdsList.length} users`
  )

  // set them to writefull.enabled true, and autoCreatedAccount false which is the same state an auto-load account is placed in after their first load
  // not this does NOT call writefull's first load function for the user's account
  await db.users.updateMany(
    { _id: { $in: userIdsList } },
    {
      $set: {
        'writefull.enabled': true,
        'writefull.autoCreatedAccount': false,
      },
    }
  )
}

export default main

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await scriptRunner(main)
    process.exit(0)
  } catch (error) {
    console.error({ error })
    process.exit(1)
  }
}
