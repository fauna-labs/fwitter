import {
  CreateFweet,
  LikeFweet,
  Refweet,
  Comment,
  GetFweets,
  GetFweetsByTag,
  GetFweetsByAuthor
} from './../queries/fweets'
import { Follow } from './../queries/followers'
import { RegisterWithUser, RegisterAccount, LoginAccount, LoginAccountExample1 } from './../queries/auth'

const faunadb = require('faunadb')
const q = faunadb.query
const { Var, Query, Lambda, Exists, If, Update, Select, Get, CreateFunction, Role, Identity } = q

// A convenience function to either create or update a function.
function CreateOrUpdateFunction(obj) {
  return If(
    Exists(q.Function(obj.name)),
    Update(q.Function(obj.name), { body: obj.body, role: obj.role }),
    CreateFunction({ name: obj.name, body: obj.body, role: obj.role })
  )
}

/* ********** Insert them as User Defined functions *********** */
/* If this statement is executed it will be executed as a user defined function.
 * We use a wrapper helper to make sure that we override a function with 'Update' in case it alread exists
 * and Create it with 'CreateFunction' if it did not exist yet.
 * User Defined Functions (UDF): https://docs.fauna.com/fauna/current/api/graphql/functions
 * CreateFunction: https://docs.fauna.com/fauna/current/api/fql/functions/createfunction
 * Update: https://docs.fauna.com/fauna/current/api/fql/functions/update
 */
const CreateAccountUDF = CreateOrUpdateFunction({
  name: 'register',
  // Note that 'Lambda' requires two parameters to be provided when you call the User Defined Function.
  // The parameters will be bound to the variables 'email' and 'password' which are used by the functions that we pass in.
  // Since these functions are in the scope of this lambda, they can access these varaibles.
  // (see above how these functions use Var('email) and Var('password).

  // TODO - simple email format verification and password verification.
  // ContainsStrRegex(
  //   'test@gmail.com',
  //   "^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"

  body: Query(Lambda(['email', 'password'], RegisterAccount(Var('email'), Var('password')))),
  role: Role('functionrole_register')
})

// Let's show a second example where the function immediately adds a user that is linked to the account.
const CreateAccountWithUserUDF = CreateOrUpdateFunction({
  name: 'register_with_user',
  body: Query(
    Lambda(
      ['email', 'password', 'name', 'alias', 'icon'],
      RegisterWithUser(Var('email'), Var('password'), Var('name'), Var('alias'), Var('icon'))
    )
  ),
  role: Role('functionrole_register_with_user')
})

const CreateAccountWithUserNoRatelimitingUDF = CreateOrUpdateFunction({
  name: 'register_with_user',
  body: Query(
    Lambda(
      ['email', 'password', 'name', 'alias', 'icon'],
      RegisterWithUser(Var('email'), Var('password'), Var('name'), Var('alias'), Var('icon'), false)
    )
  ),
  role: Role('functionrole_register_with_user')
})

const CreateLoginUDF = CreateOrUpdateFunction({
  name: 'login',
  body: Query(Lambda(['email', 'password'], LoginAccount(Var('email'), Var('password')))),
  role: Role('functionrole_login')
})

const CreateLoginSimpleUDF = CreateOrUpdateFunction({
  name: 'login',
  body: Query(Lambda(['email', 'password'], LoginAccountExample1(Var('email'), Var('password')))),
  role: Role('functionrole_login')
})

// Example of an identity based rate-limiting function
// Of course this requires you to use UDFs since you do not want to give the end user
// access to:
//  - Creating the fweets without hitting rate limiting
//  - Changing the rate limiting.

const CreateFweetUDF = CreateOrUpdateFunction({
  name: 'create_fweet',
  body: Query(Lambda(['message', 'hashtags', 'asset'], CreateFweet(Var('message'), Var('hashtags'), Var('asset')))),
  role: Role('functionrole_manipulate_fweets')
})

// Another example of database logic where it makes sense to use an UDF.
// We keep information in the 'fweetstats' about which user liked which post.
// We also want to know the amount of likes on a post though which we could calculate but it would
// probably not make sense to calculate it each time. Instead we would save this count directly in the
// same transactions on the 'fweet' entity.
// But how to secure this? Writing an ABAC rule to say that a user can only increment or decrement the likes
// if it just liked the fweet (added to fweetstas) is not feasible since it requires reasoning over updates on multiple collections.
// Since we do not have a backend, the logical way to secure something like this is a user defined function!
// That way, the user only has the rights to execute this like_fweet function but it's not necessary to give him permissions to directly
// write to the fweet.

const LikeFweetUDF = CreateOrUpdateFunction({
  name: 'like_fweet',
  body: Query(Lambda(['fweetRef'], LikeFweet(Var('fweetRef')))),
  role: Role('functionrole_manipulate_fweets')
})

const RefweetUDF = CreateOrUpdateFunction({
  name: 'refweet',
  body: Query(Lambda(['fweetRef', 'message', 'hashtags'], Refweet(Var('fweetRef'), Var('message'), Var('hashtags')))),
  role: Role('functionrole_manipulate_fweets')
})

const CommentUDF = CreateOrUpdateFunction({
  name: 'comment',
  body: Query(Lambda(['fweetRef', 'message'], Comment(Var('fweetRef'), Var('message')))),
  role: Role('functionrole_manipulate_fweets')
})

const GetFweetsUDF = CreateOrUpdateFunction({
  name: 'get_fweets',
  body: Query(Lambda([], GetFweets())),
  role: Role('functionrole_manipulate_fweets')
})

const GetFweetsByAuthorUDF = CreateOrUpdateFunction({
  name: 'get_fweets_by_author',
  body: Query(Lambda(['authorname'], GetFweetsByAuthor(Var('authorname')))),
  role: Role('functionrole_manipulate_fweets')
})

const GetFweetsByTagUDF = CreateOrUpdateFunction({
  name: 'get_fweets_by_tag',
  body: Query(Lambda(['tagname'], GetFweetsByTag(Var('tagname')))),
  role: Role('functionrole_manipulate_fweets')
})

const FollowUDF = CreateOrUpdateFunction({
  name: 'follow',
  body: Query(Lambda(['authorRef'], Follow(Var('authorRef'), Select(['data', 'user'], Get(Identity()))))),
  role: Role('functionrole_manipulate_fweets')
})

export {
  CreateAccountUDF,
  CreateFweetUDF,
  CreateAccountWithUserUDF,
  CreateAccountWithUserNoRatelimitingUDF,
  CreateLoginUDF,
  CreateLoginSimpleUDF,
  GetFweetsByAuthorUDF,
  GetFweetsByTagUDF,
  LikeFweetUDF,
  RefweetUDF,
  CommentUDF,
  GetFweetsUDF,
  FollowUDF,
  CreateOrUpdateFunction
}
