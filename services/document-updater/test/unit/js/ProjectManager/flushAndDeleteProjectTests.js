const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/js/ProjectManager.js'

describe('ProjectManager - flushAndDeleteProject', function () {
  beforeEach(function () {
    this.project_id = 'project-id-123'

    this.RedisManager = {
      promises: {
        getDocIdsInProject: sinon.stub(),
      },
    }

    this.ProjectHistoryRedisManager = {}

    this.DocumentManager = {
      promises: {
        flushAndDeleteDocWithLock: sinon.stub().resolves(),
      },
    }

    this.HistoryManager = {
      promises: {
        flushProjectChanges: sinon.stub().resolves(),
      },
    }

    this.Metrics = {
      Timer: class Timer {},
    }
    this.Metrics.Timer.prototype.done = sinon.stub()

    this.ProjectManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './RedisManager': this.RedisManager,
        './ProjectHistoryRedisManager': this.ProjectHistoryRedisManager,
        './DocumentManager': this.DocumentManager,
        './HistoryManager': this.HistoryManager,
        './Metrics': this.Metrics,
      },
    })
  })

  describe('successfully', function () {
    beforeEach(async function () {
      this.doc_ids = ['doc-id-1', 'doc-id-2', 'doc-id-3']
      this.RedisManager.promises.getDocIdsInProject.resolves(this.doc_ids)
      await this.ProjectManager.promises.flushAndDeleteProjectWithLocks(
        this.project_id,
        {}
      )
    })

    it('should get the doc ids in the project', function () {
      this.RedisManager.promises.getDocIdsInProject.should.have.been.calledWith(
        this.project_id
      )
    })

    it('should delete each doc in the project', function () {
      for (const docId of this.doc_ids) {
        this.DocumentManager.promises.flushAndDeleteDocWithLock.should.have.been.calledWith(
          this.project_id,
          docId,
          {}
        )
      }
    })

    it('should flush project history', function () {
      this.HistoryManager.promises.flushProjectChanges.should.have.been.calledWith(
        this.project_id,
        {}
      )
    })

    it('should time the execution', function () {
      this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  describe('when a doc errors', function () {
    beforeEach(async function () {
      this.doc_ids = ['doc-id-1', 'doc-id-2', 'doc-id-3']
      this.RedisManager.promises.getDocIdsInProject.resolves(this.doc_ids)
      this.DocumentManager.promises.flushAndDeleteDocWithLock.callsFake(
        async (projectId, docId, options) => {
          if (docId === 'doc-id-1') {
            throw new Error('oops, something went wrong')
          }
        }
      )
      await expect(
        this.ProjectManager.promises.flushAndDeleteProjectWithLocks(
          this.project_id,
          {}
        )
      ).to.be.rejected
    })

    it('should still flush each doc in the project', function () {
      for (const docId of this.doc_ids) {
        this.DocumentManager.promises.flushAndDeleteDocWithLock.should.have.been.calledWith(
          this.project_id,
          docId,
          {}
        )
      }
    })

    it('should still flush project history', function () {
      this.HistoryManager.promises.flushProjectChanges.should.have.been.calledWith(
        this.project_id,
        {}
      )
    })

    it('should time the execution', function () {
      this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })
})
