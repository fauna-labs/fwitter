import faunadb from 'faunadb'

import { CreateOrUpdateFunction, CreateAccountUDF } from './../setup/functions'
import { setupProtectedResource, setupDatabaseAuthSpec, deleteAndCreateDatabase } from '../setup/database'
import { DeleteAllAccounts } from '../setup/accounts'

import { handlePromiseError, wrapPromiseError } from './../helpers/errors'
import { register, login } from './auth'

// About this spec:
// --------------------
// Here we insert the  User Defined Functions (UDF) into the database as part of the database setup.
// Then we test what we can do with the register and login functions and permissions they provide.

const q = faunadb.query
const { Query, CreateKey, Role, CreateRole, Collection, Create, Get, Update, Lambda, Var } = q

let client = null
let misterProtectedRef = null

beforeAll(async () => {
  try {
    // First create database to run this test in.
    const adminClient = new faunadb.Client({
      secret: process.env.REACT_APP_TEST__ADMIN_KEY
    })
    const secret = await handlePromiseError(
      deleteAndCreateDatabase(adminClient, 'auth-spec'),
      'Creating temporary test database'
    )
    client = new faunadb.Client({
      secret: secret
    })
    // Setup the database for this test.
    await handlePromiseError(setupDatabaseAuthSpec(client), 'Setup Database')
    // Set up a resource that we should only be able to access after logging in.
    misterProtectedRef = await handlePromiseError(
      setupProtectedResource(client),
      'Setup a protected collection and entity'
    )
  } catch (err) {
    console.error(err)
  }
}, 60000)

// Delete the accounts in between each test
beforeEach(async () => {
  try {
    await client.query(DeleteAllAccounts)
    // make sure the register function is reset.
    await client.query(CreateAccountUDF)
  } catch (err) {
    console.error(err)
  }
}, 60000)

it('We can now register using the UDF call', function() {
  return register(client, 'test@test.com', 'testtest').then(registerResult =>
    expect(registerResult).toHaveProperty(['email'], 'test@test.com')
  )
}, 60000)

it('We can now login using the UDF call', function() {
  return register(client, 'test@test.com', 'testtest')
    .then(() => login(client, 'test@test.com', 'testtest'))
    .then(loginResult => {
      expect(loginResult).toHaveProperty('secret')
    })
}, 60000)

it('We can only use login/register when we have permissions', function() {
  return client
    .query(CreateKey({ role: Role('powerless') }))
    .then(key => new faunadb.Client({ secret: key.secret }))
    .then(localClient => register(localClient, 'test@test.com', 'testtest'))
    .catch(err => {
      expect(err).toHaveProperty(['message'], 'permission denied')
    })
}, 60000)

it('The bootstrap role has the right to call login and register', function() {
  let localClient = null
  return wrapPromiseError(
    client
      // the bootstrap role is named: 'keyrole_calludfs
      .query(CreateKey({ role: Role('keyrole_calludfs') }))
      .then(key => {
        localClient = new faunadb.Client({ secret: key.secret })
      })
      .then(() => register(localClient, 'test@test.com', 'testtest'))
      .then(() => login(localClient, 'test@test.com', 'testtest'))
  ).then(([err, result]) => {
    expect(err).toBe(null)
  })
}, 60000)

// The function has a role attached to it to be able to create accounts or fetch accounts respecitively.
// If the function has no role and our token can only call these udfs you still have no access
// since neither the function, neither the calling token has the required permissions.
it('If the functions themselves have no permissions, the call will also fail', function() {
  return (
    client
      // strip the permissions from the 'register function by redefining it with another role that has no permissions.
      // we defined a role called 'powerless' for this before.
      .query(
        CreateOrUpdateFunction({
          name: 'register',
          body: Query(
            Lambda(
              ['email', 'password'],
              Create(Collection('accounts'), {
                credentials: { password: Var('password') },
                data: {
                  email: Var('email')
                }
              })
            )
          ),
          role: Role('powerless')
        })
      )
      .then(() => client.query(CreateKey({ role: Role('keyrole_calludfs') })))
      .then(key => new faunadb.Client({ secret: key.secret }))
      .then(localClient => register(localClient, 'test@test.com', 'testtest'))
      .catch(err => {
        // the call fails with a different error.
        expect(err).toHaveProperty(['message'], 'call error')
        // If we dig deeper we see the issue, the function has no permisions.
        expect(err).toHaveProperty(
          ['requestResult', 'responseContent', 'errors', 0, 'cause', 0, 'code'],
          'permission denied'
        )
      })
  )
}, 60000)

// !!! Common pitfall !!!
// A token that comes from a logged in entity has at this point
// full access the entity itself, careful do not store things
// on account such as an 'admin boolean' since a logged in account
// can alter that. Since we noticed that this is not what people tend to expect will probably change in the future.
// Note that you can override this behaviour using roles!
it('We can access the account once we logged in with the account', function() {
  let localClient
  let accountRef = null
  return wrapPromiseError(
    register(client, 'test@test.com', 'testtest')
      .then(account => {
        accountRef = account.ref
        return login(client, 'test@test.com', 'testtest')
      })
      .then(res => {
        localClient = new faunadb.Client({ secret: res.secret })
        return localClient.query(Get(accountRef))
      })
      .then(res => {
        return localClient.query(Update(accountRef, { data: { admin: true } }))
      })
  ).then(([err, result]) => {
    expect(err).toBe(null)
    expect(result).toHaveProperty(['data', 'email'], 'test@test.com')
    expect(result).toHaveProperty(['data', 'admin'], true)
  })
}, 60000)

// By default we can't access anything else
it('We cant access anything besides the account itself', function() {
  let localClient
  return expect(
    register(client, 'test@test.com', 'testtest')
      .then(account => login(client, 'test@test.com', 'testtest'))
      .then(res => {
        localClient = new faunadb.Client({ secret: res.secret })
      })
      .then(res => {
        return localClient.query(Get(misterProtectedRef))
      })
  ).rejects.toHaveProperty(['message'], 'permission denied')
}, 60000)

// Once we have logged in with the account, we can now access entities depending on
// the permission given by roles that have the membership 'accounts' defined.

it('We can access entities with the login token', function() {
  let localClient
  // this role will provide access to tokens that were.
  // retrieved by loggin in using a entity from the 'accounts' collection
  return (
    client
      .query(
        CreateRole({
          name: 'example_role',
          privileges: [
            {
              resource: Collection('something_protected'),
              actions: {
                read: true
              }
            }
          ],
          // Since accounts is in the membership
          // all login tokens derived from accounts will get the privileges of this role.
          membership: [
            {
              resource: Collection('accounts')
            }
          ]
        })
      )

      // we need a collection to protect
      .then(() => register(client, 'test@test.com', 'testtest'))
      .then(() => login(client, 'test@test.com', 'testtest'))
      .then(res => {
        localClient = new faunadb.Client({ secret: res.secret })
      })
      .then(res => localClient.query(Get(misterProtectedRef)))
      .then(res => {
        expect(res).toHaveProperty(['data', 'name'], 'mister-protected')
      })
  )
}, 60000)

it('The default access to accounts can be overridden', function() {
  let localClient
  let accountRef = null

  // this role will provide access to tokens that were.
  // retrieved by loggin in using a entity from the 'accounts' collection
  return expect(
    client
      .query(
        CreateRole({
          name: 'override_default_role',
          privileges: [
            {
              resource: Collection('accounts'),
              actions: {
                read: true
              }
            }
          ],
          // Since accounts is in the membership
          // all login tokens derived from accounts will get the privileges of this role.
          membership: [
            {
              resource: Collection('accounts')
            }
          ]
        })
      )

      // we need a collection to protect
      .then(() => register(client, 'test@test.com', 'testtest'))
      .then(account => {
        accountRef = account.ref
        return login(client, 'test@test.com', 'testtest')
      })
      .then(res => {
        localClient = new faunadb.Client({ secret: res.secret })
        // Get will still work
        return localClient.query(Get(accountRef))
      })
      .then(res => {
        expect(res).toHaveProperty(['data', 'email'], 'test@test.com')
        // Update will now fail.
        return localClient.query(Update(accountRef, { data: { admin: true } }))
      })
  ).rejects.toHaveProperty(['message'], 'permission denied')
}, 60000)
