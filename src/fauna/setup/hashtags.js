const faunadb = require('faunadb')
const q = faunadb.query
const { CreateCollection, CreateIndex, Collection, Exists, If, Index, Delete, Lambda, Paginate, Documents, Var } = q
/* Collection */

const CreateHashtagCollection = CreateCollection({ name: 'hashtags' })

const CreateIndexHashtagByName = CreateIndex({
  name: 'hashtags_by_name',
  source: Collection('hashtags'),
  // this is the default collection index, no terms or values are provided
  // which means the index will sort by reference and return only the reference.
  terms: [
    {
      field: ['data', 'name']
    }
  ],
  // We do not want multiple hashtask with the same name.
  // Uniqueness is defined by the combination of terms/values.
  // By default an index returns references byt if you would add 'ref' as a value here it would
  // validate the uniqueness of the name, ref tuple which is always unique due to ref.
  unique: true,
  // Since we want to be sure to find hashtags when we click on them we make sure the index is serialized.
  // Serialized means that your writes will be immediately available if you read the index afterwards.
  serialized: true
})

async function createHashtagCollection(client) {
  await client.query(If(Exists(Collection('hashtags')), true, CreateHashtagCollection))
  await client.query(If(Exists(Index('hashtags_by_name')), true, CreateIndexHashtagByName))
}

async function deleteHashtagCollection(client) {
  await client.query(If(Exists(Collection('hashtags')), true, Delete(Collection('hashtags'))))
  await client.query(If(Exists(Index('hashtags_by_name')), true, Delete(Index('hashtags_by_name'))))
}

const DeleteAllHashtags = If(
  Exists(Collection('hashtags')),
  q.Map(Paginate(Documents(Collection('hashtags'))), Lambda('ref', Delete(Var('ref')))),
  true
)

export { createHashtagCollection, deleteHashtagCollection, DeleteAllHashtags }
