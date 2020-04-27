import faunadb from 'faunadb'
import {
  CreateLoginUDF,
  CreateLoginSimpleUDF,
  CreateAccountUDF,
  CreateFweetUDF,
  CreateAccountWithUserUDF,
  CreateAccountWithUserNoRatelimitingUDF,
  LikeFweetUDF,
  CommentUDF,
  RefweetUDF,
  GetFweetsUDF,
  GetFweetsByTagUDF,
  GetFweetsByAuthorUDF,
  FollowUDF
} from '../setup/functions'

import {
  CreateFnRoleRegisterWithUser,
  CreateBootstrapRole,
  CreateBootstrapRoleSimple,
  CreatePowerlessRole,
  CreateFnRoleRegisterWithoutRateLimiting,
  CreateFnRoleLoginWithoutRateLimiting,
  CreateFnRoleLogin,
  CreateFnRoleRegister,
  CreateLoggedInRole,
  CreateAllMightyRole,
  CreateFnRoleManipulateFweet
} from './roles'

import { createAccountCollection } from './accounts'
import { createUsersCollection } from './users'
import { createRateLimitingCollection } from './rate-limiting'
import { createFweetsCollection } from './fweets'
import { createSearchIndexes } from './searching'
import { createHashtagCollection } from './hashtags'
import { createFweetStatsCollection } from './fweetstats'
import { createFollowerStatsCollection } from './followerstats'
import { createCommentsCollection } from './comments'

import { handleSetupError } from '../helpers/errors'

const q = faunadb.query
const { Collection, CreateCollection, Create, If, Exists, Database, CreateDatabase, CreateKey, Delete, Do } = q

// About this spec:
// --------------------
// Here we insert the lambdas into the database as User Defined Functions (UDF) or a sort of stored procedure.

async function deleteAndCreateDatabase(client, name) {
  const database = await handleSetupError(
    client.query(Do(If(Exists(Database(name)), Delete(Database(name)), false), CreateDatabase({ name: name }))),
    'Deleting and recreate database'
  )
  const adminKey = await handleSetupError(
    client.query(CreateKey({ database: database.ref, role: 'admin' })),
    'Create Admin key for db'
  )
  return adminKey.secret
}

// Setup the database completely, this contains everything necessary to run the application and
// the most generic things necessary for most tests

async function setupDatabase(client) {
  console.log('1.  -- Collections and Indexes -- Creating collections')
  await handleSetupError(createAccountCollection(client), 'accounts collection')
  await handleSetupError(createRateLimitingCollection(client), 'profiles collection')
  await handleSetupError(createFweetsCollection(client), 'fweets collection')
  await handleSetupError(createUsersCollection(client), 'users collection')
  await handleSetupError(createHashtagCollection(client), 'hashtag collection')
  await handleSetupError(createFweetStatsCollection(client), 'fweetstats collection')
  await handleSetupError(createFollowerStatsCollection(client), 'followerstats collection')
  await handleSetupError(createCommentsCollection(client), 'comments collection')
  await handleSetupError(createSearchIndexes(client), 'searching indexes')

  console.log('4a. -- Roles                   -- Creating security roles to be assumed by the functions')
  await handleSetupError(client.query(CreateFnRoleLogin), 'function role - login') // without rate limiting: createFnRoleRegisterWithoutRateLimiting
  await handleSetupError(client.query(CreateFnRoleRegister), 'function role - register') // without rate limiting: createFnRoleRegisterWithoutRateLimiting
  await handleSetupError(client.query(CreateFnRoleRegisterWithUser), 'function role - register with user') // without rate limiting: createFnRoleRegisterWithoutRateLimiting
  await handleSetupError(client.query(CreateFnRoleManipulateFweet), 'function role - create manipulate fweets')

  console.log('5.  -- Functions               -- Creating User Defined Functions (UDF)')
  await handleSetupError(client.query(CreateLoginUDF), 'user defined function - login')
  await handleSetupError(client.query(CreateAccountUDF), 'user defined function - register')
  await handleSetupError(client.query(CreateAccountWithUserUDF), 'user defined function - register and create user')
  await handleSetupError(client.query(CreateFweetUDF), 'user defined function - create fweet (rate limited)')
  await handleSetupError(client.query(LikeFweetUDF), 'user defined function - like fweet')
  await handleSetupError(client.query(RefweetUDF), 'user defined function - refweet')
  await handleSetupError(client.query(CommentUDF), 'user defined function - comment')
  await handleSetupError(client.query(GetFweetsUDF), 'user defined function - get fweets')
  await handleSetupError(client.query(GetFweetsByTagUDF), 'user defined function - get fweets by tag')
  await handleSetupError(client.query(GetFweetsByAuthorUDF), 'user defined function - get fweets by user')
  await handleSetupError(client.query(FollowUDF), 'user defined function - follow')

  console.log('4b. -- Roles                   -- Creating security role that can call the functions')
  await handleSetupError(client.query(CreateBootstrapRole), 'function role - bootstrap')

  console.log('4c. -- Roles                   -- Give logged in accounts access to their data')
  await handleSetupError(client.query(CreateLoggedInRole), 'membership role - logged in role')
}

// Variations for speciifc tests
async function setupDatabaseRateLimitingSpec(client) {
  console.log('1.  -- Collections and Indexes -- Creating collections')
  await handleSetupError(createUsersCollection(client), 'users collection')
  await handleSetupError(createAccountCollection(client), 'accounts collection')
  await handleSetupError(createRateLimitingCollection(client), 'profiles collection')
  await handleSetupError(createFollowerStatsCollection(client), 'followerstats collection')

  console.log('4a. -- Roles                   -- Creating security roles to be assumed by the functions')
  await handleSetupError(client.query(CreateFnRoleLogin), 'function role - login') // without rate limiting: createFnRoleRegisterWithoutRateLimiting
  await handleSetupError(client.query(CreateFnRoleRegister), 'function role - register') // without rate limiting: createFnRoleRegisterWithoutRateLimiting
  await handleSetupError(client.query(CreateFnRoleRegisterWithUser), 'function role - register with user') // without rate limiting: createFnRoleRegisterWithoutRateLimiting
  await handleSetupError(
    client.query(CreateAllMightyRole),
    'membership role - can do everything on all indexes/collections that exists (for testing only)'
  )

  await handleSetupError(client.query(CreateLoginUDF), 'user defined function - login')
  await handleSetupError(client.query(CreateAccountUDF), 'user defined function - register')
  await handleSetupError(
    client.query(CreateAccountWithUserNoRatelimitingUDF),
    'user defined function - register and create user'
  )
}

async function setupDatabaseAuthSpec(client) {
  await handleSetupError(createAccountCollection(client), 'Create Accounts Collection')
  await handleSetupError(createUsersCollection(client), 'Create Users Collection')
  await handleSetupError(createRateLimitingCollection(client), 'Create Rate Limiting Collection')
  await handleSetupError(createFollowerStatsCollection(client), 'followerstats collection')
  await handleSetupError(client.query(CreateFnRoleLoginWithoutRateLimiting), 'Create Login Fn role (no rate limiting)')
  await handleSetupError(
    client.query(CreateFnRoleRegisterWithoutRateLimiting),
    'Create Register Fn role (no rate limiting)'
  )
  await handleSetupError(client.query(CreateLoginSimpleUDF), 'Create Login UDF')
  await handleSetupError(client.query(CreateAccountUDF), 'Create Account UDF')
  await handleSetupError(client.query(CreateBootstrapRoleSimple), 'Create Bootstrap Role')
  await handleSetupError(client.query(CreatePowerlessRole), 'Create Powerless Role')
}

async function setupDatabaseSearchSpec(client) {
  await handleSetupError(createAccountCollection(client), 'Create Accounts Collection')
  await handleSetupError(createUsersCollection(client), 'Create Users Collection')
  await handleSetupError(createRateLimitingCollection(client), 'Create Rate Limiting Collection')
  await handleSetupError(createHashtagCollection(client), 'Create Hashtag Collection')
  await handleSetupError(createSearchIndexes(client), 'Create Search Indexes')
  await handleSetupError(createFollowerStatsCollection(client), 'followerstats collection')
  await handleSetupError(client.query(CreateFnRoleLogin), 'function role - login')
  await handleSetupError(client.query(CreateFnRoleRegister), 'function role - register')
  await handleSetupError(client.query(CreateFnRoleRegisterWithUser), 'function role - register with user')
  await handleSetupError(client.query(CreateLoginUDF), 'user defined function - login')
  await handleSetupError(client.query(CreateAccountUDF), 'user defined function - register')
  await handleSetupError(
    client.query(CreateAccountWithUserNoRatelimitingUDF),
    'user defined function - register and create user'
  )
  await handleSetupError(
    client.query(CreateAllMightyRole),
    'membership role - can do everything on all indexes/collections that exists (for testing only)'
  )
}

async function setupProtectedResource(client) {
  let misterProtectedRef
  await handleSetupError(
    client.query(
      If(Exists(Collection('something_protected')), true, CreateCollection({ name: 'something_protected' }))
    ),
    'Create protected collection'
  )
  await handleSetupError(
    client.query(Create(Collection('something_protected'), { data: { name: 'mister-protected' } })).then(res => {
      misterProtectedRef = res.ref
    }),
    'Create protected eentity in the collection'
  )
  return misterProtectedRef
}

// Deleting sets is easy.
// const DeleteAllCollections = Map(Paginate(Collections()), Lambda('ref', Delete(Var('ref'))))
// const DeleteAllIndexes = Map(Paginate(Indexes()), Lambda('ref', Delete(Var('ref'))))
// const DeleteAllTokens = Map(Paginate(Documents(Tokens())), Lambda('ref', Delete(Var('ref'))))
// const DeleteAllFunctions = Map(Paginate(Functions()), Lambda('ref', Delete(Var('ref'))))

export {
  deleteAndCreateDatabase,
  setupProtectedResource,
  setupDatabaseRateLimitingSpec,
  setupDatabaseAuthSpec,
  setupDatabaseSearchSpec,
  setupDatabase
}
