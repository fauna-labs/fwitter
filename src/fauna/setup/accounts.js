const faunadb = require('faunadb')
const q = faunadb.query
const {
  Documents,
  CreateCollection,
  CreateIndex,
  Collection,
  Exists,
  If,
  Index,
  Delete,
  Lambda,
  Paginate,
  Match,
  Var
} = q

/* Collection */

const CreateAccountsCollection = CreateCollection({ name: 'accounts' })

/* Indexes */
const CreateIndexAllAccounts = CreateIndex({
  name: 'all_accounts',
  source: Collection('accounts'),
  // this is the default collection index, no terms or values are provided
  // which means the index will sort by reference and return only the reference.
  serialized: true
})

const CreateIndexAccountsByEmail = CreateIndex({
  name: 'accounts_by_email',
  source: Collection('accounts'),
  // We will search on email
  terms: [
    {
      field: ['data', 'email']
    }
  ],
  // if no values are added, the index will just return the reference.
  // Prevent that accounts with duplicate e-mails are made.
  // uniqueness works on the combination of terms/values
  unique: true,
  serialized: true
})

async function createAccountCollection(client) {
  await client.query(If(Exists(Collection('accounts')), true, CreateAccountsCollection))
  await client.query(If(Exists(Index('accounts_by_email')), true, CreateIndexAccountsByEmail))
  await client.query(If(Exists(Index('all_accounts')), true, CreateIndexAllAccounts))
}

async function deleteAccountsCollection(client) {
  await client.query(If(Exists(Collection('accounts')), true, Delete(Collection('accounts'))))
  await client.query(If(Exists(Index('accounts_by_email')), true, Delete(Index('accounts_by_email'))))
  await client.query(If(Exists(Index('all_accounts')), true, Delete(Delete('all_accounts'))))
}

const DeleteAllAccounts = If(
  Exists(Collection('accounts')),
  q.Map(Paginate(Documents(Collection('accounts'))), Lambda('ref', Delete(Var('ref')))),
  true
)

export { createAccountCollection, deleteAccountsCollection, DeleteAllAccounts }
