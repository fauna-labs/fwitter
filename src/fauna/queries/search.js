import { Map, Match, Paginate, FaunaIndex, Lambda, Let, Var, Get } from 'faunadb/query'
import { flattenDataKeys } from '../helpers/util'

async function searchPeopleAndTags(client, keyword) {
  return client
    .query(
      // for the sake of explanation, let's go step by step.
      Let(
        {
          // Matching an index returns a setref.
          setref: Match(FaunaIndex('hashtags_and_users_by_wordparts'), keyword.toLowerCase()),
          // We materialize this setref (get the actual index values) to be able to map over it.
          // We only consider the first page which we'll set to 10 elements, this should be enough for an autocomplete.
          pages: Paginate(Var('setref'), { size: 10 }),
          // We have defined two values in the index so it returns
          // [[ 10, <user or tag ref>], [8,<user or tag ref>], ...]
          // two values for each match, the length and the reference. Let's fetch the references
          references: Map(Var('pages'), Lambda(['user', 'ref'], Var('ref')))
        },
        // Finally we can get get data that is associated with these references via Get!
        Map(Var('references'), Lambda(['ref'], Get(Var('ref'))))
      )
    )
    .then(res => {
      return flattenDataKeys(res)
    })
    .catch(err => {
      console.log(err)
      throw err
    })
}

export { searchPeopleAndTags }
