'use strict'

const { expect } = require('chai')
const {
  Chunk,
  Snapshot,
  History,
  File,
  AddFileOperation,
  Origin,
  Change,
  V2DocVersions,
} = require('overleaf-editor-core')
const cleanup = require('./support/cleanup')
const redisBackend = require('../../../../storage/lib/chunk_store/redis')

describe('chunk store Redis backend', function () {
  beforeEach(cleanup.everything)
  const projectId = '123456'

  describe('getCurrentChunk', function () {
    it('should return null on cache miss', async function () {
      const chunk = await redisBackend.getCurrentChunk(projectId)
      expect(chunk).to.be.null
    })

    it('should return the cached chunk', async function () {
      // Create a sample chunk
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date(),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 5) // startVersion 5

      // Cache the chunk
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Retrieve the cached chunk
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)

      expect(cachedChunk).to.not.be.null
      expect(cachedChunk.getStartVersion()).to.equal(5)
      expect(cachedChunk.getEndVersion()).to.equal(6)
      expect(cachedChunk).to.deep.equal(chunk)
    })
  })

  describe('setCurrentChunk', function () {
    it('should successfully cache a chunk', async function () {
      // Create a sample chunk
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date(),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 5) // startVersion 5

      // Cache the chunk
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Verify the chunk was cached correctly by retrieving it
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunk).to.not.be.null
      expect(cachedChunk.getStartVersion()).to.equal(5)
      expect(cachedChunk.getEndVersion()).to.equal(6)
      expect(cachedChunk).to.deep.equal(chunk)

      // Verify that the chunk was stored correctly using the chunk metadata
      const chunkMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(chunkMetadata).to.not.be.null
      expect(chunkMetadata.startVersion).to.equal(5)
      expect(chunkMetadata.changesCount).to.equal(1)
    })

    it('should correctly handle a chunk with zero changes', async function () {
      // Create a sample chunk with no changes
      const snapshot = new Snapshot()
      const changes = []
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 10) // startVersion 10

      // Cache the chunk
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Retrieve the cached chunk
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)

      expect(cachedChunk).to.not.be.null
      expect(cachedChunk.getStartVersion()).to.equal(10)
      expect(cachedChunk.getEndVersion()).to.equal(10) // End version should equal start version with no changes
      expect(cachedChunk.history.changes.length).to.equal(0)
      expect(cachedChunk).to.deep.equal(chunk)
    })
  })

  describe('updating already cached chunks', function () {
    it('should replace a chunk with a longer chunk', async function () {
      // Set initial chunk with one change
      const snapshotA = new Snapshot()
      const changesA = [
        new Change(
          [
            new AddFileOperation(
              'test.tex',
              File.fromString('Initial content')
            ),
          ],
          new Date(),
          []
        ),
      ]
      const historyA = new History(snapshotA, changesA)
      const chunkA = new Chunk(historyA, 10)

      await redisBackend.setCurrentChunk(projectId, chunkA)

      // Verify the initial chunk was cached
      const cachedChunkA = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkA.getStartVersion()).to.equal(10)
      expect(cachedChunkA.getEndVersion()).to.equal(11)
      expect(cachedChunkA.history.changes.length).to.equal(1)

      // Create a longer chunk (with more changes)
      const snapshotB = new Snapshot()
      const changesB = [
        new Change(
          [new AddFileOperation('test1.tex', File.fromString('Content 1'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('test2.tex', File.fromString('Content 2'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('test3.tex', File.fromString('Content 3'))],
          new Date(),
          []
        ),
      ]
      const historyB = new History(snapshotB, changesB)
      const chunkB = new Chunk(historyB, 15)

      // Replace the cached chunk
      await redisBackend.setCurrentChunk(projectId, chunkB)

      // Verify the new chunk replaced the old one
      const cachedChunkB = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkB).to.not.be.null
      expect(cachedChunkB.getStartVersion()).to.equal(15)
      expect(cachedChunkB.getEndVersion()).to.equal(18)
      expect(cachedChunkB.history.changes.length).to.equal(3)
      expect(cachedChunkB).to.deep.equal(chunkB)

      // Verify the metadata was updated
      const updatedMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(updatedMetadata.startVersion).to.equal(15)
      expect(updatedMetadata.changesCount).to.equal(3)
    })

    it('should replace a chunk with a shorter chunk', async function () {
      // Set initial chunk with three changes
      const snapshotA = new Snapshot()
      const changesA = [
        new Change(
          [new AddFileOperation('file1.tex', File.fromString('Content 1'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('file2.tex', File.fromString('Content 2'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('file3.tex', File.fromString('Content 3'))],
          new Date(),
          []
        ),
      ]
      const historyA = new History(snapshotA, changesA)
      const chunkA = new Chunk(historyA, 20)

      await redisBackend.setCurrentChunk(projectId, chunkA)

      // Verify the initial chunk was cached
      const cachedChunkA = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkA.getStartVersion()).to.equal(20)
      expect(cachedChunkA.getEndVersion()).to.equal(23)
      expect(cachedChunkA.history.changes.length).to.equal(3)

      // Create a shorter chunk (with fewer changes)
      const snapshotB = new Snapshot()
      const changesB = [
        new Change(
          [new AddFileOperation('new.tex', File.fromString('New content'))],
          new Date(),
          []
        ),
      ]
      const historyB = new History(snapshotB, changesB)
      const chunkB = new Chunk(historyB, 30)

      // Replace the cached chunk
      await redisBackend.setCurrentChunk(projectId, chunkB)

      // Verify the new chunk replaced the old one
      const cachedChunkB = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkB).to.not.be.null
      expect(cachedChunkB.getStartVersion()).to.equal(30)
      expect(cachedChunkB.getEndVersion()).to.equal(31)
      expect(cachedChunkB.history.changes.length).to.equal(1)
      expect(cachedChunkB).to.deep.equal(chunkB)

      // Verify the metadata was updated
      const updatedMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(updatedMetadata.startVersion).to.equal(30)
      expect(updatedMetadata.changesCount).to.equal(1)
    })

    it('should replace a chunk with a zero-length chunk', async function () {
      // Set initial chunk with changes
      const snapshotA = new Snapshot()
      const changesA = [
        new Change(
          [new AddFileOperation('file1.tex', File.fromString('Content 1'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('file2.tex', File.fromString('Content 2'))],
          new Date(),
          []
        ),
      ]
      const historyA = new History(snapshotA, changesA)
      const chunkA = new Chunk(historyA, 25)

      await redisBackend.setCurrentChunk(projectId, chunkA)

      // Verify the initial chunk was cached
      const cachedChunkA = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkA.getStartVersion()).to.equal(25)
      expect(cachedChunkA.getEndVersion()).to.equal(27)
      expect(cachedChunkA.history.changes.length).to.equal(2)

      // Create a zero-length chunk (with no changes)
      const snapshotB = new Snapshot()
      const changesB = []
      const historyB = new History(snapshotB, changesB)
      const chunkB = new Chunk(historyB, 40)

      // Replace the cached chunk
      await redisBackend.setCurrentChunk(projectId, chunkB)

      // Verify the new chunk replaced the old one
      const cachedChunkB = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkB).to.not.be.null
      expect(cachedChunkB.getStartVersion()).to.equal(40)
      expect(cachedChunkB.getEndVersion()).to.equal(40) // Start version equals end version with no changes
      expect(cachedChunkB.history.changes.length).to.equal(0)
      expect(cachedChunkB).to.deep.equal(chunkB)

      // Verify the metadata was updated
      const updatedMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(updatedMetadata.startVersion).to.equal(40)
      expect(updatedMetadata.changesCount).to.equal(0)
    })

    it('should replace a zero-length chunk with a non-empty chunk', async function () {
      // Set initial empty chunk
      const snapshotA = new Snapshot()
      const changesA = []
      const historyA = new History(snapshotA, changesA)
      const chunkA = new Chunk(historyA, 50)

      await redisBackend.setCurrentChunk(projectId, chunkA)

      // Verify the initial chunk was cached
      const cachedChunkA = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkA.getStartVersion()).to.equal(50)
      expect(cachedChunkA.getEndVersion()).to.equal(50)
      expect(cachedChunkA.history.changes.length).to.equal(0)

      // Create a non-empty chunk
      const snapshotB = new Snapshot()
      const changesB = [
        new Change(
          [new AddFileOperation('newfile.tex', File.fromString('New content'))],
          new Date(),
          []
        ),
        new Change(
          [
            new AddFileOperation(
              'another.tex',
              File.fromString('Another file')
            ),
          ],
          new Date(),
          []
        ),
      ]
      const historyB = new History(snapshotB, changesB)
      const chunkB = new Chunk(historyB, 60)

      // Replace the cached chunk
      await redisBackend.setCurrentChunk(projectId, chunkB)

      // Verify the new chunk replaced the old one
      const cachedChunkB = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunkB).to.not.be.null
      expect(cachedChunkB.getStartVersion()).to.equal(60)
      expect(cachedChunkB.getEndVersion()).to.equal(62)
      expect(cachedChunkB.history.changes.length).to.equal(2)
      expect(cachedChunkB).to.deep.equal(chunkB)

      // Verify the metadata was updated
      const updatedMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(updatedMetadata.startVersion).to.equal(60)
      expect(updatedMetadata.changesCount).to.equal(2)
    })
  })

  describe('checkCacheValidity', function () {
    it('should return true when versions match', function () {
      const snapshotA = new Snapshot()
      const historyA = new History(snapshotA, [])
      const chunkA = new Chunk(historyA, 10)
      chunkA.pushChanges([
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello'))],
          new Date(),
          []
        ),
      ])

      const snapshotB = new Snapshot()
      const historyB = new History(snapshotB, [])
      const chunkB = new Chunk(historyB, 10)
      chunkB.pushChanges([
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello'))],
          new Date(),
          []
        ),
      ])

      const isValid = redisBackend.checkCacheValidity(chunkA, chunkB)
      expect(isValid).to.be.true
    })

    it('should return false when start versions differ', function () {
      const snapshotA = new Snapshot()
      const historyA = new History(snapshotA, [])
      const chunkA = new Chunk(historyA, 10)

      const snapshotB = new Snapshot()
      const historyB = new History(snapshotB, [])
      const chunkB = new Chunk(historyB, 11)

      const isValid = redisBackend.checkCacheValidity(chunkA, chunkB)
      expect(isValid).to.be.false
    })

    it('should return false when end versions differ', function () {
      const snapshotA = new Snapshot()
      const historyA = new History(snapshotA, [])
      const chunkA = new Chunk(historyA, 10)
      chunkA.pushChanges([
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello'))],
          new Date(),
          []
        ),
      ])

      const snapshotB = new Snapshot()
      const historyB = new History(snapshotB, [])
      const chunkB = new Chunk(historyB, 10)
      chunkB.pushChanges([
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('other.tex', File.fromString('World'))],
          new Date(),
          []
        ),
      ])

      const isValid = redisBackend.checkCacheValidity(chunkA, chunkB)
      expect(isValid).to.be.false
    })

    it('should return false when cached chunk is null', function () {
      const snapshotB = new Snapshot()
      const historyB = new History(snapshotB, [])
      const chunkB = new Chunk(historyB, 10)

      const isValid = redisBackend.checkCacheValidity(null, chunkB)
      expect(isValid).to.be.false
    })
  })

  describe('compareChunks', function () {
    it('should return true when chunks are identical', function () {
      // Create two identical chunks
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'), // Using fixed date for consistent comparison
          []
        ),
      ]
      const history1 = new History(snapshot, changes)
      const chunk1 = new Chunk(history1, 5)

      // Create a separate but identical chunk
      const snapshot2 = new Snapshot()
      const changes2 = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'), // Using same fixed date
          []
        ),
      ]
      const history2 = new History(snapshot2, changes2)
      const chunk2 = new Chunk(history2, 5)

      const result = redisBackend.compareChunks(projectId, chunk1, chunk2)
      expect(result).to.be.true
    })

    it('should return false when chunks differ', function () {
      // Create first chunk
      const snapshot1 = new Snapshot()
      const changes1 = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'),
          []
        ),
      ]
      const history1 = new History(snapshot1, changes1)
      const chunk1 = new Chunk(history1, 5)

      // Create a different chunk (different content)
      const snapshot2 = new Snapshot()
      const changes2 = [
        new Change(
          [
            new AddFileOperation(
              'test.tex',
              File.fromString('Different content')
            ),
          ],
          new Date('2025-04-10T12:00:00Z'),
          []
        ),
      ]
      const history2 = new History(snapshot2, changes2)
      const chunk2 = new Chunk(history2, 5)

      const result = redisBackend.compareChunks(projectId, chunk1, chunk2)
      expect(result).to.be.false
    })

    it('should return false when one chunk is null', function () {
      // Create a chunk
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 5)

      const resultWithNullCached = redisBackend.compareChunks(
        projectId,
        null,
        chunk
      )
      expect(resultWithNullCached).to.be.false

      const resultWithNullCurrent = redisBackend.compareChunks(
        projectId,
        chunk,
        null
      )
      expect(resultWithNullCurrent).to.be.false
    })

    it('should return false when chunks have different start versions', function () {
      // Create first chunk with start version 5
      const snapshot1 = new Snapshot()
      const changes1 = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'),
          []
        ),
      ]
      const history1 = new History(snapshot1, changes1)
      const chunk1 = new Chunk(history1, 5)

      // Create second chunk with identical content but different start version (10)
      const snapshot2 = new Snapshot()
      const changes2 = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello World'))],
          new Date('2025-04-10T12:00:00Z'),
          []
        ),
      ]
      const history2 = new History(snapshot2, changes2)
      const chunk2 = new Chunk(history2, 10)

      const result = redisBackend.compareChunks(projectId, chunk1, chunk2)
      expect(result).to.be.false
    })
  })

  describe('integration with redis', function () {
    it('should store and retrieve complex chunks correctly', async function () {
      // Create a more complex chunk
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('file1.tex', File.fromString('Content 1'))],
          new Date(),
          [1234]
        ),
        new Change(
          [new AddFileOperation('file2.tex', File.fromString('Content 2'))],
          new Date(),
          null,
          new Origin('test-origin'),
          ['5a296963ad5e82432674c839', null],
          '123.4',
          new V2DocVersions({
            'random-doc-id': { pathname: 'file2.tex', v: 123 },
          })
        ),
        new Change(
          [new AddFileOperation('file3.tex', File.fromString('Content 3'))],
          new Date(),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 20)

      // Cache the chunk
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Retrieve the cached chunk
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)

      expect(cachedChunk.getStartVersion()).to.equal(20)
      expect(cachedChunk.getEndVersion()).to.equal(23)
      expect(cachedChunk).to.deep.equal(chunk)
      expect(cachedChunk.history.changes.length).to.equal(3)

      // Check that the operations were preserved correctly
      const retrievedChanges = cachedChunk.history.changes
      expect(retrievedChanges[0].getOperations()[0].getPathname()).to.equal(
        'file1.tex'
      )
      expect(retrievedChanges[1].getOperations()[0].getPathname()).to.equal(
        'file2.tex'
      )
      expect(retrievedChanges[2].getOperations()[0].getPathname()).to.equal(
        'file3.tex'
      )

      // Check that the chunk was stored correctly using the chunk metadata
      const chunkMetadata =
        await redisBackend.getCurrentChunkMetadata(projectId)
      expect(chunkMetadata).to.not.be.null
      expect(chunkMetadata.startVersion).to.equal(20)
      expect(chunkMetadata.changesCount).to.equal(3)
    })
  })

  describe('getCurrentChunkIfValid', function () {
    it('should return the chunk when versions and changes count match', async function () {
      // Create and cache a sample chunk
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Valid content'))],
          new Date(),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 7) // startVersion 7, endVersion 8
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Prepare chunkRecord matching the cached chunk
      const chunkRecord = { startVersion: 7, endVersion: 8 }

      // Retrieve using getCurrentChunkIfValid
      const validChunk = await redisBackend.getCurrentChunkIfValid(
        projectId,
        chunkRecord
      )

      expect(validChunk).to.not.be.null
      expect(validChunk.getStartVersion()).to.equal(7)
      expect(validChunk.getEndVersion()).to.equal(8)
      expect(validChunk).to.deep.equal(chunk)
    })

    it('should return null when no chunk is cached', async function () {
      // No chunk is cached for this projectId yet
      const chunkRecord = { startVersion: 1, endVersion: 2 }
      const validChunk = await redisBackend.getCurrentChunkIfValid(
        projectId,
        chunkRecord
      )
      expect(validChunk).to.be.null
    })

    it('should return null when start version mismatches', async function () {
      // Cache a chunk with startVersion 10
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Content'))],
          new Date(),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 10) // startVersion 10, endVersion 11
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Attempt to retrieve with a different startVersion
      const chunkRecord = { startVersion: 9, endVersion: 10 } // Incorrect startVersion
      const validChunk = await redisBackend.getCurrentChunkIfValid(
        projectId,
        chunkRecord
      )
      expect(validChunk).to.be.null
    })

    it('should return null when changes count mismatches', async function () {
      // Cache a chunk with one change (startVersion 15, endVersion 16)
      const snapshot = new Snapshot()
      const changes = [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Content'))],
          new Date(),
          []
        ),
      ]
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 15)
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Attempt to retrieve with correct startVersion but incorrect endVersion (implying wrong changes count)
      const chunkRecord = { startVersion: 15, endVersion: 17 } // Incorrect endVersion (implies 2 changes)
      const validChunk = await redisBackend.getCurrentChunkIfValid(
        projectId,
        chunkRecord
      )
      expect(validChunk).to.be.null
    })

    it('should return the chunk when versions and changes count match for a zero-change chunk', async function () {
      // Cache a chunk with zero changes
      const snapshot = new Snapshot()
      const changes = []
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 20) // startVersion 20, endVersion 20
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Prepare chunkRecord matching the zero-change chunk
      const chunkRecord = { startVersion: 20, endVersion: 20 }

      // Retrieve using getCurrentChunkIfValid
      const validChunk = await redisBackend.getCurrentChunkIfValid(
        projectId,
        chunkRecord
      )

      expect(validChunk).to.not.be.null
      expect(validChunk.getStartVersion()).to.equal(20)
      expect(validChunk.getEndVersion()).to.equal(20)
      expect(validChunk.history.changes.length).to.equal(0)
      expect(validChunk).to.deep.equal(chunk)
    })

    it('should return null when start version matches but changes count is wrong for zero-change chunk', async function () {
      // Cache a chunk with zero changes
      const snapshot = new Snapshot()
      const changes = []
      const history = new History(snapshot, changes)
      const chunk = new Chunk(history, 25) // startVersion 25, endVersion 25
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Attempt to retrieve with correct startVersion but incorrect endVersion
      const chunkRecord = { startVersion: 25, endVersion: 26 } // Incorrect endVersion (implies 1 change)
      const validChunk = await redisBackend.getCurrentChunkIfValid(
        projectId,
        chunkRecord
      )
      expect(validChunk).to.be.null
    })
  })

  describe('getCurrentChunkMetadata', function () {
    it('should return metadata for a cached chunk', async function () {
      // Cache a chunk
      const snapshot = new Snapshot()
      const history = new History(snapshot, [
        new Change(
          [new AddFileOperation('test.tex', File.fromString('Hello'))],
          new Date(),
          []
        ),
        new Change(
          [new AddFileOperation('other.tex', File.fromString('Bonjour'))],
          new Date(),
          []
        ),
      ])
      const chunk = new Chunk(history, 10)
      await redisBackend.setCurrentChunk(projectId, chunk)

      const metadata = await redisBackend.getCurrentChunkMetadata(projectId)
      expect(metadata).to.deep.equal({ startVersion: 10, changesCount: 2 })
    })

    it('should return null if no chunk is cached for the project', async function () {
      const metadata = await redisBackend.getCurrentChunkMetadata(
        'non-existent-project-id'
      )
      expect(metadata).to.be.null
    })

    it('should return metadata with zero changes for a zero-change chunk', async function () {
      // Cache a chunk with no changes
      const snapshot = new Snapshot()
      const history = new History(snapshot, [])
      const chunk = new Chunk(history, 5)
      await redisBackend.setCurrentChunk(projectId, chunk)

      const metadata = await redisBackend.getCurrentChunkMetadata(projectId)
      expect(metadata).to.deep.equal({ startVersion: 5, changesCount: 0 })
    })
  })

  describe('expireCurrentChunk', function () {
    const TEMPORARY_CACHE_LIFETIME_MS = 300 * 1000 // Match the value in redis.js

    it('should return false and not expire a non-expired chunk', async function () {
      // Cache a chunk
      const snapshot = new Snapshot()
      const history = new History(snapshot, [])
      const chunk = new Chunk(history, 10)
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Attempt to expire immediately (should not be expired yet)
      const expired = await redisBackend.expireCurrentChunk(projectId)
      expect(expired).to.be.false

      // Verify the chunk still exists
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunk).to.not.be.null
      expect(cachedChunk.getStartVersion()).to.equal(10)
    })

    it('should return true and expire an expired chunk using currentTime', async function () {
      // Cache a chunk
      const snapshot = new Snapshot()
      const history = new History(snapshot, [])
      const chunk = new Chunk(history, 10)
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Calculate a time far enough in the future to ensure expiry
      const futureTime = Date.now() + TEMPORARY_CACHE_LIFETIME_MS + 5000 // 5 seconds past expiry

      // Attempt to expire using the future time
      const expired = await redisBackend.expireCurrentChunk(
        projectId,
        futureTime
      )
      expect(expired).to.be.true

      // Verify the chunk is gone
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunk).to.be.null

      // Verify metadata is also gone
      const metadata = await redisBackend.getCurrentChunkMetadata(projectId)
      expect(metadata).to.be.null
    })

    it('should return false if no chunk is cached for the project', async function () {
      const expired = await redisBackend.expireCurrentChunk(
        'non-existent-project'
      )
      expect(expired).to.be.false
    })

    it('should return false if called with a currentTime before the expiry time', async function () {
      // Cache a chunk
      const snapshot = new Snapshot()
      const history = new History(snapshot, [])
      const chunk = new Chunk(history, 10)
      await redisBackend.setCurrentChunk(projectId, chunk)

      // Use a time *before* the cache would normally expire
      const pastTime = Date.now() - 10000 // 10 seconds ago

      // Attempt to expire using the past time
      const expired = await redisBackend.expireCurrentChunk(projectId, pastTime)
      expect(expired).to.be.false

      // Verify the chunk still exists
      const cachedChunk = await redisBackend.getCurrentChunk(projectId)
      expect(cachedChunk).to.not.be.null
    })
  })
})
