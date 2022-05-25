const faunadb = require('faunadb')
const q = faunadb.query
const { CreateCollection, CreateIndex, Collection, Exists, If, Index, Delete, Lambda, Paginate, Documents, Var } = q
/* Collection */

const CreateCommentsCollection = CreateCollection({ name: 'comments' })

/* Indexes */
const CreateIndexCommentsByFweetOrdered = CreateIndex({
  name: 'comments_by_fweet_ordered',
  source: Collection('comments'),
  terms: [
    {
      field: ['data', 'fweet']
    }
  ],
  values: [
    // By including the 'ts' we order them by time.
    {
      // In contrary to hte fweets index where we used reverse: true,
      // comments need to go in the regular order.
      field: ['ts']
    },
    {
      field: ['ref']
    }
  ],
  // We'll be using these indexes in the logic of our application so it's safer to set serialized to true
  // That way reads will always reflect the previous writes.
  serialized: true
})

async function createCommentsCollection(client) {
  await client.query(If(Exists(Collection('comments')), true, CreateCommentsCollection))
  await client.query(If(Exists(Index('comments_by_fweet_ordered')), true, CreateIndexCommentsByFweetOrdered))
}

// Example of how you would cleanup the collections index that are created here.
// If you delete a collection/index you have to wait 60 secs before the
// names go out of the cache before you reuse them.
async function deleteCommentsCollection(client) {
  await client.query(If(Exists(Collection('comments')), true, Delete(Collection('comments'))))
  await client.query(If(Exists(Index('comments_by_fweet_ordered')), true, Delete(Index('comments_by_fweet_ordered'))))
}

// Example of how you could delete all comments in a collection
const DeleteAllComments = If(
  Exists(Collection('hashtags')),
  q.Map(Paginate(Documents(Collection('hashtags'))), Lambda('ref', Delete(Var('ref')))),
  true
)

export { createCommentsCollection, deleteCommentsCollection, DeleteAllComments }
