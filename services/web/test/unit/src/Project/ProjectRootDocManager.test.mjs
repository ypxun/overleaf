import { vi, expect } from 'vitest'
import mongodb from 'mongodb-legacy'
import sinon from 'sinon'
const modulePath =
  '../../../../app/src/Features/Project/ProjectRootDocManager.mjs'

const { ObjectId } = mongodb

describe('ProjectRootDocManager', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = 'project-123'
    ctx.docPaths = {}
    ctx.docId1 = new ObjectId()
    ctx.docId2 = new ObjectId()
    ctx.docId3 = new ObjectId()
    ctx.docId4 = new ObjectId()
    ctx.docPaths[ctx.docId1] = '/chapter1.tex'
    ctx.docPaths[ctx.docId2] = '/main.tex'
    ctx.docPaths[ctx.docId3] = '/nested/chapter1a.tex'
    ctx.docPaths[ctx.docId4] = '/nested/chapter1b.tex'
    ctx.sl_req_id = 'sl-req-id-123'
    ctx.callback = sinon.stub()
    ctx.globbyFiles = ['a.tex', 'b.tex', 'main.tex']
    ctx.globby = sinon.stub().resolves(ctx.globbyFiles)

    ctx.fs = {
      readFile: sinon.stub().callsArgWith(2, new Error('file not found')),
      stat: sinon.stub().callsArgWith(1, null, { size: 100 }),
    }

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler',
      () => ({
        default: (ctx.ProjectEntityHandler = {}),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityUpdateHandler',
      () => ({
        default: (ctx.ProjectEntityUpdateHandler = {}),
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: (ctx.ProjectGetter = {}),
    }))

    vi.doMock('../../../../app/src/infrastructure/GracefulShutdown', () => ({
      BackgroundTaskTracker: class {
        add() {}
        done() {}
      },
    }))

    vi.doMock('globby', () => ({
      default: ctx.globby,
    }))

    vi.doMock('fs', () => ({
      default: ctx.fs,
    }))

    ctx.ProjectRootDocManager = (await import(modulePath)).default
  })

  describe('setRootDocAutomatically', function () {
    beforeEach(function (ctx) {
      ctx.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
      ctx.ProjectEntityUpdateHandler.isPathValidForRootDoc = sinon
        .stub()
        .returns(true)
    })
    describe('when there is a suitable root doc', function () {
      beforeEach(async function (ctx) {
        ctx.docs = {
          '/chapter1.tex': {
            _id: ctx.docId1,
            lines: [
              'something else',
              '\\begin{document}',
              'Hello world',
              '\\end{document}',
            ],
          },
          '/main.tex': {
            _id: ctx.docId2,
            lines: [
              'different line',
              '\\documentclass{article}',
              '\\input{chapter1}',
            ],
          },
          '/nested/chapter1a.tex': {
            _id: ctx.docId3,
            lines: ['Hello world'],
          },
          '/nested/chapter1b.tex': {
            _id: ctx.docId4,
            lines: ['Hello world'],
          },
        }
        ctx.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, ctx.docs)
        await ctx.ProjectRootDocManager.promises.setRootDocAutomatically(
          ctx.project_id
        )
      })

      it('should check the docs of the project', function (ctx) {
        ctx.ProjectEntityHandler.getAllDocs
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should set the root doc to the doc containing a documentclass', function (ctx) {
        ctx.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(ctx.project_id, ctx.docId2)
          .should.equal(true)
      })
    })

    describe('when the root doc is an Rtex file', function () {
      beforeEach(async function (ctx) {
        ctx.docs = {
          '/chapter1.tex': {
            _id: ctx.docId1,
            lines: ['\\begin{document}', 'Hello world', '\\end{document}'],
          },
          '/main.Rtex': {
            _id: ctx.docId2,
            lines: ['\\documentclass{article}', '\\input{chapter1}'],
          },
        }
        ctx.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, ctx.docs)
        await ctx.ProjectRootDocManager.promises.setRootDocAutomatically(
          ctx.project_id
        )
      })

      it('should set the root doc to the doc containing a documentclass', function (ctx) {
        ctx.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(ctx.project_id, ctx.docId2)
          .should.equal(true)
      })
    })

    describe('when there is no suitable root doc', function () {
      beforeEach(async function (ctx) {
        ctx.docs = {
          '/chapter1.tex': {
            _id: ctx.docId1,
            lines: ['\\begin{document}', 'Hello world', '\\end{document}'],
          },
          '/style.bst': {
            _id: ctx.docId2,
            lines: ['%Example: \\documentclass{article}'],
          },
        }
        ctx.ProjectEntityHandler.getAllDocs = sinon
          .stub()
          .callsArgWith(1, null, ctx.docs)
        await ctx.ProjectRootDocManager.promises.setRootDocAutomatically(
          ctx.project_id
        )
      })

      it('should not set the root doc to the doc containing a documentclass', function (ctx) {
        ctx.ProjectEntityUpdateHandler.setRootDoc.called.should.equal(false)
      })
    })
  })

  describe('findRootDocFileFromDirectory', function () {
    beforeEach(function (ctx) {
      ctx.fs.readFile
        .withArgs('/foo/a.tex')
        .callsArgWith(2, null, 'Hello World!')
      ctx.fs.readFile
        .withArgs('/foo/b.tex')
        .callsArgWith(2, null, "I'm a little teapot, get me out of here.")
      ctx.fs.readFile
        .withArgs('/foo/main.tex')
        .callsArgWith(2, null, "Help, I'm trapped in a unit testing factory")
      ctx.fs.readFile
        .withArgs('/foo/c.tex')
        .callsArgWith(2, null, 'Tomato, tomahto.')
      ctx.fs.readFile
        .withArgs('/foo/a/a.tex')
        .callsArgWith(2, null, 'Potato? Potahto. Potootee!')
      ctx.documentclassContent = '% test\n\\documentclass\n% test'
    })

    describe('when there is a file in a subfolder', function () {
      beforeEach(function (ctx) {
        // have to splice globbyFiles weirdly because of the way the stubbed globby method handles references
        ctx.globbyFiles.splice(
          0,
          ctx.globbyFiles.length,
          'c.tex',
          'a.tex',
          'a/a.tex',
          'b.tex'
        )
      })

      it('processes the root folder files first, and then the subfolder, in alphabetical order', async function (ctx) {
        const { path } =
          await ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('a.tex')
        sinon.assert.callOrder(
          ctx.fs.readFile.withArgs('/foo/a.tex'),
          ctx.fs.readFile.withArgs('/foo/b.tex'),
          ctx.fs.readFile.withArgs('/foo/c.tex'),
          ctx.fs.readFile.withArgs('/foo/a/a.tex')
        )
      })

      it('processes smaller files first', async function (ctx) {
        ctx.fs.stat.withArgs('/foo/c.tex').callsArgWith(1, null, { size: 1 })
        const { path } =
          await ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('c.tex')
        sinon.assert.callOrder(
          ctx.fs.readFile.withArgs('/foo/c.tex'),
          ctx.fs.readFile.withArgs('/foo/a.tex'),
          ctx.fs.readFile.withArgs('/foo/b.tex'),
          ctx.fs.readFile.withArgs('/foo/a/a.tex')
        )
      })
    })

    describe('when main.tex contains a documentclass', function () {
      beforeEach(function (ctx) {
        ctx.fs.readFile
          .withArgs('/foo/main.tex')
          .callsArgWith(2, null, ctx.documentclassContent)
      })

      it('returns main.tex', async function (ctx) {
        const { path, content } =
          await ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('main.tex')
        expect(content).to.equal(ctx.documentclassContent)
      })

      it('processes main.text first and stops processing when it finds the content', async function (ctx) {
        await ctx.ProjectRootDocManager.findRootDocFileFromDirectory('/foo')
        expect(ctx.fs.readFile).to.be.calledWith('/foo/main.tex')
        expect(ctx.fs.readFile).not.to.be.calledWith('/foo/a.tex')
      })
    })

    describe('when main.tex does not contain a line starting with \\documentclass', function () {
      beforeEach(function (ctx) {
        ctx.fs.readFile.withArgs('/foo/a.tex').callsArgWith(2, null, 'foo')
        ctx.fs.readFile.withArgs('/foo/main.tex').callsArgWith(2, null, 'foo')
        ctx.fs.readFile.withArgs('/foo/z.tex').callsArgWith(2, null, 'foo')
        ctx.fs.readFile
          .withArgs('/foo/nested/chapter1a.tex')
          .callsArgWith(2, null, 'foo')
      })

      it('returns the first .tex file from the root folder', async function (ctx) {
        ctx.globbyFiles.splice(
          0,
          ctx.globbyFiles.length,
          'a.tex',
          'z.tex',
          'nested/chapter1a.tex'
        )

        const { path, content } =
          await ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('a.tex')
        expect(content).to.equal('foo')
      })

      it('returns main.tex file from the root folder', async function (ctx) {
        ctx.globbyFiles.splice(
          0,
          ctx.globbyFiles.length,
          'a.tex',
          'z.tex',
          'main.tex',
          'nested/chapter1a.tex'
        )

        const { path, content } =
          await ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('main.tex')
        expect(content).to.equal('foo')
      })
    })

    describe('when a.tex contains a documentclass', function () {
      beforeEach(function (ctx) {
        ctx.fs.readFile
          .withArgs('/foo/a.tex')
          .callsArgWith(2, null, ctx.documentclassContent)
      })

      it('returns a.tex', async function (ctx) {
        const { path, content } =
          await ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        expect(path).to.equal('a.tex')
        expect(content).to.equal(ctx.documentclassContent)
      })

      it('processes main.text first and stops processing when it finds the content', async function (ctx) {
        await ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
          '/foo'
        )
        expect(ctx.fs.readFile).to.be.calledWith('/foo/main.tex')
        expect(ctx.fs.readFile).to.be.calledWith('/foo/a.tex')
        expect(ctx.fs.readFile).not.to.be.calledWith('/foo/b.tex')
      })
    })

    describe('when there is no documentclass', function () {
      it('returns with no error', async function (ctx) {
        await ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
          '/foo'
        )
      })

      it('processes all the files', async function (ctx) {
        await ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
          '/foo'
        )
        expect(ctx.fs.readFile).to.be.calledWith('/foo/main.tex')
        expect(ctx.fs.readFile).to.be.calledWith('/foo/a.tex')
        expect(ctx.fs.readFile).to.be.calledWith('/foo/b.tex')
      })
    })

    describe('when there is an error reading a file', function () {
      beforeEach(function (ctx) {
        ctx.fs.readFile
          .withArgs('/foo/a.tex')
          .callsArgWith(2, new Error('something went wrong'))
      })

      it('returns an error', async function (ctx) {
        let error

        try {
          await ctx.ProjectRootDocManager.promises.findRootDocFileFromDirectory(
            '/foo'
          )
        } catch (err) {
          error = err
        }

        expect(error).to.exist
      })
    })
  })

  describe('setRootDocFromName', function () {
    describe('when there is a suitable root doc', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, ctx.docPaths)
        ctx.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
        await ctx.ProjectRootDocManager.promises.setRootDocFromName(
          ctx.project_id,
          '/main.tex'
        )
      })

      it('should check the docs of the project', function (ctx) {
        ctx.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should set the root doc to main.tex', function (ctx) {
        ctx.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(ctx.project_id, ctx.docId2.toString())
          .should.equal(true)
      })
    })

    describe('when there is a suitable root doc but the leading slash is missing', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, ctx.docPaths)
        ctx.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
        await ctx.ProjectRootDocManager.promises.setRootDocFromName(
          ctx.project_id,
          'main.tex'
        )
      })

      it('should check the docs of the project', function (ctx) {
        ctx.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should set the root doc to main.tex', function (ctx) {
        ctx.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(ctx.project_id, ctx.docId2.toString())
          .should.equal(true)
      })
    })

    describe('when there is a suitable root doc with a basename match', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, ctx.docPaths)
        ctx.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
        await ctx.ProjectRootDocManager.promises.setRootDocFromName(
          ctx.project_id,
          'chapter1a.tex'
        )
      })

      it('should check the docs of the project', function (ctx) {
        ctx.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should set the root doc using the basename', function (ctx) {
        ctx.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(ctx.project_id, ctx.docId3.toString())
          .should.equal(true)
      })
    })

    describe('when there is a suitable root doc but the filename is in quotes', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, ctx.docPaths)
        ctx.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
        await ctx.ProjectRootDocManager.promises.setRootDocFromName(
          ctx.project_id,
          "'main.tex'"
        )
      })

      it('should check the docs of the project', function (ctx) {
        ctx.ProjectEntityHandler.getAllDocPathsFromProjectById
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should set the root doc to main.tex', function (ctx) {
        ctx.ProjectEntityUpdateHandler.setRootDoc
          .calledWith(ctx.project_id, ctx.docId2.toString())
          .should.equal(true)
      })
    })

    describe('when there is no suitable root doc', function () {
      beforeEach(async function (ctx) {
        ctx.ProjectEntityHandler.getAllDocPathsFromProjectById = sinon
          .stub()
          .callsArgWith(1, null, ctx.docPaths)
        ctx.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
        await ctx.ProjectRootDocManager.promises.setRootDocFromName(
          ctx.project_id,
          'other.tex'
        )
      })

      it('should not set the root doc', function (ctx) {
        ctx.ProjectEntityUpdateHandler.setRootDoc.called.should.equal(false)
      })
    })
  })

  describe('ensureRootDocumentIsSet', function () {
    beforeEach(function (ctx) {
      ctx.project = {}
      ctx.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, ctx.project)
      ctx.ProjectRootDocManager.setRootDocAutomatically = sinon
        .stub()
        .callsArgWith(1, null)
    })

    describe('when the root doc is set', function () {
      beforeEach(function (ctx) {
        ctx.project.rootDoc_id = ctx.docId2
        ctx.ProjectRootDocManager.ensureRootDocumentIsSet(
          ctx.project_id,
          ctx.callback
        )
      })

      it('should find the project fetching only the rootDoc_id field', function (ctx) {
        ctx.ProjectGetter.getProject
          .calledWith(ctx.project_id, { rootDoc_id: 1 })
          .should.equal(true)
      })

      it('should not try to update the project rootDoc_id', function (ctx) {
        ctx.ProjectRootDocManager.setRootDocAutomatically.called.should.equal(
          false
        )
      })

      it('should call the callback', function (ctx) {
        ctx.callback.called.should.equal(true)
      })
    })

    describe('when the root doc is not set', function () {
      beforeEach(function (ctx) {
        ctx.ProjectRootDocManager.ensureRootDocumentIsSet(
          ctx.project_id,
          ctx.callback
        )
      })

      it('should find the project with only the rootDoc_id field', function (ctx) {
        ctx.ProjectGetter.getProject
          .calledWith(ctx.project_id, { rootDoc_id: 1 })
          .should.equal(true)
      })

      it('should update the project rootDoc_id', function (ctx) {
        ctx.ProjectRootDocManager.setRootDocAutomatically
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should call the callback', function (ctx) {
        ctx.callback.called.should.equal(true)
      })
    })

    describe('when the project does not exist', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, null)
        ctx.ProjectRootDocManager.ensureRootDocumentIsSet(
          ctx.project_id,
          ctx.callback
        )
      })

      it('should call the callback with an error', function (ctx) {
        ctx.callback
          .calledWith(
            sinon.match
              .instanceOf(Error)
              .and(sinon.match.has('message', 'project not found'))
          )
          .should.equal(true)
      })
    })
  })

  describe('ensureRootDocumentIsValid', function () {
    beforeEach(function (ctx) {
      ctx.project = {}
      ctx.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, ctx.project)
      ctx.ProjectGetter.getProjectWithoutDocLines = sinon
        .stub()
        .callsArgWith(1, null, ctx.project)
      ctx.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().yields()
      ctx.ProjectEntityUpdateHandler.unsetRootDoc = sinon.stub().yields()
      ctx.ProjectRootDocManager.setRootDocAutomatically = sinon
        .stub()
        .callsArgWith(1, null)
    })

    describe('when the root doc is set', function () {
      describe('when the root doc is valid', function () {
        beforeEach(function (ctx) {
          ctx.project.rootDoc_id = ctx.docId2
          ctx.ProjectEntityHandler.getDocPathFromProjectByDocId = sinon
            .stub()
            .callsArgWith(2, null, ctx.docPaths[ctx.docId2])
          ctx.ProjectRootDocManager.ensureRootDocumentIsValid(
            ctx.project_id,
            ctx.callback
          )
        })

        it('should find the project without doc lines', function (ctx) {
          ctx.ProjectGetter.getProjectWithoutDocLines
            .calledWith(ctx.project_id)
            .should.equal(true)
        })

        it('should not try to update the project rootDoc_id', function (ctx) {
          ctx.ProjectRootDocManager.setRootDocAutomatically.called.should.equal(
            false
          )
        })

        it('should call the callback', function (ctx) {
          ctx.callback.called.should.equal(true)
        })
      })

      describe('when the root doc is not valid', function () {
        beforeEach(function (ctx) {
          ctx.project.rootDoc_id = new ObjectId()
          ctx.ProjectEntityHandler.getDocPathFromProjectByDocId = sinon
            .stub()
            .callsArgWith(2, null, null)
          ctx.ProjectRootDocManager.ensureRootDocumentIsValid(
            ctx.project_id,
            ctx.callback
          )
        })

        it('should find the project without doc lines', function (ctx) {
          ctx.ProjectGetter.getProjectWithoutDocLines
            .calledWith(ctx.project_id)
            .should.equal(true)
        })

        it('should unset the root doc', function (ctx) {
          ctx.ProjectEntityUpdateHandler.unsetRootDoc
            .calledWith(ctx.project_id)
            .should.equal(true)
        })

        it('should try to find a new rootDoc', function (ctx) {
          ctx.ProjectRootDocManager.setRootDocAutomatically.called.should.equal(
            true
          )
        })

        it('should call the callback', function (ctx) {
          ctx.callback.called.should.equal(true)
        })
      })
    })

    describe('when the root doc is not set', function () {
      beforeEach(function (ctx) {
        ctx.ProjectRootDocManager.ensureRootDocumentIsValid(
          ctx.project_id,
          ctx.callback
        )
      })

      it('should find the project without doc lines', function (ctx) {
        ctx.ProjectGetter.getProjectWithoutDocLines
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should update the project rootDoc_id', function (ctx) {
        ctx.ProjectRootDocManager.setRootDocAutomatically
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should call the callback', function (ctx) {
        ctx.callback.called.should.equal(true)
      })
    })

    describe('when the project does not exist', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.getProjectWithoutDocLines = sinon
          .stub()
          .callsArgWith(1, null, null)
        ctx.ProjectRootDocManager.ensureRootDocumentIsValid(
          ctx.project_id,
          ctx.callback
        )
      })

      it('should call the callback with an error', function (ctx) {
        ctx.callback
          .calledWith(
            sinon.match
              .instanceOf(Error)
              .and(sinon.match.has('message', 'project not found'))
          )
          .should.equal(true)
      })
    })
  })
})
