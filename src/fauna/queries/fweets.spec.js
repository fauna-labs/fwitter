import faunadb from 'faunadb'

import { setupDatabase, deleteAndCreateDatabase } from '../setup/database'

import { handlePromiseError } from './../helpers/errors'
import { registerWithUser, login } from './auth'
import { getFweets, createFweet, createFweetWithoutUDF } from './fweets'
import { follow } from './followers'

// About this spec:
// --------------------
// Here we test out our fweet queries and check whether they can be accessed according to our intentions.
// The bootstrap role should not be able to access anything since every anonymous user has that role.
// secrets returned from logging in with an account should be able to create tweets, get tweets and update their own tweets.

const q = faunadb.query
const { CreateKey, Role } = q

let adminClient = null
let loggedInClient = null // a client made with a secret returned from login
let loggedInClient2 = null // another client with a different usermade with a secret returned from login
let bootstrapClient = null // a client made with a key that we created that assumes the bootstrap role.
let user1Ref = null
let user2Ref = null
beforeAll(async () => {
  try {
    // First create database to run this test in.
    const adminClientParentDb = new faunadb.Client({
      secret: process.env.REACT_APP_TEST__ADMIN_KEY
    })
    // Create the admin client for the new database to bootstrap things
    const secret = await handlePromiseError(
      deleteAndCreateDatabase(adminClientParentDb, 'fweets-spec'),
      'Creating temporary test database'
    )
    adminClient = new faunadb.Client({
      secret: secret
    })
    // Setup the database for this test.
    await handlePromiseError(setupDatabase(adminClient), 'Setup Database')

    // Create a client with a login key (getting privileges from 'memberships' in roles)
    // We create a user directly as well
    await handlePromiseError(registerWithUser(adminClient, 'test@test.com', 'testtest'), 'Register with User')
    const res = await handlePromiseError(login(adminClient, 'test@test.com', 'testtest'), 'Login')
    loggedInClient = new faunadb.Client({ secret: res.secret })
    user1Ref = res.user.ref

    await handlePromiseError(registerWithUser(adminClient, 'test2@test.com', 'testtest'), 'Register with User')
    const res2 = await handlePromiseError(login(adminClient, 'test2@test.com', 'testtest'), 'Login')
    loggedInClient2 = new faunadb.Client({ secret: res2.secret })

    // Create a client with the bootstrap key (assuming the bootstrap role)
    const key = await handlePromiseError(
      adminClient.query(CreateKey({ role: Role('keyrole_calludfs') })),
      'Creating Bootstrap Key'
    )
    bootstrapClient = new faunadb.Client({ secret: key.secret })

    user2Ref = res2.user.ref
    await handlePromiseError(createFweet(loggedInClient, 'Tweet user 1 #tag1', ['tag1']), 'Creating Fweet 1')
    await handlePromiseError(
      createFweet(loggedInClient2, 'Tweet user 2 #tag2 #tag3', ['tag2', 'tag3']),
      'Creating Fweet 2'
    )

    return
    // Set up a resource that we should only be able to access after logging in.
  } catch (err) {
    console.error(err)
  }
}, 600000)

it('A logged in user cant create tweets since it needs to use the UDF', function() {
  return expect(
    createFweetWithoutUDF(loggedInClient, 'Today is a beautiful day to write another app #beautiful #day', [
      'beautiful',
      'day'
    ])
  ).rejects.toHaveProperty(['message'], 'permission denied')
}, 60000)

it('The initial client can only call the UDF functions, it cant access tweets', function() {
  return expect(getFweets(bootstrapClient)).rejects.toHaveProperty(['message'], 'permission denied')
}, 60000)

it('A logged in user can retrieve tweets, but will only see his own until it follows these people', function() {
  return getFweets(loggedInClient)
    .then(res => {
      expect(res.length).toBe(1)
    })
    .catch(err => {
      console.error(err)
      throw err
    })
}, 60000)

it('A user that follows another user, sees their fweets and all associated data', function() {
  return follow(loggedInClient, user2Ref)
    .then(() => {
      return getFweets(loggedInClient)
    })
    .then(res => {
      expect(res).toHaveProperty([0])
      expect(res).toHaveProperty([0, 'fweet'])
      expect(res).toHaveProperty([0, 'fweet', 'comments']) // the number of comments
      expect(res).toHaveProperty([0, 'fweet', 'hashtags'])
      expect(res).toHaveProperty([0, 'fweet', 'likes'])
      expect(res).toHaveProperty([0, 'fweet', 'refweets'])
      expect(res).toHaveProperty([0, 'comments']) // the actual comments
      expect(res).toHaveProperty([0, 'fweetstats']) // the statistics
      expect(res).toHaveProperty([0, 'user'])
      expect(res).toHaveProperty([0, 'original']) // original fweet in case of a refweet.
    })
    .catch(err => {
      console.error(err)
      throw err
    })
}, 60000)
