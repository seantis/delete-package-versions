import {rest} from 'msw'
import {setupServer} from 'msw/node'
import {
  getOldestVersions as _getOldestVersions,
  RestQueryInfo
} from '../../src/version'
import {Observable} from 'rxjs'
import {getMockedVersionsResponse} from './rest.mock'

const RATE_LIMIT = 99

describe('get versions tests -- mock rest', () => {
  let server = setupServer()

  beforeEach(() => {
    server = setupServer()
    server.listen()
  })

  afterEach(() => {
    server.close()
  })

  it('getOldestVersions -- success', done => {
    const numVersions = RATE_LIMIT
    const resp = getMockedVersionsResponse(numVersions)

    server.use(
      rest.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        (req, res, ctx) => {
          return res(ctx.status(200), ctx.json(resp))
        }
      )
    )

    getOldestVersions({numVersions}).subscribe(result => {
      expect(result.versions.length).toBe(numVersions)
      for (let i = 0; i < numVersions; i++) {
        expect(result.versions[i].id).toBe(resp[i].id)
        expect(result.versions[i].version).toBe(resp[i].name)
        expect(result.versions[i].created_at).toBe(resp[i].created_at)
      }
      expect(result.paginate).toBe(true)
      expect(result.totalCount).toBe(numVersions)
      done()
    })
  })

  it('getOldestVersions -- paginate is false when fetched versions is less than page size', done => {
    const numVersions = 5

    server.use(
      rest.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json(getMockedVersionsResponse(numVersions))
          )
        }
      )
    )

    // In the call numVersions is set to RATE_LIMIT, but the response has only 5 versions.
    getOldestVersions().subscribe(result => {
      expect(result.paginate).toBe(false)
      done()
    })
  })

  it('getOldestVersions -- API error', done => {
    server.use(
      rest.get(
        'https://api.github.com/users/test-owner/packages/npm/test-package/versions',
        (req, res, ctx) => {
          return res(ctx.status(500))
        }
      )
    )

    getOldestVersions().subscribe(
      () => {
        done.fail('should not get here.')
      },
      err => {
        expect(err).toContain('get versions API failed.')
        done()
      }
    )
  })
})

interface Params {
  owner?: string
  packageName?: string
  packageType?: string
  numVersions?: number
  page?: number
  token?: string
}

const defaultParams = {
  owner: 'test-owner',
  packageName: 'test-package',
  packageType: 'npm',
  numVersions: RATE_LIMIT,
  page: 1,
  token: 'test-token'
}

function getOldestVersions(params?: Params): Observable<RestQueryInfo> {
  const p: Required<Params> = {...defaultParams, ...params}
  return _getOldestVersions(
    p.owner,
    p.packageName,
    p.packageType,
    p.numVersions,
    p.page,
    p.token
  )
}
