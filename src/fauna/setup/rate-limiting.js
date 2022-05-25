const faunadb = require('faunadb')
const q = faunadb.query
const { Documents, CreateCollection, CreateIndex, Collection, Exists, If, Index, Delete, Lambda, Paginate, Var } = q

/* Collection */

const CreateRateLimitingCollection = CreateCollection({ name: 'rate_limiting' })

/* Indexes */
const CreateIndexAllRateLimiting = CreateIndex({
  name: 'all_rate_limiting',
  source: Collection('rate_limiting'),
  // this is the default collection index, no terms or values are provided
  // which means the index will sort by reference and return only the reference.
  // For rate-limiting it's important to set serialized to true.
  // Else a few fast queries might get through the rate-limiting since our
  // index would not immediately see the previous writes.
  serialized: true
})

const CreateIndexRateLimitingByActionAndIdentity = CreateIndex({
  name: 'rate_limiting_by_action_and_identity',
  source: Collection('rate_limiting'),
  // We will search on a key, e.g. the type of actions we want to rate limit
  terms: [
    {
      field: ['data', 'action']
    },
    {
      field: ['data', 'identity']
    }
  ],
  // if no values are added, the index will just return the reference.
  // unique: true,
  serialized: true
})

async function createRateLimitingCollection(client) {
  await client.query(If(Exists(Collection('rate_limiting')), true, CreateRateLimitingCollection))
  await client.query(If(Exists(Index('all_rate_limiting')), true, CreateIndexAllRateLimiting))
  await client.query(
    If(Exists(Index('rate_limiting_by_action_and_identity')), true, CreateIndexRateLimitingByActionAndIdentity)
  )
}

async function deleteRateLimitingCollection(client) {
  await client.query(If(Exists(Collection('rate_limiting')), true, Delete(Collection('rate_limiting'))))
  await client.query(If(Exists(Index('all_rate_limiting')), true, Delete(Index('all_rate_limiting'))))
  await client.query(
    If(
      Exists(Index('rate_limiting_by_action_and_identity')),
      true,
      Delete(Index('rate_limiting_by_action_and_identity'))
    )
  )
}

const DeleteAllRatelimiting = If(
  Exists(Collection('rate_limiting')),
  q.Map(Paginate(Documents(Collection('rate_limiting'))), Lambda('ref', Delete(Var('ref')))),
  true
)

export { createRateLimitingCollection, deleteRateLimitingCollection, CreateIndexAllRateLimiting, DeleteAllRatelimiting }
