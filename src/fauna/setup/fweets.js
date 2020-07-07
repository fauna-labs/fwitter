const faunadb = require('faunadb')
const q = faunadb.query
const {
  Documents,
  CreateCollection,
  CreateIndex,
  Collection,
  Exists,
  If,
  Index,
  Delete,
  Lambda,
  Paginate,
  Let,
  Query,
  Select,
  Var,
  Add,
  TimeDiff,
  Time,
  Multiply,
  Now
} = q
/* Collection */

const CreateFweetsCollection = CreateCollection({ name: 'fweets' })

/* Indexes */
const CreateIndexAllFweets = CreateIndex({
  name: 'all_fweets',
  source: Collection('fweets'),
  // this is the default collection index, no terms or values are provided
  // which means the index will sort by reference and return only the reference.
  values: [
    // By including the 'created' we order them by time.
    // We could have used ts but that would have updated by 'updated' time instead.
    {
      field: ['data', 'created'],
      reverse: true
    },
    {
      field: ['ref']
    }
  ],
  // We'll be using these indexes in the logic of our application so it's safer to set serialized to true
  // That way reads will always reflect the previous writes.
  serialized: true
})

const CreateIndexFweetsByReference = CreateIndex({
  name: 'fweets_by_reference',
  source: Collection('fweets'),
  // this is the default collection index, no terms or values are provided
  // which means the index will sort by reference and return only the reference.
  terms: [
    {
      field: ['ref']
    }
  ],
  values: [
    {
      field: ['ref']
    },
    {
      field: ['data', 'message']
    },
    {
      field: ['data', 'author']
    }
  ],
  serialized: true
})

// Example that could support the simpler join examples in queries/fweets
const CreateIndexFweetsByAuthorSimple = CreateIndex({
  name: 'fweets_by_author_simple',
  source: Collection('fweets'),
  terms: [
    {
      field: ['data', 'author']
    }
  ],
  values: [
    {
      field: ['ref'] // return the fweet reference
    }
  ],
  serialized: true
})

const CreateIndexFweetsByAuthor = CreateIndex({
  name: 'fweets_by_author',
  source: Collection('fweets'),
  terms: [
    {
      field: ['data', 'author']
    }
  ],
  values: [
    {
      // We want the results to be sorted on creation time
      field: ['data', 'created'],
      reverse: true
    },
    {
      field: ['ref'] // return the fweet reference
    }
  ],
  serialized: true
})

// For Fweets by tag feed we take a similar approach
// to the standard feed. We look at the popularity of a fweet but decay this
// popurlarity by introducing a time component.
const CreateIndexFweetsByTag = CreateIndex({
  name: 'fweets_by_tag',
  source: {
    collection: Collection('fweets'),
    fields: {
      fweetscore: Query(
        Lambda(
          'fweet',
          Let(
            {
              // The popularityfactor determines how much popularity
              // weighs up against age, setting both to one means that one like or
              // one refweet is worth aging minute.
              likesfactor: 5,
              refweetsfactor: 5,
              // Let's add comments as well for the sake of completeness, didn't
              // add it in the general fweet index since comments does not mean you like it,
              // they might be out of anger :), in this case it makes sense since they are not necessarily your comments
              // The ones that are interacted with are higher up.
              commentsFactor: 5,
              likes: Select(['data', 'likes'], Var('fweet')),
              comments: Select(['data', 'comments'], Var('fweet')),
              refweets: Select(['data', 'refweets'], Var('fweet')),

              // DISCLAIMER !!!!
              // Now() should not be used in bindings since it does not provide correct results,
              // Something I did not know at the time of writing.
              // Instead please use either a created_at time you store on the document 
              // or an updated time instead. We'll update the app from the moment I find time to test
              // an alternative approach. 

              txtime: Now(),
              unixstarttime: Time('1970-01-01T00:00:00+00:00'),
              ageInSecsSinceUnix: TimeDiff(Var('unixstarttime'), Var('txtime'), 'minutes')
            },
            // Adding the time since the unix timestamps
            // together with postlikes and postrefweets provides us with
            // decaying popularity or a mixture of popularity and
            Add(
              Multiply(Var('likesfactor'), Var('likes')),
              Multiply(Var('refweetsfactor'), Var('refweets')),
              Multiply(Var('commentsFactor'), Var('comments')),
              Var('ageInSecsSinceUnix')
            )
          )
        )
      )
    }
  },
  terms: [
    {
      field: ['data', 'hashtags']
    }
  ],
  values: [
    {
      binding: 'fweetscore',
      reverse: true
    },
    {
      field: ['ref']
    }
  ],
  serialized: true
})

const CreateIndexFweetsByHashtagRef = CreateIndex({
  name: 'fweets_by_hashtag_ref',
  source: Collection('fweets'),
  terms: [
    {
      field: ['data', 'hashtags']
    }
  ],
  values: [
    {
      field: ['ref'] // return the fweet reference
    }
  ],
  serialized: true
})

async function createFweetsCollection(client) {
  await client.query(If(Exists(Collection('fweets')), true, CreateFweetsCollection))
  await client.query(If(Exists(Index('all_fweets')), true, CreateIndexAllFweets))
  await client.query(If(Exists(Index('fweets_by_author')), true, CreateIndexFweetsByAuthor))
  await client.query(If(Exists(Index('fweets_by_tag')), true, CreateIndexFweetsByTag))
  await client.query(If(Exists(Index('fweets_by_reference')), true, CreateIndexFweetsByReference))
  await client.query(If(Exists(Index('fweets_by_hashtag_ref')), true, CreateIndexFweetsByHashtagRef))
}

// Example of how you would cleanup the collections index that are created here.
// If you delete a collection/index you have to wait 60 secs before the
// names go out of the cache before you reuse them.
async function deleteFweetsCollection(client) {
  await client.query(If(Exists(Collection('fweets')), true, Delete(Collection('fweets'))))
  await client.query(If(Exists(Index('all_fweets')), true, Delete(Index('all_fweets'))))
  await client.query(If(Exists(Index('fweets_by_author')), true, Delete(Index('fweets_by_author'))))
  await client.query(If(Exists(Index('fweets_by_tag')), true, Delete(Index('fweets_by_tag'))))
  await client.query(If(Exists(Index('fweets_by_reference')), true, Delete(Index('fweets_by_reference'))))
  await client.query(If(Exists(Index('fweets_by_hashtag_ref')), true, Delete(Index('fweets_by_hashtag_ref'))))
}

// Example of how you could delete all fweets in a collection
const DeleteAllFweets = If(
  Exists(Collection('fweets')),
  q.Map(Paginate(Documents(Collection('fweets'))), Lambda('ref', Delete(Var('ref')))),
  true
)

export { createFweetsCollection, deleteFweetsCollection, DeleteAllFweets }
