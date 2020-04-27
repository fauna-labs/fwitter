import { handlePromiseError } from '../helpers/errors'
const faunadb = require('faunadb')
const q = faunadb.query
const { CreateCollection, CreateIndex, Collection, Exists, If, Index, Delete, Lambda, Paginate, Match, Var } = q

/* Collection */

const CreateUsersCollection = CreateCollection({ name: 'users' })

/* Indexes */
const CreateIndexAllUsers = CreateIndex({
  name: 'all_users',
  source: Collection('users'),
  // this is the default collection index, no terms or values are provided
  // which means the index will sort by reference and return only the reference.
  serialized: true
})

const CreateUsersByAccount = CreateIndex({
  name: 'users_by_account',
  source: Collection('users'),
  // We will search on account
  terms: [
    {
      field: ['data', 'account']
    }
  ],
  // if no values are added, the index will just return the reference.
  values: [
    {
      field: ['ref']
    },
    {
      field: ['data', 'account']
    }
  ],
  // unique prevents that two users are linked to the same account
  unique: true,
  serialized: true
})

const CreateUsersByAlias = CreateIndex({
  name: 'users_by_alias',
  source: Collection('users'),
  // We will search on the alias
  terms: [
    {
      field: ['data', 'alias']
    }
  ],
  // no values are added, we'll just return the reference.
  // unique prevents that two users have the same alias!
  unique: true,
  serialized: true
})

const DeleteAllUsers = If(
  Exists(Index('all_users')),
  q.Map(Paginate(Match(Index('all_users'))), Lambda('ref', Delete(Var('ref')))),
  true
)

async function createUsersCollection(client) {
  await handlePromiseError(
    client.query(If(Exists(Collection('users')), true, CreateUsersCollection)),
    'Creating users collection'
  )
  await handlePromiseError(
    client.query(If(Exists(Index('all_users')), true, CreateIndexAllUsers)),
    'Creating all_users index'
  )
  await handlePromiseError(
    client.query(If(Exists(Index('users_by_alias')), true, CreateUsersByAlias)),
    'Creating users_by_alias index'
  )
  await handlePromiseError(
    client.query(If(Exists(Index('users_by_account')), true, CreateUsersByAccount)),
    'Creating users_by_account index'
  )
}

async function deleteUsersCollection(client) {
  await handlePromiseError(
    client.query(If(Exists(Collection('users')), true, Delete(Collection('users')))),
    'Delete users collection'
  )
  await handlePromiseError(
    client.query(If(Exists(Index('users_by_alias')), true, Delete(Index('users_by_alias')))),
    'Delete users_by_alias index'
  )
  await handlePromiseError(
    client.query(If(Exists(Index('all_users')), true, Delete(Index('all_users')))),
    'Delete all_users index'
  )
  await handlePromiseError(
    client.query(If(Exists(Index('users_by_account')), true, Delete(Index('users_by_account')))),
    'Delete users_by_account index'
  )
}

export {
  CreateIndexAllUsers,
  CreateUsersCollection,
  CreateUsersByAccount,
  DeleteAllUsers,
  CreateUsersByAlias,
  createUsersCollection,
  deleteUsersCollection
}
