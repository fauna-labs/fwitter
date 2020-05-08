import faunadb from 'faunadb'

import { deleteAndCreateDatabase, setupDatabaseSearchSpec } from '../setup/database'
import { DeleteAllRatelimiting } from '../setup/rate-limiting'
import { DeleteAllAccounts } from '../setup/accounts'
import { DeleteAllUsers } from '../setup/users'
import { registerWithUser, login } from './auth'
import { handlePromiseError } from './../helpers/errors'
import { searchPeopleAndTags } from './search'
import { CreateHashtags } from './hashtags'
// About this spec:
// --------------------
// This spec shows how the autocompletion search works.
// A search that searches over multiple collections, in this case user aliases and tags (indexes can range over multiple collections)
// It's based on bindings which is like a calculated value.
// That means that the value to search for is automatically transformed to the 'ngrams' that support the search

const q = faunadb.query
const { Index, Get } = q

// Empty indexes or indexes with less than 128 are created instantly. However,
// that does not count for indexes that range over multiple collections. Since it can take a few minutes to come online
// we wait for it to be active.

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function waitForIndexActive(client, indexName) {
  return client.query(Get(Index(indexName))).then(res => {
    if (res.active) {
      return res.active
    } else {
      console.log('Index still building, waiting...')
      return wait(5000).then(() => waitForIndexActive(client, indexName))
    }
  })
}

let adminClient = null
// Setup indexes and collections
beforeAll(async () => {
  try {
    // First create database to run this test in.
    adminClient = new faunadb.Client({
      secret: process.env.REACT_APP_TEST__ADMIN_KEY
    })
    const secret = await handlePromiseError(
      deleteAndCreateDatabase(adminClient, 'search-spec'),
      'Creating temporary test database'
    )
    // Scope key to the new database
    adminClient = new faunadb.Client({
      secret: secret
    })
    // Setup the database for this test
    await handlePromiseError(setupDatabaseSearchSpec(adminClient), 'Setup Database')
  } catch (err) {
    console.error(err)
  }
}, 60000)

// Delete the accounts in between each test
beforeEach(async () => {
  try {
    await adminClient.query(DeleteAllAccounts)
    await adminClient.query(DeleteAllUsers)
    // make sure the register function is reset.
    await adminClient.query(DeleteAllRatelimiting)
    // register two test users
    await waitForIndexActive(adminClient, 'hashtags_and_users_by_wordparts')
    // we will search on the names of users (the second last parameter)
    await registerWithUser(adminClient, 'test@test.com', 'testtest', 'MrStrawberry', 'useralias1')
    await registerWithUser(adminClient, 'test2@test.com', 'testtest', 'SirPepper', 'useralias2')
    // and the hashtags
    await adminClient.query(CreateHashtags(['Berries']))
    await adminClient.query(CreateHashtags(['Pepper', 'Raw Honey']))
    await adminClient.query(CreateHashtags(['ppppppppppppppppppppppppppppp']))
  } catch (err) {
    console.error(err)
  }
}, 1200000)

it('We can autocomplete tags and user aliases', function() {
  let loggedInClient = null

  return (
    login(adminClient, 'test@test.com', 'testtest')
      .then(res => {
        loggedInClient = new faunadb.Client({ secret: res.secret })
      })
      // We can search for these users by a part of their alias
      // We only search for lowercase!
      .then(res => {
        return searchPeopleAndTags(loggedInClient, 'mrstraw').then(res => {
          expect(res.length).toBe(1)
          return res
        })
      })
      .then(res => {
        return searchPeopleAndTags(loggedInClient, 'p').then(res => {
          // for very long names we have to type a longer part, we will find Pepper, and SirPepper, but not ppppppppppppppppppppppppppppp
          // we can set that length when we create the index (WordPartGenerator in ../setup/searching),
          // for performance reasons you do not want to set that too high, this type of ngram generation is meant for autocomplete,
          // not for indexing big chunk of text (we will make another example later on for that)
          expect(res.length).toBe(2)
          return res
        })
      })
      .then(res => {
        return searchPeopleAndTags(loggedInClient, 'ppppppppppppppppppppp').then(res => {
          expect(res.length).toBe(1) // for very long names we have to type a longer part
          return res
        })
      })
      .then(res => {
        return searchPeopleAndTags(loggedInClient, 'berr').then(res => {
          expect(res.length).toBe(2) // we find the tag berries as well as the user MrStrawberry
          expect(res).toHaveProperty([1, 'name'], 'MrStrawberry')
          expect(res).toHaveProperty([0, 'name'], 'Berries')
          return res
        })
      })
      .then(res => {
        return searchPeopleAndTags(loggedInClient, 'pe').then(res => {
          expect(res.length).toBe(2) // we find the tag Pepper as well as the user SirPepper
          expect(res).toHaveProperty([1, 'name'], 'SirPepper')
          expect(res).toHaveProperty([0, 'name'], 'Pepper')
          return res
        })
      })
      .catch(err => {
        if (err.requestResult) {
          console.log(err.requestResult.responseContent.errors)
        }
        throw err
      })
  )
}, 60000)
