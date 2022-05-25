const faunadb = require('faunadb')
const q = faunadb.query
const { Paginate, Lambda, Documents, Var, CreateCollection, CreateIndex, Collection, Exists, If, Index, Delete } = q
/* Collection */

const CreateFweetStatsCollection = CreateCollection({ name: 'fweetstats' })

/* Indexes */

const CreateIndexFweetsStatsByUserAndFweet = CreateIndex({
  name: 'fweetstats_by_user_and_fweet',
  source: Collection('fweetstats'),
  // We keep a collection to store which fweets that have been liked (or in a later phase refweeted) by users.
  // Wait.. Couldn't we just store this as an array i fweets?
  // { data:
  //    {
  //     likedby: [ <userid>, <userid> ]
  //    }
  // }
  // Although it's possible and you coudl index on data.likedby it's not a good idea in terms of performance.
  // This list might grow to become very big which would make it hard inefficient to remove an element from the list.

  terms: [
    {
      field: ['data', 'user']
    },
    {
      field: ['data', 'fweet']
    }
  ],
  serialized: true
})

async function createFweetStatsCollection(client) {
  await client.query(If(Exists(Collection('fweetstats')), true, CreateFweetStatsCollection))
  await client.query(If(Exists(Index('fweetstats_by_user_and_fweet')), true, CreateIndexFweetsStatsByUserAndFweet))
}

async function deleteFweetStatsCollection(client) {
  await client.query(If(Exists(Collection('fweetstats')), true, Delete(Collection('fweetstats'))))
  await client.query(
    If(Exists(Index('fweetstats_by_user_and_fweet')), true, Delete(Index('fweetstats_by_user_and_fweet')))
  )
}

const DeleteAllFweetStats = If(
  Exists(Collection('fweetstats')),
  q.Map(Paginate(Documents(Collection('fweetstats'))), Lambda('ref', Delete(Var('ref')))),
  true
)

export { DeleteAllFweetStats, createFweetStatsCollection, deleteFweetStatsCollection }
