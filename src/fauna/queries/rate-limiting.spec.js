import faunadb from 'faunadb'

import { deleteAndCreateDatabase, setupDatabaseRateLimitingSpec } from '../setup/database'
import { DeleteAllRatelimiting } from '../setup/rate-limiting'
import { DeleteAllAccounts } from '../setup/accounts'
import { DeleteAllUsers } from '../setup/users'
import { registerWithUser, login } from './auth'
import { handlePromiseError } from './../helpers/errors'

// the rate-limiting function we are actually testing
import { AddRateLimiting } from './rate-limiting'

// About this spec:
// --------------------
// This spec shows how you can compose FQL functions.
// In this example we add a rate-limiting function that we made to other functions that we want to rate limit.
// We can:
//  - limit how many times a query is called in general and reset it manually
//    e.g. only allow 3 faulty logins, then block the account)
//  - limit how often a query is called per time unit per user
//    e.g. limit heavy queries, it will still cost you a few read ops but it's much better than running a heavy query too often)
//  - limit how often a query is called globally (not per user)
//    e.g. limit how many new user can register in a certain amount of time to stop bots.
// Without a backend, there are of course limitations, what we can't do:
//  - ip-based rate-limiting or blacklist malicious ips, in that case
//    we would advice to add cloudflare workers in between (example upcoming)

const q = faunadb.query
const { Add, Identity, Paginate, IsEmpty, Let, If, Match, Index, Var, Delete, Select } = q
let adminClient = null
// Setup indexes and collections
beforeAll(async () => {
  try {
    // First create database to run this test in.
    adminClient = new faunadb.Client({
      secret: process.env.REACT_APP_TEST__ADMIN_KEY
    })
    const secret = await handlePromiseError(
      deleteAndCreateDatabase(adminClient, 'ratelimiting-spec'),
      'Creating temporary test database'
    )
    // Scope key to the new database
    adminClient = new faunadb.Client({
      secret: secret
    })
    // Setup the database for this test
    await handlePromiseError(setupDatabaseRateLimitingSpec(adminClient), 'Setup Database')
  } catch (err) {
    console.error(err)
  }
}, 60000)

// Delete the accounts in between each test
beforeEach(async () => {
  try {
    await adminClient.query(DeleteAllAccounts)
    await adminClient.query(DeleteAllUsers)
    // make sure the register function is reset.
    await adminClient.query(DeleteAllRatelimiting)
    // register two test users
    await registerWithUser(adminClient, 'test@test.com', 'testtest')
    await registerWithUser(adminClient, 'test2@test.com', 'testtest')
  } catch (err) {
    console.error(err)
  }
})

it('We can rate-limit functions on identity and call them within the limit', function() {
  let loggedInClient = null

  return login(adminClient, 'test@test.com', 'testtest')
    .then(res => {
      loggedInClient = new faunadb.Client({ secret: res.secret })
    })
    .then(() => {
      // For testing, Let's just take a function.
      const RateLimitedSillySum = AddRateLimiting('silly_sum', Add(2, 3), Identity(), 2, 60000)
      return loggedInClient.query(RateLimitedSillySum)
    })
    .then(res => expect(res).toBe(5))
    .catch(err => {
      console.error(err)
      console.log(err.requestResult.responseContent.errors)
    })
}, 60000)

it('Edge case, we can call exactly the limit amount of items', function() {
  // For testing, Let's just take a very silly add function
  // That can not be called more than twice per minute
  let loggedInClient = null

  const RateLimitedSillySum = AddRateLimiting('silly_sum', Add(2, 3), Identity(), 2, 60000)
  return login(adminClient, 'test@test.com', 'testtest')
    .then(res => {
      loggedInClient = new faunadb.Client({ secret: res.secret })
    })
    .then(() => loggedInClient.query(RateLimitedSillySum))
    .then(() => loggedInClient.query(RateLimitedSillySum))
    .then(res => expect(res).toBe(5))
    .catch(err => {
      console.error(err)
      console.log(err.requestResult.responseContent.errors)
    })
}, 60000)

it('Rate limiting kicks in if we go over', function() {
  // For testing, Let's just take a very silly add function
  // That can not be called more than twice per time unit
  const RateLimitedSillySum = AddRateLimiting('silly_sum', Add(2, 3), Identity(), 2, 60000)
  let loggedInClient = null

  return expect(
    login(adminClient, 'test@test.com', 'testtest')
      .then(res => {
        loggedInClient = new faunadb.Client({ secret: res.secret })
      })
      .then(() => loggedInClient.query(RateLimitedSillySum))
      .then(() => loggedInClient.query(RateLimitedSillySum))
      .then(() => loggedInClient.query(RateLimitedSillySum))
  ).rejects.toHaveProperty(['message'], 'transaction aborted')
}, 60000)

it('Rate limiting is scoped per user since we added Identity', function() {
  let loggedInClient = null

  const RateLimitedSillySum = AddRateLimiting('silly_sum', Add(2, 3), Identity(), 2, 5000)
  return (
    login(adminClient, 'test@test.com', 'testtest')
      .then(res => {
        loggedInClient = new faunadb.Client({ secret: res.secret })
      })
      .then(() => loggedInClient.query(RateLimitedSillySum))
      .then(() => loggedInClient.query(RateLimitedSillySum))
      // one user hitting rate-limiting doesn't block the other one
      .then(() => login(adminClient, 'test2@test.com', 'testtest'))
      .then(res => {
        loggedInClient = new faunadb.Client({ secret: res.secret })
      })
      .then(() => loggedInClient.query(RateLimitedSillySum))
      .then(() => loggedInClient.query(RateLimitedSillySum))
      .then(res => expect(res).toBe(5))
      .catch(err => {
        console.log(err)
        throw err
      })
  )
}, 60000)

it('We can rate-limit functions globally (e.g. for register) by providing a constant', function() {
  // let's just set the constant 'silly_sum_global' as the key
  // We could use such global rate limiting to rate limit registering
  let loggedInClient = null

  const RateLimitedSillySum = AddRateLimiting('silly_sum', Add(2, 3), 'silly_sum_global', 2, 5000)
  return expect(
    login(adminClient, 'test@test.com', 'testtest')
      .then(res => {
        loggedInClient = new faunadb.Client({ secret: res.secret })
      })
      .then(() => loggedInClient.query(RateLimitedSillySum))
      .then(() => loggedInClient.query(RateLimitedSillySum))
      // logging in with another user won't help!
      .then(() => login(adminClient, 'test2@test.com', 'testtest'))
      .then(res => {
        loggedInClient = new faunadb.Client({ secret: res.secret })
      })
      .then(() => loggedInClient.query(RateLimitedSillySum))
      .then(() => loggedInClient.query(RateLimitedSillySum))
  ).rejects.toHaveProperty(['message'], 'transaction aborted')
}, 60000)

it('Everything is fine if we wait a while', function() {
  // For testing, Let's just take a very silly add function
  // That can not be called more than twice per minute
  const RateLimitedSillySum = AddRateLimiting('silly_sum', Add(2, 3), Identity(), 2, 5000)
  let loggedInClient = null

  return login(adminClient, 'test@test.com', 'testtest')
    .then(res => {
      loggedInClient = new faunadb.Client({ secret: res.secret })
    })
    .then(() => loggedInClient.query(RateLimitedSillySum))
    .then(() => loggedInClient.query(RateLimitedSillySum))
    .then(
      () =>
        new Promise((resolve, reject) => {
          setTimeout(() => resolve(), 5000)
        })
    )
    .then(() => loggedInClient.query(RateLimitedSillySum))
    .then(() => loggedInClient.query(RateLimitedSillySum))
    .then(res => expect(res).toBe(5))
    .catch(err => {
      console.error(err)
      console.log(err.requestResult.responseContent.errors)
    })
}, 60000)

it('We can omit the time unit by passing in zeros to ', function() {
  // We could have a rate limit that never resets!
  let loggedInClient = null

  const RateLimitedSillySum = AddRateLimiting('silly_sum', Add(2, 3), 'silly_sum_global', 2, 0)
  return expect(
    login(adminClient, 'test@test.com', 'testtest')
      .then(res => {
        loggedInClient = new faunadb.Client({ secret: res.secret })
      })
      .then(() => loggedInClient.query(RateLimitedSillySum))
      .then(() => loggedInClient.query(RateLimitedSillySum))
      // waiting will not help!
      .then(
        () =>
          new Promise((resolve, reject) => {
            setTimeout(() => resolve(), 5000)
          })
      )
      .then(() => loggedInClient.query(RateLimitedSillySum))
      .then(() => loggedInClient.query(RateLimitedSillySum))
  ).rejects.toHaveProperty(['message'], 'transaction aborted')
}, 60000)

it('We could have logic that manually resets the rate-limiting ', function() {
  // The constant could be something else that identifies a user (e.g. the e-mail)
  // This could be used to rate-limit malicious logins! Let's imagine our sum is a login
  const RateLimitedSillySum = AddRateLimiting('login', Add(2, 3), 'test@test.com', 2, 0)
  let loggedInClient = null

  return login(adminClient, 'test@test.com', 'testtest')
    .then(res => {
      loggedInClient = new faunadb.Client({ secret: res.secret })
    })
    .then(() => loggedInClient.query(RateLimitedSillySum))
    .then(() => loggedInClient.query(RateLimitedSillySum))
    .then(() => {
      // Imagine that on a succesfull login we insert this piece of code which
      // resets the rate-limiting for that e-mail \o/
      return loggedInClient.query(
        Let(
          {
            rateLimitingPage: Paginate(Match(Index('rate_limiting_by_action_and_identity'), 'login', 'test@test.com'))
          },
          If(
            // Check whether there is a value
            IsEmpty(Var('rateLimitingPage')),
            true,
            Delete(Select([0], Var('rateLimitingPage')))
          )
        )
      )
    })
    .then(() => loggedInClient.query(RateLimitedSillySum))
    .then(() => loggedInClient.query(RateLimitedSillySum))
    .then(res => expect(res).toBe(5))
}, 60000)
