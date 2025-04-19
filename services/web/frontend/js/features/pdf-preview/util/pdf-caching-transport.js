import OError from '@overleaf/o-error'
import { fallbackRequest, fetchRange } from './pdf-caching'
import { captureException } from '@/infrastructure/error-reporter'
import { EDITOR_SESSION_ID, getPdfCachingMetrics } from './metrics'
import {
  cachedUrlLookupEnabled,
  enablePdfCaching,
  prefetchingEnabled,
  prefetchLargeEnabled,
  trackPdfDownloadEnabled,
  useClsiCache,
} from './pdf-caching-flags'
import { isNetworkError } from '@/utils/is-network-error'
import { debugConsole } from '@/utils/debugging'
import { PDFJS } from './pdf-js'

// 30 seconds: The shutdown grace period of a clsi pre-emp instance.
const STALE_OUTPUT_REQUEST_THRESHOLD_MS = 30 * 1000

export function generatePdfCachingTransportFactory() {
  // NOTE: The custom transport can be used for tracking download volume.
  if (!enablePdfCaching && !trackPdfDownloadEnabled) {
    return () => undefined
  }
  const usageScore = new Map()
  const cachedUrls = new Map()
  const metrics = Object.assign(getPdfCachingMetrics(), {
    failedCount: 0,
    failedOnce: false,
    tooMuchBandwidthCount: 0,
    tooManyRequestsCount: 0,
    cachedCount: 0,
    cachedBytes: 0,
    fetchedCount: 0,
    fetchedBytes: 0,
    latencyComputeMax: 0,
    latencyComputeTotal: 0,
    requestedCount: 0,
    requestedBytes: 0,
    oldUrlHitCount: 0,
    oldUrlMissCount: 0,
    enablePdfCaching,
    prefetchingEnabled,
    prefetchLargeEnabled,
    cachedUrlLookupEnabled,
  })
  const verifyChunks =
    new URLSearchParams(window.location.search).get('verify_chunks') === 'true'

  class PDFDataRangeTransport extends PDFJS.PDFDataRangeTransport {
    constructor({ url, pdfFile, abortController, handleFetchError }) {
      super(pdfFile.size, new Uint8Array())
      this.url = url
      pdfFile.ranges = pdfFile.ranges || []
      pdfFile.editorId = pdfFile.editorId || EDITOR_SESSION_ID
      this.pdfFile = pdfFile
      // Clone the chunks as the objectId field is encoded to a Uint8Array.
      this.leanPdfRanges = pdfFile.ranges.map(r => Object.assign({}, r))
      this.handleFetchError = handleFetchError
      this.abortController = abortController
      this.startTime = performance.now()

      const params = new URL(url).searchParams
      // drop no needed params
      params.delete('enable_pdf_caching')
      params.delete('verify_chunks')
      this.queryForChunks = params.toString()
    }

    abort() {
      this.abortController.abort()
    }

    requestDataRange(start, end) {
      const abortSignal = this.abortController.signal
      const getDebugInfo = () => ({
        // Sentry does not serialize objects in twice nested objects.
        // Move the ranges to the root level to see them in Sentry.
        pdfRanges: this.leanPdfRanges,
        pdfFile: Object.assign({}, this.pdfFile, {
          ranges: '[extracted]',
          // Hide prefetched chunks as these include binary blobs.
          prefetched: this.pdfFile.prefetched?.length,
        }),
        pdfUrl: this.url,
        start,
        end,
        metrics,
      })

      const isStaleOutputRequest = () =>
        performance.now() - this.startTime > STALE_OUTPUT_REQUEST_THRESHOLD_MS
      const is404 = err => OError.getFullInfo(err).statusCode === 404
      const isFromOutputPDFRequest = err =>
        OError.getFullInfo(err).url?.includes?.('/output.pdf') === true

      // Do not consider "expected 404s" and network errors as pdf caching
      //  failures.
      // "expected 404s" here include:
      // - any stale download request
      //   Example: The user returns to a browser tab after 1h and scrolls.
      // - requests for the main output.pdf file
      //   A fallback request would not be able to retrieve the PDF either.
      const isExpectedError = err =>
        (is404(err) || isNetworkError(err)) &&
        (isStaleOutputRequest() || isFromOutputPDFRequest(err))

      const usesCache = url => {
        if (!url) return false
        const u = new URL(url)
        return (
          u.pathname.endsWith(
            `build/${this.pdfFile.editorId}-${this.pdfFile.build}/output/output.pdf`
          ) && u.searchParams.get('clsiserverid') === 'cache'
        )
      }
      const canTryFromCache = err => {
        if (!useClsiCache) return false
        if (!is404(err)) return false
        return !usesCache(OError.getFullInfo(err).url)
      }
      const getOutputPDFURLFromCache = () => {
        if (usesCache(this.url)) return this.url
        const u = new URL(this.url)
        u.searchParams.set('clsiserverid', 'cache')
        u.pathname = u.pathname.replace(
          /build\/[a-f0-9-]+\//,
          `build/${this.pdfFile.editorId}-${this.pdfFile.build}/`
        )
        return u.href
      }
      const fetchFromCache = async () => {
        // Try fetching the chunk from clsi-cache
        const url = getOutputPDFURLFromCache()
        return fallbackRequest({
          file: this.pdfFile,
          url,
          start,
          end,
          abortSignal,
        })
          .then(blob => {
            // Send the next output.pdf request directly to the cache.
            this.url = url
            // Only try downloading chunks that were cached previously
            this.pdfFile.ranges = this.pdfFile.ranges.filter(r =>
              cachedUrls.has(r.hash)
            )
            return blob
          })
          .catch(err => {
            throw OError.tag(
              new PDFJS.MissingPDFException(),
              'cache-fallback',
              {
                statusCode: OError.getFullInfo(err).statusCode,
                url: OError.getFullInfo(err).url,
                err,
              }
            )
          })
      }

      fetchRange({
        url: this.url,
        start,
        end,
        file: this.pdfFile,
        queryForChunks: this.queryForChunks,
        metrics,
        usageScore,
        cachedUrls,
        verifyChunks,
        prefetchingEnabled,
        prefetchLargeEnabled,
        cachedUrlLookupEnabled,
        abortSignal,
        canTryFromCache,
        fallbackToCacheURL: getOutputPDFURLFromCache(),
      })
        .catch(err => {
          if (abortSignal.aborted) return
          if (canTryFromCache(err)) return fetchFromCache()
          if (isExpectedError(err)) {
            if (is404(err)) {
              // A regular pdf-js request would have seen this 404 as well.
            } else {
              // Flaky network, switch back to regular pdf-js requests.
              metrics.failedCount++
              metrics.failedOnce = true
            }
            throw OError.tag(new PDFJS.MissingPDFException(), 'caching', {
              statusCode: OError.getFullInfo(err).statusCode,
              url: OError.getFullInfo(err).url,
              err,
            })
          }
          metrics.failedCount++
          metrics.failedOnce = true
          if (!enablePdfCaching) {
            throw err // This was a fallback request already. Do not retry.
          }
          err = OError.tag(err, 'optimized pdf download error', getDebugInfo())
          debugConsole.error(err)
          captureException(err, {
            tags: {
              fromPdfCaching: true,
              isFromOutputPDFRequest: isFromOutputPDFRequest(err),
            },
          })
          return fallbackRequest({
            file: this.pdfFile,
            url: this.url,
            start,
            end,
            abortSignal,
          }).catch(err => {
            if (canTryFromCache(err)) return fetchFromCache()
            if (isExpectedError(err)) {
              throw OError.tag(new PDFJS.MissingPDFException(), 'fallback', {
                statusCode: OError.getFullInfo(err).statusCode,
                url: OError.getFullInfo(err).url,
                err,
              })
            }
            throw err
          })
        })
        .then(blob => {
          if (abortSignal.aborted) return
          this.onDataRange(start, blob)
        })
        .catch(err => {
          if (abortSignal.aborted) return
          err = OError.tag(err, 'fatal pdf download error', getDebugInfo())
          debugConsole.error(err)
          if (!(err instanceof PDFJS.MissingPDFException)) {
            captureException(err, {
              tags: {
                fromPdfCaching: true,
                isFromOutputPDFRequest: isFromOutputPDFRequest(err),
              },
            })
          }
          // Signal error for (subsequent) page load.
          this.handleFetchError(err)
        })
    }
  }

  return function ({ url, pdfFile, abortController, handleFetchError }) {
    if (metrics.failedOnce) {
      // Disable pdf caching once any fetch request failed.
      // Be trigger-happy here until we reached a stable state of the feature.
      return undefined
    }
    // Latency is collected per preview cycle.
    metrics.latencyComputeMax = 0
    metrics.latencyComputeTotal = 0
    return new PDFDataRangeTransport({
      url,
      pdfFile,
      abortController,
      handleFetchError,
    })
  }
}
