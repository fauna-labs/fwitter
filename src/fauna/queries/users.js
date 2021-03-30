import faunadb from 'faunadb'

const q = faunadb.query
const { Create, Collection, Update, Let, Get, Identity, Var, Select } = q

function CreateUser(name, alias, icon) {
  return Create(Collection('users'), {
    data: {
      name: name,
      alias: alias,
      icon: icon
    }
  })
}

/* We could place this function as well in a UDF and just derive the user to update from
 * the Identity() which we do not need to pass as a paramter.
 * Instead, shows a different approach, security via Roles.
 */

function UpdateUser(name, alias, icon) {
  console.log('updating', name, alias, icon)
  return Let(
    {
      accountRef: Identity(),
      userRef: Select(['data', 'user'], Get(Var('accountRef')))
    },
    Update(Var('userRef'), {
      data: {
        name: name,
        alias: alias,
        icon: icon
      }
    })
  )
}

export { CreateUser, UpdateUser }
