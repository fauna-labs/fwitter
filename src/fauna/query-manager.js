import faunadb from 'faunadb'

import { registerWithUser, login, logout } from './queries/auth'
import {
  createFweet,
  getFweets,
  getFweetsByTag,
  getFweetsByAuthor,
  likeFweet,
  refweet,
  comment
} from './queries/fweets'
import { UpdateUser } from './queries/users'
import { searchPeopleAndTags } from './queries/search'
import { follow } from './queries/followers'

/* Initialize the client to contact FaunaDB
 * The client is initially started with the a 'BOOTSTRAP' token.
 * This token has only two permissions, call the 'login' and 'register' User Defined Function (UDF)
 * If the login function succeeds, it will return a new token with elevated permission.
 * The client will then be replaced with a client that uses the secret that was returned by Login.
 */

class QueryManager {
  constructor(token) {
    // A client is just a wrapper, it does not create a persitant connection
    // FaunaDB behaves like an API and will include the token on each request.
    this.bootstrapToken = token || process.env.REACT_APP_LOCAL___BOOTSTRAP_FAUNADB_KEY
    this.client = new faunadb.Client({
      secret: token || this.bootstrapToken
    })
  }

  login(email, password) {
    return login(this.client, email, password).then(res => {
      if (res) {
        this.client = new faunadb.Client({ secret: res.secret })
      }
      return res
    })
  }

  register(email, password, name, alias) {
    // randomly choose an icon
    const icon = 'person' + (Math.round(Math.random() * 22) + 1)
    return registerWithUser(this.client, email, password, name, alias, icon).then(res => {
      if (res) {
        this.client = new faunadb.Client({ secret: res.secret.secret })
      }
      return res
    })
  }

  logout() {
    return logout(this.client).then(res => {
      this.client = new faunadb.Client({
        secret: this.bootstrapToken
      })
      return res
    })
  }

  getFweets() {
    return getFweets(this.client)
  }

  getFweetsByTag(tagName) {
    return getFweetsByTag(this.client, tagName)
  }

  getFweetsByAuthor(user) {
    return getFweetsByAuthor(this.client, user)
  }

  createFweet(message, asset) {
    return createFweet(this.client, message, asset)
  }

  searchPeopleAndTags(keyword) {
    return searchPeopleAndTags(this.client, keyword)
  }

  likeFweet(fweetRef) {
    return likeFweet(this.client, fweetRef)
  }

  updateUser(name, alias) {
    // we don't pass in the icon yet atm
    return this.client.query(UpdateUser(name, alias))
  }

  refweet(fweetRef, message) {
    return refweet(this.client, fweetRef, message)
  }

  comment(fweetRef, message) {
    return comment(this.client, fweetRef, message)
  }

  follow(authorRef) {
    return follow(this.client, authorRef)
  }
}
const faunaQueries = new QueryManager()
export { faunaQueries, QueryManager }
