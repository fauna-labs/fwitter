const faunadb = require('faunadb')
const q = faunadb.query

const {
  CreateIndex,
  Collection,
  Exists,
  If,
  Index,
  Delete,
  Lambda,
  Var,
  Query,
  Length,
  Select,
  Subtract,
  Let,
  NGram,
  LowerCase,
  Filter,
  GT,
  Union,
  Distinct
} = q

/** ********************** Searching ************************/
/* We'll create indexes for an autocompletion functionality.
 * We gradually increase the complexity of the index to epxlain the logic.
 * Only the final version is usd in the app.
 ***/

// --- Step 1 ---
// We can index an array!
// the index would work by 'unwrapping' the values in wordpart.
// meaning that we a match on one of the wordparts will find the original hashtag reference.
// Imagine we stored the wordparts of a tag alongside with the tag. It would look like:
// {
//   "name": "lockdown",
//   "wordparts": [
//     "l",
//     "lo",
//     ....
//     "lockdown",
//     "o",
//     "oc",
//     ...
//   ]
// }

const CreateHashtagsByWordparts = CreateIndex({
  name: 'hashtags_by_wordparts',
  source: Collection('hashtags'),
  // wordparts is an array. Using it in an index will index
  // each of the parts in this array. As a result any part of the word will match in this index.
  terms: [
    {
      field: ['data', 'wordparts']
    }
  ],
  // this is for searching, it doesn't matter that our index is a few milliseconds/seconds behind.
  // serialized false means that our reads will return faster which is important for searching.
  // but you should not rely on it for logic as you can't expect to read immediately what you have written.
  serialized: false
})

// --- Step 2 ---
// Sorting the results with a binding!
// We actually want to favor matches on shorter words (since a shorter word is closer to what we typed)
// The length of the original word is the determining factor. We do not have to store this length in the document,
// we can get it with a calculated field or in fauna terms: 'a binding'.
const CreateHashtagsByWordpartsWithBinding = CreateIndex({
  name: 'hashtags_by_wordparts',
  // we actually want to sort on the longest match, how do we do that?
  // With a binding!
  source: [
    {
      collection: Collection('hashtags'),
      fields: {
        length: Query(
          Lambda(
            'hashtag',
            q.Map(Select(['data', 'wordparts'], Var('hashtag')), wordpart => Length(Var('wordpart')))
          )
        )
      }
    }
  ],
  terms: [
    {
      field: ['data', 'wordparts']
    }
  ],
  // values are 'range indexed' and therefore sorted in the order you provide them
  // we will also need the reference to the actual tag! We will place this second
  // since else the elements will be sorted by reference first.
  values: [
    {
      binding: 'length',
      reverse: true
    },
    { field: ['ref'] }
  ],
  serialized: false
})

// --- Step 3 ---
// We can index multiple collections !
// We want to search for user aliases as well, not only for tagS!
// Since we can put multiple collections in one index, we can do that.
// In this case we decided to let users and accounts have the same property 'wordparts'.
// the users property has a different name, we can easily fix that with bindings as well.
const CreateHashtagsAndUsersByWordpartsWithBinding = CreateIndex({
  name: 'hashtags_and_users_by_wordparts',
  // we actually want to sort to get the shortest word that matches first
  source: [
    {
      collection: Collection('hashtags'),
      fields: {
        // We can use bindings to make sure that fields of different collections
        // have the same name in our index (e.g. in case wordparts in users and hashtags)
        // would be stored slightly differently (user has an extra key in the path 'alias' in the below example)
        length: Query(Lambda('hashtag', Length(Select(['data', 'name'], Var('hashtag'))))),
        wordparts: Query(Lambda('hashtag', Select(['data', 'wordparts'], Var('hashtag'))))
      }
    },
    {
      collection: Collection('users'),
      fields: {
        length: Query(Lambda('user', Length(Select(['data', 'alias', 'name'], Var('user'))))),
        wordparts: Query(Lambda('user', Select(['data', 'alias', 'wordparts'], Var('user'))))
      }
    }
  ],
  terms: [
    {
      binding: 'wordparts'
    }
  ],
  values: [
    {
      binding: 'length'
    },
    { field: ['ref'] }
  ],
  serialized: false
})

// --- Step 4 ---
// We do not need to store these wordparts.. that can actually be hanlded
// by a binding as well. There is an NGram function available to generate those.
// At this point the NGram function is quite limited and therefore still undocumented since it will change.
// The limitation is that max - min can't be bigger than 1.
// We can easily combine a few NGgrams ourselves though. Since we
// want to 'limit' the amount of prefixes we can do that fairly easy.
// When a word is longer than 10 chars, for example 15 the shortest prefix will be min 5 chars long.
function WordPartGenerator(WordVar) {
  return Let(
    {
      indexes: q.Map(
        // Reduce this array if you want less ngrams per word.
        // Setting it to [ 0 ] would only create the word itself, Setting it to [0, 1] would result in the word itself
        // and all ngrams that are one character shorter, etc..
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        Lambda('index', Subtract(Length(WordVar), Var('index')))
      ),
      indexesFiltered: Filter(
        Var('indexes'),
        // filter out the ones below 0
        Lambda('l', GT(Var('l'), 0))
      ),
      ngramsArray: q.Map(Var('indexesFiltered'), Lambda('l', NGram(LowerCase(WordVar), Var('l'), Var('l'))))
    },
    Var('ngramsArray')
  )
}

const CreateHashtagsAndUsersByWordpartsWithBinding2 = CreateIndex({
  name: 'hashtags_and_users_by_wordparts',
  // we actually want to sort to get the shortest word that matches first
  source: [
    {
      // If your collections have the same property tht you want to access you can pass a list to the collection
      collection: [Collection('hashtags'), Collection('users')],
      fields: {
        length: Query(Lambda('hashtagOrUser', Length(Select(['data', 'name'], Var('hashtagOrUser'))))),
        wordparts: Query(
          Lambda('hashtagOrUser', Distinct(Union(WordPartGenerator(Select(['data', 'name'], Var('hashtagOrUser'))))))
        )
      }
    }
  ],
  terms: [
    {
      binding: 'wordparts'
    }
  ],
  // values are 'range indexed' and therefore sorted in the order you provide them
  // we will also need the reference to the actual tag! We will place this second
  // since else the elements will be sorted by reference first.
  values: [
    {
      binding: 'length'
    },
    { field: ['ref'] }
  ],
  // serialized for an index that we will use for searching is not necessary.
  // false is the fault.
  serialized: false
})

/* Finally, if we need the binding to be different depending on the collection
 * we can do that as well. In this case we are not using this example since this type of
 * index does not build instantly (other indexes that are < 128 entities build instantly,
 * but ranging over multiple collections like this is a special case)]
 * (this delay might make people think the app is broken when they launch it themselves)
 */
const CreateHashtagsAndUsersByWordpartsWithBinding3 = CreateIndex({
  name: 'hashtags_and_users_by_wordparts',
  // we actually want to sort to get the shortest word that matches first
  source: [
    {
      collection: Collection('hashtags'),
      fields: {
        length: Query(Lambda('hashtag', Length(Select(['data', 'name'], Var('hashtag'))))),
        wordparts: Query(Lambda('hashtag', Union(WordPartGenerator(Select(['data', 'name'], Var('hashtag'))))))
      }
    },
    {
      collection: Collection('users'),
      fields: {
        length: Query(Lambda('user', Length(Select(['data', 'name'], Var('user'))))),
        wordparts: Query(
          Lambda(
            'user',
            Union(
              // We'll search both on the name as the alias.
              Union(WordPartGenerator(Select(['data', 'name'], Var('user')))),
              Union(WordPartGenerator(Select(['data', 'alias'], Var('user'))))
            )
          )
        )
      }
    }
  ],
  terms: [
    {
      binding: 'wordparts'
    }
  ],
  // values are 'range indexed' and therefore sorted in the order you provide them
  // we will also need the reference to the actual tag! We will place this second
  // since else the elements will be sorted by reference first.
  values: [
    {
      binding: 'length'
    },
    { field: ['ref'] }
  ],
  // serialized for an index that we will use for searching is not necessary.
  // false is the fault.
  serialized: false
})

async function createSearchIndexes(client) {
  await client.query(
    If(Exists(Index('hashtags_and_users_by_wordparts')), true, CreateHashtagsAndUsersByWordpartsWithBinding2)
  )
}

async function deleteSearchIndexes(client) {
  await client.query(
    If(Exists(Index('hashtags_and_users_by_wordparts')), true, Delete(Index('hashtags_and_users_by_wordparts')))
  )
}

export { createSearchIndexes, deleteSearchIndexes }
