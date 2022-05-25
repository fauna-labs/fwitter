const faunadb = require('faunadb')
const q = faunadb.query
const {
  CreateCollection,
  Let,
  Query,
  Select,
  CreateIndex,
  Collection,
  Exists,
  If,
  Index,
  Delete,
  Paginate,
  Documents,
  Lambda,
  Var,
  Add,
  TimeDiff,
  Time,
  Multiply,
  Now
} = q
/* Collection */

const CreateFollowerStatsCollection = CreateCollection({ name: 'followerstats' })

/* Indexes */

const CreateIndexFollowerStatsByUserAndFollower = CreateIndex({
  name: 'followerstats_by_author_and_follower',
  source: Collection('followerstats'),
  // We keep a collection to store which users are followed by other users.
  // Wait.. Couldn't we just store this as an array in users?
  // { data:
  //    {
  //     followedby: [ <userid>, <userid> ]
  //    }
  // }
  // Although it's possible and you could index on data.followedby it's not a good idea in terms of performance.
  // This list might grow to become very big which would make it hard inefficient to remove an element from the list.

  terms: [
    {
      field: ['data', 'author']
    },
    {
      field: ['data', 'follower']
    }
  ],
  // We don't want to have the same person following the same author multiple times of course!
  // unique makes sure that the combination of 'follower' and 'author' is unique.
  unique: true,
  serialized: true
})

const CreateIndexByUserPopularity = CreateIndex({
  name: 'followerstats_by_user_popularity',
  source: [
    {
      collection: Collection('followerstats'),
      fields: {
        fweetscore: Query(
          Lambda(
            'stats',
            Let(
              {
                // The popularityfactor determines how much popularity
                // weighs up against age, setting both to one means that one like or
                // one refweet is worth aging minute.
                likesfactor: 1,
                refweetsfactor: 1,
                postlikes: Select(['data', 'postlikes'], Var('stats')),
                postrefweets: Select(['data', 'postrefweets'], Var('stats')),
                txtime: Select(['data', 'created'], Var('stats')),
                unixstarttime: Time('1970-01-01T00:00:00+00:00'),
                ageInSecsSinceUnix: TimeDiff(Var('unixstarttime'), Var('txtime'), 'minutes')
              },
              // Adding the time since the unix timestamps
              // together with postlikes and postrefweets provides us with
              // decaying popularity or a mixture of popularity and
              Add(
                Multiply(Var('likesfactor'), Var('postlikes')),
                Multiply(Var('refweetsfactor'), Var('postrefweets')),
                Var('ageInSecsSinceUnix')
              )
            )
          )
        )
      }
    }
  ],
  terms: [
    {
      // We search by follower first since
      // the follower is the current user who wants to retrieve his feed of fweet.
      field: ['data', 'follower']
    }
  ],
  values: [
    {
      binding: 'fweetscore',
      reverse: true
    },
    {
      field: ['data', 'author']
    }
  ]
})

async function createFollowerStatsCollection(client) {
  await client.query(If(Exists(Collection('followerstats')), true, CreateFollowerStatsCollection))
  await client.query(
    If(Exists(Index('followerstats_by_author_and_follower')), true, CreateIndexFollowerStatsByUserAndFollower)
  )
  await client.query(If(Exists(Index('followerstats_by_user_popularity')), true, CreateIndexByUserPopularity))
}

async function deleteFollowerStatsCollection(client) {
  await client.query(If(Exists(Collection('followerstats')), true, Delete(Collection('followerstats'))))
  await client.query(
    If(
      Exists(Index('followerstats_by_author_and_follower')),
      true,
      Delete(Index('followerstats_by_author_and_follower'))
    )
  )
  await client.query(
    If(Exists(Index('followerstats_by_user_popularity')), true, Delete(Index('followerstats_by_user_popularity')))
  )
}

const DeleteAllFollowerStats = If(
  Exists(Collection('followerstats')),
  q.Map(Paginate(Documents(Collection('followerstats'))), Lambda('ref', Delete(Var('ref')))),
  true
)

export { DeleteAllFollowerStats, createFollowerStatsCollection, deleteFollowerStatsCollection }
