require('dotenv').config({ path: '.env.' + process.argv[2] })

// This script sets up the database to be used for this example application.
// Look at the code in src/fauna/setup/.. to see what is behind the magic

const { setupDatabase } = require('../src/fauna/setup/database')
const { handleSetupError } = require('../src/fauna/helpers/errors')

const faunadb = require('faunadb')
const q = faunadb.query
const { CreateKey, Role } = q
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
  // In order to set up a database, we need a admin key, so let's ask the user for a key.

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
    console.log(explanation)
  }
  const client = new faunadb.Client({ secret: serverKey })

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
replace it in your .env with the key REACT_APP_LOCAL___BOOTSTRAP_FAUNADB_KEY, react will load the .env vars
Don't forget to replace it if you rerun the setup!`
      )
      console.log('\x1b[33m%s\x1b[0m', clientKey.secret)
    }
  } catch (err) {
    console.error('Unexpected error', err)
  }
}

main()
