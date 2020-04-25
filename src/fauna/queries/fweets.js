import { flattenDataKeys } from '../helpers/util'
import { CreateHashtags } from './../queries/hashtags'
import { AddRateLimiting } from './../queries/rate-limiting'

const faunadb = require('faunadb')
const q = faunadb.query
const {
  Call,
  Create,
  Collection,
  Identity,
  Paginate,
  Documents,
  Lambda,
  Get,
  Var,
  Select,
  Let,
  Match,
  Index,
  Join,
  If,
  Exists,
  Update,
  Do,
  Add,
  Subtract,
  Not,
  Contains,
  Abort,
  Now
} = q

/* CreateFweet will be used to create a user defined function
 * hence we do not execute it but return an FQL statement instead */
function CreateFweet(message, tags, asset) {
  const FQLStatement = Let(
    {
      hashtagrefs: CreateHashtags(tags),
      newFweet: Create(Collection('fweets'), {
        data: {
          message: message,
          author: Select(['data', 'user'], Get(Identity())),
          hashtags: Var('hashtagrefs'),
          asset: asset,
          likes: 0,
          refweets: 0,
          comments: 0,
          // we will order by creation time, we already have 'ts' by default but updated will also update 'ts'.
          created: Now()
        }
      }),
      // We then get the fweet in the same format as when we normally get them.
      // Since FQL is composable we can easily do this.
      fweetWithUserAndAccount: GetFweetsWithUsersMapGetGeneric([Select(['ref'], Var('newFweet'))])
    },
    Var('fweetWithUserAndAccount')
  )

  return AddRateLimiting('create_fweet', FQLStatement, Identity())
}

/* LikeFweet will be used to create a user defined function
 * hence we do not execute it but return an FQL statement instead */
function LikeFweet(fweetRef) {
  return Let(
    {
      account: Get(Identity()),
      userRef: Select(['data', 'user'], Var('account')),
      fweetStatisticsRef: Match(Index('fweetstats_by_user_and_fweet'), Var('userRef'), fweetRef),
      fweet: Get(fweetRef),
      authorRef: Select(['data', 'author'], Var('fweet')),
      followerStatisticsRef: Match(Index('followerstats_by_author_and_follower'), Var('authorRef'), Var('userRef')),
      newLikeStatus: If(
        Exists(Var('fweetStatisticsRef')),
        Not(Select(['data', 'like'], Get(Var('fweetStatisticsRef')))),
        true
      ),
      popularityGain: If(Var('newLikeStatus'), 1, -1)
    },
    Do(
      // Update the fweet so we have an idea of the total likes
      If(
        Var('newLikeStatus'),
        Update(fweetRef, {
          data: {
            likes: Add(Select(['data', 'likes'], Var('fweet')), 1)
          }
        }),
        Update(fweetRef, {
          data: {
            likes: Subtract(Select(['data', 'likes'], Var('fweet')), 1)
          }
        })
      ),
      // Update fweet stats so we know who liked what
      If(
        Exists(Var('fweetStatisticsRef')),
        // Getting the same element twice has no impact on reads, the query will only get it once.
        Update(Select(['ref'], Get(Var('fweetStatisticsRef'))), {
          data: {
            like: Var('newLikeStatus')
          }
        }),
        Create(Collection('fweetstats'), {
          data: {
            user: Var('userRef'),
            fweet: fweetRef,
            like: Var('newLikeStatus'),
            refweet: false,
            comment: false
          }
        })
      ),
      // Update the follower stats so we can raise his popularity, this
      // has an impact on the feed that the user will see, every post he likes or retweets from an author he follows will
      // raise the popularity of the author for this particular user (this is kept in the followerstats collection)
      // return the new fweet with its stats.
      If(
        Exists(Var('followerStatisticsRef')),
        Update(Select(['ref'], Get(Var('followerStatisticsRef'))), {
          data: {
            postlikes: Add(Select(['data', 'postlikes'], Get(Var('followerStatisticsRef'))), Var('popularityGain'))
          }
        }),
        // We don't keep stats for people we don't follow (we could but opted not to)
        true
      ),
      GetFweetsWithUsersMapGetGeneric([fweetRef])
    )
  )
}

/* Refweet will be used to create a user defined function
 * hence we do not execute it but return an FQL statement instead */
function Refweet(fweetRef, message, tags) {
  return Let(
    {
      // Get current fweet statistics
      account: Get(Identity()),
      userRef: Select(['data', 'user'], Var('account')),
      fweet: Get(fweetRef),
      authorRef: Select(['data', 'author'], Var('fweet')),
      fweetStatisticsRef: Match(Index('fweetstats_by_user_and_fweet'), Var('userRef'), fweetRef),
      // Keep a var so we know whether we already refweeted or not
      refweetStatus: If(
        Exists(Var('fweetStatisticsRef')),
        Select(['data', 'refweet'], Get(Var('fweetStatisticsRef'))),
        false
      ),
      // We're going to keep stats for that author/follower relation to order his tweets in popularity.
      followerStatisticsRef: Match(Index('followerstats_by_author_and_follower'), Var('authorRef'), Var('userRef'))
    },
    If(
      Var('refweetStatus'),
      // Abort is easier than using If checks on each of the following steps
      Abort('already refweeted'),
      Let(
        {
          fweetStatistics: If(
            Exists(Var('fweetStatisticsRef')),
            Update(Select(['ref'], Get(Var('fweetStatisticsRef'))), {
              data: {
                refweet: true
              }
            }),
            Create(Collection('fweetstats'), {
              data: {
                user: Var('userRef'),
                fweet: fweetRef,
                like: false,
                refweet: true,
                comment: false
              }
            })
          ),
          newFweet: Create(Collection('fweets'), {
            data: {
              original: fweetRef,
              // author of the refweet, not of the fweet
              author: Select(['data', 'user'], Get(Identity())),
              message: message,
              hashtags: tags,
              likes: 0,
              refweets: 0,
              comments: 0
            }
          }),
          originalFweet: Get(fweetRef),
          updateOriginal: Update(fweetRef, {
            data: { refweets: Add(1, Select(['data', 'refweets'], Var('originalFweet'))) }
          }),
          followerstatistics: If(
            Exists(Var('followerStatisticsRef')),
            Update(Select(['ref'], Get(Var('followerStatisticsRef'))), {
              data: {
                // we don't allow to remove a 'refweet' or refweet twice so we just add 1
                postrefweets: Add(Select(['data', 'postrefweets'], Get(Var('followerStatisticsRef'))), 1)
              }
            }),
            // We don't keep stats for people we don't follow (we could but opted not to)
            true
          )
        },
        {
          // Two things are updated, the original fweet (it has now an additional 'refweet')
          // and we have a new 'refweet' that needs to be added so we fetch two things for which
          // we again reuse our previous function to have the same fweet fetching structure everywhere!
          refweet: Select([0], GetFweetsWithUsersMapGetGeneric([Select(['ref'], Var('newFweet'))])),
          original: Select([0], GetFweetsWithUsersMapGetGeneric([fweetRef]))
        }
      )
    )
  )
}

/* Comment will be used to create a user defined function
 * hence we do not execute it but return an FQL statement instead */
function Comment(fweetRef, message) {
  return Let(
    {
      account: Get(Identity()),
      userRef: Select(['data', 'user'], Var('account')),
      fweetStatisticsRef: Match(Index('fweetstats_by_user_and_fweet'), Var('userRef'), fweetRef),
      fweetStatistics: If(
        Exists(Var('fweetStatisticsRef')),
        Update(Select(['ref'], Get(Var('fweetStatisticsRef'))), {
          data: {
            comment: true
          }
        }),
        Create(Collection('fweetstats'), {
          data: {
            user: Var('userRef'),
            fweet: fweetRef,
            like: false,
            refweet: false,
            comment: true
          }
        })
      ),
      comment: Create(Collection('comments'), {
        data: {
          message: message,
          author: Select(['data', 'user'], Get(Identity())),
          fweet: fweetRef
        }
      }),
      fweet: Get(fweetRef),
      updateOriginal: Update(fweetRef, {
        data: { comments: Add(1, Select(['data', 'comments'], Var('fweet'))) }
      }),
      // We then get the fweet in the same format as when we normally get them.
      // Since FQL is composable we can easily do this.
      fweetWithUserAndAccount: GetFweetsWithUsersMapGetGeneric([fweetRef])
    },
    // We get a list of 1 element, so let's take the fweet out of the list.
    Select([0], Var('fweetWithUserAndAccount'))
  )
}

// We could just pass this in and create the fweet like this.
// However, we loaded the function in a UDF (see setup/functions)
// and added rate-limiting to it as an example to show you how UDFs can
// help you secure a piece of code as a whole.
function createFweetWithoutUDF(client, message, tags) {
  return client.query(CreateFweet(message, tags)).then(res => flattenDataKeys(res))
}
// Instead we call the function
function createFweet(client, message, asset) {
  // Extract hashtags from the message
  const hashTags = findHashtags(message).map(t => t.substring(1))
  return client.query(Call(q.Function('create_fweet'), message, hashTags, asset)).then(res => flattenDataKeys(res))
}

// Call the likeFweet UDF function
function likeFweet(client, fweetRef) {
  return client.query(Call(q.Function('like_fweet'), fweetRef)).then(res => flattenDataKeys(res))
}

// Call the refweet UDF function
function refweet(client, fweetRef, message) {
  const hashTags = findHashtags(message).map(t => t.substring(1))
  return client.query(Call(q.Function('refweet'), fweetRef, message, hashTags)).then(res => flattenDataKeys(res))
}

// Call the comment UDF function
function comment(client, fweetRef, message) {
  return client.query(Call(q.Function('comment'), fweetRef, message)).then(res => flattenDataKeys(res))
}

// We could get fweets via the collection, however than we have no control on the sorting
// So it's only here as an additional example.
// eslint-disable-next-line no-unused-vars
function GetFweetsExample1(client) {
  return Paginate(Documents(Collection('fweets')))
}

// We can use an index to get the sorting as we want it.
// This query only gets the values contained in the index though.
// Let's expand on that in the next function and get all related information of a fweet.
// eslint-disable-next-line no-unused-vars
function GetFweetsExample2(client) {
  return Paginate(Match(Index('all_fweets')))
}

// In our next version we use GetFweetsWithUsersMapGetGeneric to take out the references
// of the fweets that come out of the all_fweets index and get all related data: comments, likes etc...
// this is abstracted in a function to make sure that everywhere where we want to return fweets
// (e.g. after creation/update etc) that we get them in the exact same way.
// We will also not call it immediately since we will store it as a User Defined Function (UDF) instead!
// eslint-disable-next-line no-unused-vars
function GetFweetsExample3(client) {
  return GetFweetsWithUsersMapGetGeneric(
    q.Map(
      Paginate(Match(Index('all_fweets'))),
      // Since our index contains two values, the lambda takes an array of two values
      Lambda(['ts', 'ref'], Var('ref'))
    )
  )
}

/*
 * You might be tempted to join with the obvious 'Join' keyword.
 * The following two examples are therefore added for documentation purposes to show how Join differs from the Map/Get approach.
 * First of all, a 'Join' is always done on an index. Join essentially transforms the set you pass into it and replaces it with the data from the index so it's rather a 'traverse'.
 * E.g. the example below returns the 'fweets' but no longer the account that is linked to it. This can be useful however, see the second example.
 */
// eslint-disable-next-line no-unused-vars
function GetFweetsWithUsersJoinExample1(client) {
  return client
    .query(Paginate(Join(Documents(Collection('accounts')), Index('fweets_by_author_simple'))))
    .then(res => flattenDataKeys(res))
    .catch(err => {
      console.log(err)
      throw err
    })
}

/* Imagine you already have the 'account' or the e-mail of the account in your app then you can easily get the
 * tweets using Join. You could use the index here to return exactly the details of the 'fweet' that you need for this query.
 * Pricing wise it's interesting to know that this approach is cheaper than Map/Get. In Fauna, one index page === one read,
 * and one Get is of course one read. This means that the below approach is a more cost effective way to get all fweets for a specific account.
 * If a user would have 100s of fweets we could get these with two index reads instead of one index reads and 100s of gets.
 */
// eslint-disable-next-line no-unused-vars
function GetFweetsWithUsersJoinExample2(client, email) {
  return client
    .query(Paginate(Join(Match(Index('accounts_by_email'), email), Index('fweets_by_author_simple'))))
    .then(res => flattenDataKeys(res))
    .catch(err => {
      console.log(err)
      throw err
    })
}

// The previous example was ok, but all_fweets just gets fweets in the order
// that they were posted. Of course we want to see fweets from our followers
// and preferably according to their popularity and how old they are.
// We have a collection called followerstats, a relation between
// a follower and an author which keeps how popular that author is to that specific follower.
// We have built an index ('followerstats_by_user_popularity') using bindings (see ./../setup/followers) that calculates
// a measure of 'popularity' and de decays it by incorporating the unix start timestamp.
function GetFweets(client) {
  const FQLStatement = GetFweetsWithUsersMapGetGeneric(
    // Since we start of here with followerstats index (a ref we don't need afterwards, we can use join here!)
    q.Map(
      Paginate(
        Join(
          // the index takes one term, the user that is browsing our app
          Match(Index('followerstats_by_user_popularity'), Select(['data', 'user'], Get(Identity()))),
          // Join can also take a lambda,
          // and we have to use a lambda since our index returns more than one variable.
          // Our index again contains two values (the score and the author ref), so takes an array of two values
          // We only care about the author ref which we will feed into the fweets_by_author index,
          // to get fweet references. Added advantage, because we use a join here we can let the index sort as well ;).
          Lambda(['fweetscore', 'authorRef'], Match(Index('fweets_by_author'), Var('authorRef')))
        )
      ),
      // the created time has served its purpose for sorting.
      Lambda(['createdtime', 'ref'], Var('ref'))
    )
  )

  // Getting fweets is a moderately heavy operation.
  // To discourage that people start 'crawling' fwitter, we can rate-limit it.
  // Reads will be charged since Fauna reads optimistically
  // still help though to discourage people to start crawling your API.
  return AddRateLimiting('get_fweets', FQLStatement, Identity())
}

function getFweets(client) {
  return client.query(Call(q.Function('get_fweets'))).then(res => flattenDataKeys(res))
}

function GetFweetsByTag(tagName) {
  const FQLStatement = Let(
    {
      // We only receive the tag name, not reference (since this is passed through the URL, a ref would be ugly in the url right?)
      // So let's get the tag, we assume that it still exists (if not Get will error but that is fine for our use case)
      tagReference: Select([0], Paginate(Match(Index('hashtags_by_name'), tagName))),
      res: GetFweetsWithUsersMapGetGeneric(
        // Since we start of here with followerstats index (a ref we don't need afterwards, we can use join here!)
        q.Map(
          Paginate(Match(Index('fweets_by_tag'), Var('tagReference'))),
          Lambda(['fweetscore', 'fweetRef'], Var('fweetRef'))
        )
      )
    },
    Var('res')
  )

  return AddRateLimiting('get_fweets_by_tag', FQLStatement, Identity())
}

function getFweetsByTag(client, tag) {
  return client.query(Call(q.Function('get_fweets_by_tag'), tag)).then(res => flattenDataKeys(res))
}

function GetFweetsByAuthor(authorAlias) {
  const FQLStatement = Let(
    {
      // We only receive the userAlias, not reference (since this is passed through the URL, a ref would be ugly in the url right?)
      // So let's get the user, we assume that it still exists (if not Get will error but that is fine for our use case)
      authorReference: Select([0], Paginate(Match(Index('users_by_alias'), authorAlias))),
      results: GetFweetsWithUsersMapGetGeneric(
        // When we look at the feed of fweets of a certain user, we are just going to order them
        // Chronologically.
        q.Map(
          Paginate(Match(Index('fweets_by_author'), Var('authorReference'))),
          // The index contains two values so our lambda also takes two values.
          Lambda(['createdtime', 'ref'], Var('ref'))
        )
      )
    },
    Var('results')
  )

  return AddRateLimiting('get_fweets_by_author', FQLStatement, Identity())
}

function getFweetsByAuthor(client, authorAlias) {
  return client.query(Call(q.Function('get_fweets_by_author'), authorAlias)).then(res => flattenDataKeys(res))
}

/* Get fweets and the user that is the author of the message.
 * This is an example of a join using Map/Get which is easy when you have the reference of the element you need.
 * a Fweet has the reference to the Account and an account has a reference to the user.
 */

function GetFweetsWithUsersMapGetGeneric(TweetsSetRefOrArray, depth = 1) {
  // Let's do this with a let to clearly show the separate steps.
  return q.Map(
    TweetsSetRefOrArray, // for all tweets this is just Paginate(Documents(Collection('fweets'))), else it's a match on an index
    Lambda(ref =>
      Let(
        {
          fweet: Get(Var('ref')),
          original: If(
            Contains(['data', 'original'], Var('fweet')),
            // refweet, get original fweet's data.
            // We want to get the original as well in the same structure, let's just use recursion
            // to construct that query, we could get the whole refweet chain like this, it looks a bit
            // like traversing a graph. We are only interested in the first refweet so we pas depth 1 as default,
            // depth is meant to make sure sure we don't loop endelessly in javascript.
            depth > 0
              ? Select([0], GetFweetsWithUsersMapGetGeneric([Select(['data', 'original'], Var('fweet'))], depth - 1))
              : false,
            // normal fweet, there is no original
            false
          ),
          // Get the user that wrote the fweet.
          user: Get(Select(['data', 'author'], Var('fweet'))),
          // Get the account via identity
          account: Get(Identity()),
          // Get the user that is currently logged in.
          currentUserRef: Select(['data', 'user'], Var('account')),
          // Get the original fweet
          // Get the statistics for the fweet
          fweetstatsMatch: Match(
            Index('fweetstats_by_user_and_fweet'),
            Var('currentUserRef'),
            Select(['ref'], Var('fweet'))
          ),
          followerstatisticsMatch: Match(
            Index('followerstats_by_author_and_follower'),
            Var('currentUserRef'),
            Select(['ref'], Var('fweet'))
          ),
          fweetstats: If(Exists(Var('fweetstatsMatch')), Get(Var('fweetstatsMatch')), {}),
          // Get comments, index has two values so lambda has two values
          comments: q.Map(
            Paginate(Match(Index('comments_by_fweet_ordered'), Var('ref'))),
            Lambda(
              ['ts', 'commentref'],
              Let(
                {
                  comment: Get(Var('commentref')),
                  author: Get(Select(['data', 'author'], Var('comment')))
                },
                {
                  comment: Var('comment'),
                  author: Var('author')
                }
              )
            )
          )
        },
        // Return our elements
        {
          user: Var('user'),
          original: Var('original'),
          fweet: Var('fweet'),
          fweetstats: Var('fweetstats'),
          comments: Var('comments')
        }
      )
    )
  )
}

/* Helper to split up strings with hashtags and preprocess them.
 */

function findHashtags(searchText) {
  const regexp = /\B#\w\w+\b/g
  const result = searchText.match(regexp)
  if (result) {
    return result
  } else {
    return []
  }
}

export {
  createFweet,
  CreateFweet,
  createFweetWithoutUDF,
  GetFweets,
  getFweets,
  GetFweetsByTag,
  getFweetsByTag,
  GetFweetsByAuthor,
  getFweetsByAuthor,
  LikeFweet,
  likeFweet,
  Refweet,
  refweet,
  Comment,
  comment
}
