import fs from 'fs'
import path from 'path'
// @ts-ignore broken package entrypoint
import pdf from 'pdf-parse/lib/pdf-parse.js'
import AdmZip from 'adm-zip'
import { setTimeout } from 'timers/promises'

const MAX_ATTEMPTS = 15
const POLL_INTERVAL = 500

type ReadFileInZipArgs = {
  pathToZip: string
  fileToRead: string
}

export async function readFileInZip({
  pathToZip,
  fileToRead,
}: ReadFileInZipArgs) {
  let attempt = 0
  while (attempt < MAX_ATTEMPTS) {
    if (fs.existsSync(pathToZip)) {
      const zip = new AdmZip(path.resolve(pathToZip))
      const entry = zip
        .getEntries()
        .find(entry => entry.entryName == fileToRead)
      if (entry) {
        return entry.getData().toString('utf8')
      } else {
        throw new Error(`${fileToRead} not found in ${pathToZip}`)
      }
    }
    await setTimeout(POLL_INTERVAL)
    attempt++
  }
  throw new Error(`${pathToZip} not found`)
}

export async function readPdf(file: string) {
  let attempt = 0
  while (attempt < MAX_ATTEMPTS) {
    if (fs.existsSync(file)) {
      const dataBuffer = fs.readFileSync(path.resolve(file))
      const { text } = await pdf(dataBuffer)
      return text
    }
    await setTimeout(POLL_INTERVAL)
    attempt++
  }
  throw new Error(`${file} not found`)
}
