require('dotenv').config({ path: '.env.' + process.argv[2] })
var fs = require('fs')
const envfile = require('envfile')
const sourcePath = '.env.local'
const sourcePathExample = '.env.local.example'
// This script sets up the database to be used for this example application.
// Look at the code in src/fauna/setup/.. to see what is behind the magic

const { setupDatabase } = require('../src/fauna/setup/database')
const { handleSetupError } = require('../src/fauna/helpers/errors')

const faunadb = require('faunadb')
const q = faunadb.query
const { CreateKey, Role, Exists, Database, CreateDatabase, If } = q
const readline = require('readline-promise').default

const keyQuestion = `----- 1. Please provide a FaunaDB admin key) -----
You can get one on https://dashboard.fauna.com/ on the Security tab of the database you want to use.

An admin key is powerful, it should only be used for the setup script, not to run your application!
At the end of the script a key with limited privileges will be returned that should be used to run your application
Enter your key or set it .env.local as 'REACT_APP_LOCAL___ADMIN' (do not push this to git):`

const explanation = `
Thanks!
This script will (Do not worry! It will all do this for you): 
 - Setup the user defined functions 'login and register'
 - Create roles that the user defined functions will assume
 - Create a role for the initial key which can only call login/register
 - Create a role for an account to assume (database entities can assume roles, using Login a key can be retrieved for such an entity)
(take a look at scripts/setup.js if it interests you what it does)
`

const main = async () => {
  // In order to set up a database, we need a admin key
  let adminKey = process.env.REACT_APP_LOCAL___ADMIN

  // If this option is provided, the db will be created as a child db of the database
  // that the above admin key belongs to. This is useful to destroy/recreate a database
  // easily without having to wait for cache invalidation of collection/index names.
  const childDbName = process.env.REACT_APP_LOCAL___CHILD_DB_NAME

  // Ask the user for a key if it's not provided in the environment variables yet.
  if (!adminKey) {
    const interactiveSession = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    await interactiveSession.questionAsync(keyQuestion).then(key => {
      adminKey = key
      interactiveSession.close()
    })
    console.log(explanation)
  }
  let client = new faunadb.Client({ secret: adminKey })

  if (typeof childDbName !== 'undefined' && childDbName !== '') {
    await handleSetupError(client.query(CreateDatabase({ name: childDbName })), 'database - create child database')
    const key = await handleSetupError(
      client.query(CreateKey({ database: Database(childDbName), role: 'admin' })),
      'Admin key - child db'
    )
    client = new faunadb.Client({ secret: key.secret })
  }

  try {
    await setupDatabase(client)

    console.log('6.  -- Keys                    -- Bootstrap key to start the app')

    const clientKey = await handleSetupError(
      client.query(CreateKey({ role: Role('keyrole_calludfs') })),
      'token - bootstrap'
    )
    if (clientKey) {
      console.log(
        '\x1b[32m',
        `The client token to bootstrap your application. 
will be automatically installed in  the .env.local with the key REACT_APP_LOCAL___BOOTSTRAP_FAUNADB_KEY, react will load the .env vars
Don't forget to restart your frontend!`
      )
      let json = null
      try {
        json = envfile.parseFileSync(sourcePath)
      } catch (err) {
        json = envfile.parseFileSync(sourcePathExample)
      }
      json.REACT_APP_LOCAL___BOOTSTRAP_FAUNADB_KEY = clientKey.secret
      fs.writeFileSync(sourcePath, envfile.stringifySync(json))
      console.log('\x1b[33m%s\x1b[0m', clientKey.secret)
    }
  } catch (err) {
    console.error('Unexpected error', err)
  }
}

main()
