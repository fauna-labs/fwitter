require('dotenv').config({ path: '.env.' + process.argv[2] })
const faunadb = require('faunadb')
const readline = require('readline-promise').default
const { handleSetupError } = require('../src/fauna/helpers/errors')

const {
  Exists,
  If,
  Database,
  Map,
  Collections,
  Documents,
  Paginate,
  Lambda,
  Functions,
  Roles,
  Indexes,
  Delete,
  Var,
  Tokens,
  Let,
  Get,
  Select,
  Equals,
  Keys
} = faunadb.query

const keyQuestion = `----- Please provide the FaunaDB admin key) -----
An admin key is powerful, it should only be used for the setup script, not to run your application!
At the end of the script a key with limited privileges will be returned that should be used to run your application
Enter your key:`

const main = async () => {
  let serverKey = process.env.REACT_APP_LOCAL___ADMIN
  if (!serverKey) {
    const interactiveSession = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    await interactiveSession.questionAsync(keyQuestion).then(key => {
      serverKey = key
      interactiveSession.close()
    })
  }
  const client = new faunadb.Client({ secret: serverKey })
  await deleteAll(client)
}

const deleteAll = async client => {
  // If this option is provided, the db will be created as a child db of the database
  // that the above admin key belongs to. This is useful to destroy/recreate a database
  // easily without having to wait for cache invalidation of collection/index names.
  // In this case, we can just nuke the database completely.
  const childDbName = process.env.REACT_APP_LOCAL___CHILD_DB_NAME
  if (typeof childDbName !== 'undefined' && childDbName !== '') {
    // clean keys that are linked to this database
    await handleSetupError(
      client.query(
        Map(Paginate(Documents(Keys())), x =>
          Let(
            {
              key: Get(x),
              ref: Select(['ref'], Var('key')),
              db: Select(['database'], Var('key'), 'none')
            },
            If(Equals(Var('db'), Database(childDbName)), Delete(Var('ref')), false)
          )
        )
      ),
      'delete keys - delete keys linked to database'
    )
    await handleSetupError(
      client.query(If(Exists(Database(childDbName)), Delete(Database(childDbName)), false)),
      'database - delete child database'
    )
  } else {
    try {
      const collections = await deleteAllCollections(client)
      const functions = await deleteAllFunctions(client)
      const roles = await deleteAllRoles(client)
      const indexes = await deleteIndexes(client)
      const tokens = await deleteTokens(client)
      // We only delete tokens, not keys in order to keep the admin key.

      console.log(`Deleted:
  1. collections: ${collections.data.length}
  2. functions: ${functions.data.length}
  3. roles: ${roles.data.length},
  4. indexes: ${indexes.data.length},
  5. tokens: ${tokens.data.length}`)

      console.log(
        '\x1b[32m',
        `In case you want to recreate the database, please wait 60 seconds to invalidate collection/index name caches`
      )
    } catch (err) {
      console.log('Error', err)
    }
  }
}

const deleteAllCollections = async client => {
  return client.query(Map(Paginate(Collections()), Lambda('ref', Delete(Var('ref')))))
}

const deleteAllFunctions = async client => {
  return client.query(Map(Paginate(Functions()), Lambda('ref', Delete(Var('ref')))))
}

const deleteAllRoles = async client => {
  return client.query(Map(Paginate(Roles()), Lambda('ref', Delete(Var('ref')))))
}

const deleteIndexes = async client => {
  return client.query(Map(Paginate(Indexes()), Lambda('ref', Delete(Var('ref')))))
}

const deleteTokens = async client => {
  return client.query(Map(Paginate(Documents(Tokens())), Lambda('ref', Delete(Var('ref')))))
}

main()
