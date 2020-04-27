import faunadb from 'faunadb'
import { flattenDataKeys } from '../helpers/util'
import { AddRateLimiting } from './rate-limiting'
import { Follow } from './followers'

const q = faunadb.query
const {
  Paginate,
  If,
  IsEmpty,
  Call,
  Logout,
  Let,
  Var,
  Create,
  Collection,
  Select,
  Login,
  Match,
  Get,
  Index,
  Identify,
  Do,
  Delete,
  ContainsStrRegex,
  Abort,
  GTE,
  Length
} = q

/*
 * The following functions return an Fauna Query Language (FQL) statement that we will store in a  User defined Function (UDF).
 * (this happens in ./../setup/functions)
 */

/* ---------------- REGISTER ----------------- */

/* Register Example1 - creating a simple account
 * If we just want to create an account we would do it like this */
function RegisterAccount(email, password) {
  return Create(Collection('accounts'), {
    credentials: { password: password },
    data: {
      email: email
    }
  })
}

/* Register Example2 - add some rate limiting
 * This application is frontend only, can we limit how many people
 * register to make sure a registering bot are 'somewhat' controlled'
 * As an exaple of how you can easily compose FQL queries, we can just take the original statement.
 * Feed it to a Javascript function that wraps it in another FQL function.
 * All FQL functions that simply take parameters, this procedural approach has quite some
 * benefits when you start generating queries out of multiple components compared to declarative
 * approachces such as SQL where this can become very complex very quickly */
// eslint-disable-next-line no-unused-vars
function RegisterAccountExample2(email, password) {
  const RegisterFQLStatement = Create(Collection('accounts'), {
    credentials: { password: password },
    data: {
      email: email
    }
  })
  // Easily compose it and add rate-limiting with the AddRateLimiting.
  // We do not have an identity yet here so we add a global rate limit instead of Identity based
  // PS: there is a config in rate-limiting sets the amount of calls per time-unit for the rate-limiting
  // dependent on the key which you can override by passing in extra parameters. Also note that
  // rate-limiting like this only makes sense if your user can not edit the rate_limiting collection which we
  // achieve by setting the right roles and placing these functions in User defined Functions
  AddRateLimiting('register', RegisterFQLStatement, 'global')
}

/* Register Example3 - we also want to create a user.
 * However, we also want to create a user automatically when we create an account.
 * We can use a Let to structure our query */
// eslint-disable-next-line no-unused-vars
function RegisterExample3(email, password, name, alias, icon, rateLimiting = true) {
  const RegisterFQLStatement = Let(
    {
      user: Create(Collection('users'), {
        data: {
          name: name,
          alias: alias,
          icon: icon
        }
      }),
      account: Select(
        ['ref'],
        Create(Collection('accounts'), {
          credentials: { password: password },
          data: {
            email: email,
            user: Select(['ref'], Var('user'))
          }
        })
      )
    },
    { user: Var('user'), account: Var('account') }
  )

  // Easily compose it and add rate-limiting with the AddRateLimiting.
  // We do not have an identity yet here so we add a global rate limit instead of Identity based
  return rateLimiting ? AddRateLimiting('register', RegisterFQLStatement, 'global') : RegisterFQLStatement
}

/* Register Example4 - let's extend it to do e-mail validation 
   And follow ourselves at the moment we create the user 
   since you only see the feed of the people you follow */
function RegisterWithUser(email, password, name, alias, icon, rateLimiting = true) {
  // It's always a good idea to use If for such validations compared to Do since Do is not short-circuited at this point
  // at the read-phase, which means that you will incur more reads.
  const ValidateEmail = FqlStatement =>
    If(
      ContainsStrRegex(
        email,
        "^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$"
      ),
      // If it's valid, we continue with the original statement
      FqlStatement,
      // Else we Abort!
      Abort('Invalid e-mail provided')
    )

  const ValidatePassword = FqlStatement =>
    If(
      GTE(Length(password), 8),
      // If it's valid, we continue with the original statement
      FqlStatement,
      // Else we Abort!
      Abort('Invalid password, please provided at least 8 chars')
    )

  const RegisterFQLStatement = Let(
    {
      user: Create(Collection('users'), {
        data: {
          name: name,
          alias: alias,
          icon: icon
        }
      }),
      account: Select(
        ['ref'],
        Create(Collection('accounts'), {
          credentials: { password: password },
          data: {
            email: email,
            user: Select(['ref'], Var('user'))
          }
        })
      ),
      // We don't ask verification of the e-mail so we might as well login the user directly.
      secret: Login(Var('account'), { password: password })
    },
    Do(
      // Follow yourself
      Follow(Select(['ref'], Var('user')), Select(['ref'], Var('user'))),
      // then return user and account
      { user: Var('user'), account: Var('account'), secret: Var('secret') }
    )
  )

  // Easily compose it and add rate-limiting with the AddRateLimiting.
  // We do not have an identity yet here so we add a global rate limit instead of Identity based
  return rateLimiting
    ? ValidatePassword(ValidateEmail(AddRateLimiting('register', RegisterFQLStatement, 'global')))
    : RegisterFQLStatement
}

/* ---------------- LOGIN ----------------- */

/* Login Example1 - login with simple account
 * If we just want to login with an account we would do it like this */
// eslint-disable-next-line no-unused-vars
function LoginAccountExample1(email, password) {
  return Login(Match(Index('accounts_by_email'), email), { password: password })
}

/* Login Example 2 - what if I want to return the user as well?
 * we separated accounts from users with plans of adding other 'account' possibilities in the future
 * e.g. a user could have both a single-sign on and an e-mail/password account.
 * let's return the user immediately in one query.
 */

function LoginAccountExample2(email, password) {
  return Let(
    {
      // Login will return a token if the password matches the credentials that were provided on register.
      // Note that this FQL statement excepts two variables to exist: 'email', 'password'
      res: Login(Match(Index('accounts_by_email'), email), {
        password: password
      }),
      // We will return both the token as some account/user information.
      account: Get(Select(['instance'], Var('res'))),
      user: Get(Select(['data', 'user'], Var('account'))),
      secret: Select(['secret'], Var('res'))
    },
    { account: Var('account'), user: Var('user'), secret: Var('secret') }
  )
}

/* Login Example 3 - Login with naive Rate-limiting
 * First version, can we use our AddRateLimiting function here?
 * We can but it will also rate-limit succesful logins and that is not the exact goal here.
 * The rate-limiting identifier is here based on the e-mail
 * instead of the Identity() since there is no Identity() yet. Identity becomes available when you use a
 * token retrieves via Login or by Creating a token with Create(Tokens(), { instance: <ref to database instance> })
 * in which case the 'instance' becomes the Identity. Tip:
 * you could use 'HasIdentity()' to safely check whether there is an Identitity if necessary.
 *
 * See the last example for the better version.
 **/
// eslint-disable-next-line no-unused-vars
function LoginAccountExample3(email, password) {
  return AddRateLimiting('login', LoginAccountExample2(email, password), email)
}

/* Login Example 4 - Login with Rate-limiting only on faulty logins
* We do not want to limit the amount of logins on a certain account in time
* we only want to limit 'faulty logins' 

*/

function LoginAccount(email, password) {
  const FQLStatement = If(
    Identify(Match(Index('accounts_by_email'), email), password),
    Do(
      Let(
        {
          rateLimitingPage: Paginate(Match(Index('rate_limiting_by_action_and_identity'), 'login', email))
        },
        If(
          // Check whether there is a value
          IsEmpty(Var('rateLimitingPage')),
          true,
          Delete(Select([0], Var('rateLimitingPage')))
        )
      ),
      // Just login as usual so we get the same result we had before.
      LoginAccountExample2(email, password)
    ),
    // If unsuccesfull.. we don't need to do anything special, just return false is fine.
    false
  )

  // And of course we want to add rate-limiting first.
  // The rate limiting config for login contains calls: 3 and perSeconds: 0 (see './rate-limiting.js)
  // 0 means that there is no decay, no matter how long you wait you can do maximum 3 calls.
  // But on successful login we clean up the rate-limiting so they only remain on failed logins.
  const query = AddRateLimiting('login', FQLStatement, email)
  return query
}

/* ---------------- CALLING ----------------- */
/*
 * Both Login as Register are simple calls to User Defined Functions (UDF)
 * which are stored on the database (much like stored procedures, but they will run on the closest node)
 * (this happens in ./../setup/functions)
 */

/* ********** Call the UDF login function *********** */
async function login(client, email, password) {
  return client.query(Call(q.Function('login'), email, password)).then(res => flattenDataKeys(res))
}

/* ********** Call the UDF register function *********** */
function register(client, email, password) {
  return client.query(Call(q.Function('register'), email, password)).then(res => flattenDataKeys(res))
}

function registerWithUser(client, email, password, name, alias, icon) {
  return client
    .query(Call(q.Function('register_with_user'), email, password, name, alias, icon))
    .then(res => flattenDataKeys(res))
}

/* ********** Logout *********** */
async function logout(client) {
  const logoutResult = await client.query(Logout(true))
  return logoutResult
}

export {
  RegisterWithUser,
  RegisterAccount,
  LoginAccount,
  LoginAccountExample1,
  register,
  registerWithUser,
  login,
  logout
}
