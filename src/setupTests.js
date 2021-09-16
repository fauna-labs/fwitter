import faunadb from 'faunadb'

const adminSecret = process.env.REACT_APP_TEST__ADMIN_KEY
// A domain for this database (e.g. 'db.eu.fauna.com' or 'db.us.fauna.com')
const domain = process.env.REACT_APP_TEST__DATABASE_DOMAIN || 'db.fauna.com'

const adminClient = new faunadb.Client({
  secret: adminSecret,
  domain: domain,
})

global.faunaAdminClient = adminClient
global.faunaDomain = domain
