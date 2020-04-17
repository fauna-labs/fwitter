require('dotenv').config({ path: '.env.' + process.argv[2] })

// This script depopulates the database
const { DeleteAllAccounts } = require('../src/fauna/setup/accounts')
const { DeleteAllUsers } = require('../src/fauna/setup/users')
const { DeleteAllComments } = require('../src/fauna/setup/comments')
const { DeleteAllFweets } = require('../src/fauna/setup/fweets')
const { DeleteAllFweetStats } = require('../src/fauna/setup/fweetstats')
const { DeleteAllFollowerStats } = require('../src/fauna/setup/followerstats')
const { DeleteAllHashtags } = require('../src/fauna/setup/hashtags')
const { DeleteAllRatelimiting } = require('../src/fauna/setup/rate-limiting')

const { handleSetupError } = require('../src/fauna/helpers/errors')

const faunadb = require('faunadb')
const readline = require('readline-promise').default

const keyQuestion = `----- 1. Please provide a FaunaDB admin key) -----
You can get one on https://dashboard.fauna.com/ on the Security tab of the database you want to use.

An admin key is powerful, it should only be used for the setup script, not to run your application!
At the end of the script a key with limited privileges will be returned that should be used to run your application
Enter your key or set it .env.local as 'REACT_APP_LOCAL___ADMIN' (do not push this to git):`

const explanation = `
Thanks!
This script will (Do not worry! It will all do this for you): 
 - Delete accounts, 
 - Delete users
 - Delete fweets
 - .... etc.
(take a look at scripts/depopulate.js if it interests you what it does)
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
    console.log('Delete all database entities!')
    await handleSetupError(client.query(DeleteAllAccounts), 'delete accounts')
    await handleSetupError(client.query(DeleteAllUsers), 'delete users')
    await handleSetupError(client.query(DeleteAllComments), 'delete comments')
    await handleSetupError(client.query(DeleteAllFweets), 'delete fweets')
    await handleSetupError(client.query(DeleteAllHashtags), 'delete hashtags')
    await handleSetupError(client.query(DeleteAllRatelimiting), 'delete rate limiting')
    await handleSetupError(client.query(DeleteAllFweetStats), 'delete fweet stats')
    await handleSetupError(client.query(DeleteAllFollowerStats), 'delete follower stats')
  } catch (err) {
    console.error('Unexpected error', err)
  }
}

main()
