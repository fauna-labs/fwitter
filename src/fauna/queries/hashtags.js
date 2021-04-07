import { Map, Select, Paginate, Create, Collection, Let, Lambda, Var, Exists, Match, FaunaIndex, If } from 'faunadb/query'

function CreateHashtags(hashtags) {
  // hashtags is an array that looks like:
  // [{ name: '#hashtag', wordparts: [ 'h', 'ha', ... , 'ag', 'g']}]
  return Map(
    hashtags,
    Lambda(
      ['hashtag'],
      Let(
        {
          match: Match(FaunaIndex('hashtags_by_name'), Var('hashtag'))
        },
        If(
          Exists(Var('match')),
          // Paginate returns a { data: [ <references> ]} object. We validated that there is one element with exists already
          // We can fetch it with Select(['data', 0], ...)
          Select(['data', 0], Paginate(Var('match'))),
          // If it doesn't exist we create it and return the reference.
          Select(
            ['ref'],
            Create(Collection('hashtags'), {
              data: { name: Var('hashtag') }
            })
          )
        )
      )
    )
  )
}

export { CreateHashtags }
