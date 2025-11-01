import Path from 'node:path'
import fs from 'node:fs'
import { callbackify } from 'node:util'
import ArchiveManager from './ArchiveManager.js'
import { Doc } from '../../models/Doc.js'
import DocstoreManager from '../Docstore/DocstoreManager.js'
import DocumentHelper from '../Documents/DocumentHelper.js'
import DocumentUpdaterHandler from '../DocumentUpdater/DocumentUpdaterHandler.mjs'
import FileStoreHandler from '../FileStore/FileStoreHandler.mjs'
import FileSystemImportManager from './FileSystemImportManager.mjs'
import ProjectCreationHandler from '../Project/ProjectCreationHandler.mjs'
import ProjectEntityMongoUpdateHandler from '../Project/ProjectEntityMongoUpdateHandler.mjs'
import ProjectRootDocManager from '../Project/ProjectRootDocManager.mjs'
import ProjectDetailsHandler from '../Project/ProjectDetailsHandler.mjs'
import ProjectDeleter from '../Project/ProjectDeleter.mjs'
import TpdsProjectFlusher from '../ThirdPartyDataStore/TpdsProjectFlusher.mjs'
import logger from '@overleaf/logger'
import OError from '@overleaf/o-error'

export default {
  createProjectFromZipArchive: callbackify(createProjectFromZipArchive),
  createProjectFromZipArchiveWithName: callbackify(
    createProjectFromZipArchiveWithName
  ),
  promises: {
    createProjectFromZipArchive,
    createProjectFromZipArchiveWithName,
  },
}

async function createProjectFromZipArchive(ownerId, defaultName, zipPath) {
  const contentsPath = await _extractZip(zipPath)
  const { path, content } =
    await ProjectRootDocManager.promises.findRootDocFileFromDirectory(
      contentsPath
    )

  const projectName =
    DocumentHelper.getTitleFromTexContent(content || '') || defaultName
  const uniqueName = await _generateUniqueName(ownerId, projectName)
  const project = await ProjectCreationHandler.promises.createBlankProject(
    ownerId,
    uniqueName
  )
  try {
    await _initializeProjectWithZipContents(ownerId, project, contentsPath)

    if (path) {
      await ProjectRootDocManager.promises.setRootDocFromName(project._id, path)
    }
  } catch (err) {
    // no need to wait for the cleanup here
    ProjectDeleter.promises
      .deleteProject(project._id)
      .catch(err =>
        logger.error(
          { err, projectId: project._id },
          'there was an error cleaning up project after importing a zip failed'
        )
      )
    throw err
  }
  await fs.promises.rm(contentsPath, { recursive: true, force: true })
  return project
}

async function createProjectFromZipArchiveWithName(
  ownerId,
  proposedName,
  zipPath,
  attributes = {}
) {
  const contentsPath = await _extractZip(zipPath)
  const uniqueName = await _generateUniqueName(ownerId, proposedName)
  const project = await ProjectCreationHandler.promises.createBlankProject(
    ownerId,
    uniqueName,
    attributes
  )

  try {
    await _initializeProjectWithZipContents(ownerId, project, contentsPath)
    await ProjectRootDocManager.promises.setRootDocAutomatically(project._id)
  } catch (err) {
    // no need to wait for the cleanup here
    ProjectDeleter.promises
      .deleteProject(project._id)
      .catch(err =>
        logger.error(
          { err, projectId: project._id },
          'there was an error cleaning up project after importing a zip failed'
        )
      )
    throw err
  }
  await fs.promises.rm(contentsPath, { recursive: true, force: true })
  return project
}

async function _extractZip(zipPath) {
  const destination = Path.join(
    Path.dirname(zipPath),
    `${Path.basename(zipPath, '.zip')}-${Date.now()}`
  )
  await ArchiveManager.promises.extractZipArchive(zipPath, destination)
  return destination
}

async function _generateUniqueName(ownerId, originalName) {
  const fixedName = ProjectDetailsHandler.fixProjectName(originalName)
  const uniqueName = await ProjectDetailsHandler.promises.generateUniqueName(
    ownerId,
    fixedName
  )
  return uniqueName
}

async function _initializeProjectWithZipContents(
  ownerId,
  project,
  contentsPath
) {
  const topLevelDir =
    await ArchiveManager.promises.findTopLevelDirectory(contentsPath)
  const importEntries =
    await FileSystemImportManager.promises.importDir(topLevelDir)
  const { fileEntries, docEntries } = await _createEntriesFromImports(
    project,
    importEntries
  )
  const projectVersion =
    await ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure(
      project._id,
      docEntries,
      fileEntries
    )
  await _notifyDocumentUpdater(project, ownerId, {
    newFiles: fileEntries,
    newDocs: docEntries,
    newProject: { version: projectVersion },
  })
  await TpdsProjectFlusher.promises.flushProjectToTpds(project._id)
}

async function _createEntriesFromImports(project, importEntries) {
  const fileEntries = []
  const docEntries = []
  for (const importEntry of importEntries) {
    switch (importEntry.type) {
      case 'doc': {
        const docEntry = await _createDoc(
          project,
          importEntry.projectPath,
          importEntry.lines
        )
        docEntries.push(docEntry)
        break
      }
      case 'file': {
        const fileEntry = await _createFile(
          project,
          importEntry.projectPath,
          importEntry.fsPath
        )
        fileEntries.push(fileEntry)
        break
      }
      default: {
        throw new Error(`Invalid import type: ${importEntry.type}`)
      }
    }
  }
  return { fileEntries, docEntries }
}

async function _createDoc(project, projectPath, docLines) {
  const projectId = project._id
  const docName = Path.basename(projectPath)
  const doc = new Doc({ name: docName })
  await DocstoreManager.promises.updateDoc(
    projectId.toString(),
    doc._id.toString(),
    docLines,
    0,
    {}
  )
  return { doc, path: projectPath, docLines: docLines.join('\n') }
}

async function _createFile(project, projectPath, fsPath) {
  const projectId = project._id
  const historyId = project.overleaf?.history?.id
  if (!historyId) {
    throw new OError('missing history id')
  }
  const fileName = Path.basename(projectPath)
  const { createdBlob, fileRef } =
    await FileStoreHandler.promises.uploadFileFromDiskWithHistoryId(
      projectId,
      historyId,
      { name: fileName },
      fsPath
    )
  return { createdBlob, file: fileRef, path: projectPath }
}

async function _notifyDocumentUpdater(project, userId, changes) {
  const projectHistoryId =
    project.overleaf && project.overleaf.history && project.overleaf.history.id
  await DocumentUpdaterHandler.promises.updateProjectStructure(
    project._id,
    projectHistoryId,
    userId,
    changes,
    null
  )
}
