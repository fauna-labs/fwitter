import { flattenDataKeys } from '../helpers/util'
const faunadb = require('faunadb')
const q = faunadb.query
const { Call, Create, Collection, Var, Let } = q

/* Follow will be used to create a user defined function
 * hence we do not execute it but return an FQL statement instead */
function Follow(authorRef, userRef) {
  return Let(
    {
      followerstats: Create(Collection('followerstats'), {
        data: {
          postlikes: 0,
          postrefweets: 0,
          author: authorRef,
          follower: userRef
        }
      })
    },
    Var('followerstats')
  )
}

// Call the user defined function (the function is defined and updated in the '../setup/functions' file)
function follow(client, authorRef) {
  return client.query(Call(q.Function('follow'), authorRef)).then(res => flattenDataKeys(res))
}

export { Follow, follow }
