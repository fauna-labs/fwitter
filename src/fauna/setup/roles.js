const faunadb = require('faunadb')
const q = faunadb.query
const {
  Select,
  Indexes,
  Collections,
  CreateRole,
  Paginate,
  Roles,
  Role,
  Lambda,
  Delete,
  Var,
  Collection,
  Index,
  If,
  Exists,
  Update,
  Union,
  Query,
  Let,
  Identity,
  Equals,
  Get
} = q

// A convenience function to either create or update a role.
function CreateOrUpdateRole(obj) {
  return If(
    Exists(Role(obj.name)),
    Update(Role(obj.name), { membership: obj.membership, privileges: obj.privileges }),
    CreateRole(obj)
  )
}

// This role.. can't do anything. It's used as an example in the tests
const CreatePowerlessRole = CreateOrUpdateRole({
  name: 'powerless',
  privileges: []
})

// When a user first arrives to the application, he should only be able to create a new account (register UDF) and login with a given account (login UDF)
// This role will be used to generate a key to bootstrap this process.
const CreateBootstrapRole = CreateOrUpdateRole({
  name: 'keyrole_calludfs',
  privileges: [
    {
      resource: q.Function('login'),
      actions: {
        call: true
      }
    },
    {
      resource: q.Function('register'),
      actions: {
        call: true
      }
    },
    {
      resource: q.Function('register_with_user'),
      actions: {
        call: true
      }
    }
  ]
})

const CreateBootstrapRoleSimple = CreateOrUpdateRole({
  name: 'keyrole_calludfs',
  privileges: [
    {
      resource: q.Function('login'),
      actions: {
        call: true
      }
    },
    {
      resource: q.Function('register'),
      actions: {
        call: true
      }
    }
  ]
})

// The register function only needs to be able to create accounts.
const CreateFnRoleRegister = CreateOrUpdateRole({
  name: 'functionrole_register',
  privileges: [
    {
      resource: Collection('accounts'),
      actions: { create: true } // write is to update, create to create new instances
    },
    {
      resource: Collection('rate_limiting'),
      actions: { read: true, write: true, create: true }
    },
    {
      resource: Index('rate_limiting_by_action_and_identity'),
      actions: { read: true }
    }
  ]
})

// The register function which creates users immediately
// also needs to be able to create users.
const CreateFnRoleRegisterWithUser = CreateOrUpdateRole({
  name: 'functionrole_register_with_user',
  privileges: [
    {
      resource: Collection('accounts'),
      actions: { create: true, read: true } // write is to update, create to create new instances
    },
    {
      resource: Collection('users'),
      actions: { create: true }
    },
    {
      resource: Collection('rate_limiting'),
      actions: { read: true, write: true, create: true, history_read: true, delete: true }
    },
    // We will immediately follow ourselves when we create our own user
    // in order to get our own fweets in our feed.
    {
      resource: Collection('followerstats'),
      actions: { create: true, read: true }
    },
    {
      resource: Index('rate_limiting_by_action_and_identity'),
      actions: { read: true }
    }
  ]
})

// The login function only needs to be able to Login into accounts with the 'Login' FQL function.
// That FQL function requires a reference and we will get the account reference with an index.
// Therefore it needs read access to the 'accounts_by_email' index. Afterwards it will return the
// account so the frontend has the email of the user so we also need read access to the 'accounts' collection
const CreateFnRoleLogin = CreateOrUpdateRole({
  name: 'functionrole_login',
  privileges: [
    {
      resource: Index('accounts_by_email'),
      actions: { read: true }
    },
    {
      resource: Collection('accounts'),
      actions: { read: true }
    },
    {
      resource: Collection('users'),
      actions: { read: true }
    },
    {
      resource: Collection('rate_limiting'),
      actions: { write: true, history_read: true, create: true, read: true, delete: true }
    },
    {
      resource: Index('rate_limiting_by_action_and_identity'),
      actions: { read: true }
    },
    {
      resource: Collection('users'),
      actions: { read: true }
    }
  ]
})

// In case you don't need rate limiting
const CreateFnRoleLoginWithoutRateLimiting = CreateOrUpdateRole({
  name: 'functionrole_login',
  privileges: [
    {
      resource: Index('accounts_by_email'),
      actions: { read: true }
    },
    {
      resource: Collection('accounts'),
      actions: { read: true }
    }
  ]
})

const CreateFnRoleRegisterWithoutRateLimiting = CreateOrUpdateRole({
  name: 'functionrole_register',
  privileges: [
    {
      resource: Collection('accounts'),
      actions: { create: true } // write is to update, create to create new instances
    }
  ]
})

const CreateLoggedInRole = CreateOrUpdateRole({
  name: 'membershiprole_loggedin',
  membership: [{ resource: Collection('accounts') }],
  privileges: [
    // these are all the User Defined Functions
    // that a logged in user can call. All our manipulations
    // are encapsulated in User Defined Functions which makes it easier
    // to limit what data and how a user can adapt data.
    {
      resource: q.Function('create_fweet'),
      actions: {
        call: true
      }
    },
    {
      resource: q.Function('like_fweet'),
      actions: {
        call: true
      }
    },
    {
      resource: q.Function('refweet'),
      actions: {
        call: true
      }
    },
    {
      resource: q.Function('comment'),
      actions: {
        call: true
      }
    },
    {
      resource: q.Function('get_fweets'),
      actions: {
        call: true
      }
    },
    {
      resource: q.Function('get_fweets_by_tag'),
      actions: {
        call: true
      }
    },
    {
      resource: q.Function('get_fweets_by_author'),
      actions: {
        call: true
      }
    },
    {
      resource: q.Function('follow'),
      actions: {
        call: true
      }
    },
    {
      // ------ To search -------
      resource: Index('hashtags_and_users_by_wordparts'),
      actions: { read: true }
    },
    {
      resource: Collection('users'),
      actions: { read: true }
    },
    {
      resource: Collection('hashtags'),
      actions: { read: true }
    },
    // ------To Update profiles -------
    // Updating profiles was deliberately done via roles as an example
    // But could just as well be placed in a UDF and rely on Identity()
    {
      // First we will get the users via the account so we need to be able
      // to get the account (which we will get via Identity())
      resource: Collection('accounts'),
      actions: {
        // A read privilege function receives the reference that is to be read!
        read: Query(Lambda('ref', Equals(Identity(), Var('ref'))))
      }
    },
    {
      resource: Collection('users'),
      actions: {
        // Write only allows updates, not the creation of users.
        // When we insert a function in the write privilege we receive the actual objects
        // instead of the references. We receive both old as new data which we can use in the role to
        // validate whether the user is allowed to update it.
        write: Query(
          Lambda(
            ['oldData', 'newData', 'ref'],
            // If the reference we try to update is the same user
            // that belongs to the account that does this call, we let it through!
            Let(
              {
                // the reference of the user that tries to access
                // (retrieved via the account ref that comes out of Identity())
                loggedInUserRef: Select(['data', 'user'], Get(Identity()))
              },
              Equals(Var('loggedInUserRef'), Var('ref'))
            )
          )
        )
      }
    }
  ]
})

const CreateFnRoleManipulateFweet = CreateOrUpdateRole({
  name: 'functionrole_manipulate_fweets',
  privileges: [
    /** *********************** WRITE AND UPDATE PRIVILEGES *************************/
    // Of course the function needs to update a fweet
    {
      resource: Collection('fweets'),
      actions: { create: true, write: true }
    },
    // But it also needs to read and update rate limiting stats.
    {
      resource: Collection('rate_limiting'),
      actions: { write: true, history_read: true, create: true }
    },
    {
      resource: Collection('comments'),
      actions: { write: true, create: true }
    },
    // On returning the created fweet, we add the stats (even if there are non yet)
    {
      resource: Collection('fweetstats'),
      actions: { write: true, create: true }
    },
    {
      resource: Collection('hashtags'),
      actions: { create: true }
    },
    {
      resource: Collection('followerstats'),
      actions: { write: true, create: true }
    },
    /** *********************** READ PRIVILEGES *************************/
    {
      resource: Collection('fweets'),
      actions: { read: true }
    },
    {
      resource: Index('all_fweets'),
      actions: { read: true }
    },
    {
      resource: Collection('fweetstats'),
      actions: { read: true }
    },
    {
      resource: Index('fweetstats_by_user_and_fweet'),
      actions: { read: true }
    },
    {
      resource: Collection('comments'),
      // Logged in users can read comments
      actions: { read: true }
    },
    {
      resource: Index('comments_by_fweet_ordered'),
      actions: { read: true }
    },
    {
      resource: Index('rate_limiting_by_action_and_identity'),
      actions: { read: true }
    },
    // We fetch accounts and user to return these together with the fweet.
    {
      resource: Collection('accounts'),
      actions: { read: true }
    },
    {
      resource: Collection('users'),
      actions: { read: true }
    },
    {
      resource: Collection('comments'),
      actions: { read: true }
    },
    {
      resource: Collection('rate_limiting'),
      actions: { read: true }
    },
    {
      // To search
      resource: Index('hashtags_and_users_by_wordparts'),
      actions: { read: true }
    },
    {
      // To check whether a hashtag already exists
      resource: Index('hashtags_by_name'),
      actions: { read: true }
    },
    {
      resource: Collection('users'),
      actions: { read: true }
    },
    {
      resource: Collection('hashtags'),
      actions: { read: true }
    },
    {
      resource: Collection('followerstats'),
      actions: { read: true }
    },
    {
      resource: Index('followerstats_by_author_and_follower'),
      actions: { read: true }
    },
    {
      resource: Index('followerstats_by_user_popularity'),
      actions: { read: true }
    },
    {
      resource: Index('fweets_by_author'),
      actions: { read: true }
    },
    {
      resource: Index('fweets_by_tag'),
      actions: { read: true }
    },
    {
      resource: Index('users_by_alias'),
      actions: { read: true }
    }
  ]
})

const CreateAllMightyRole = CreateOrUpdateRole({
  name: 'membershiprole_loggedinallmighty',
  membership: [{ resource: Collection('accounts') }],
  // Whatever indexes/collection that exist, give the account access.
  // !! This is a convience for tests only, do not add this role to a running application.
  privileges: Union(
    Select(
      ['data'],
      q.Map(
        Paginate(Collections()),
        Lambda('c', {
          resource: Var('c'),
          actions: {
            read: true,
            write: true,
            create: true,
            delete: true,
            history_read: true,
            history_write: true,
            unrestricted_read: true
          }
        })
      )
    ),
    Select(
      ['data'],
      q.Map(
        Paginate(Indexes()),
        Lambda('c', {
          resource: Var('c'),
          actions: {
            read: true,
            unrestricted_read: true
          }
        })
      )
    )
  )
})

const DeleteAllRoles = q.Map(Paginate(Roles()), Lambda('ref', Delete(Var('ref'))))

export {
  CreateBootstrapRole,
  CreateBootstrapRoleSimple,
  CreatePowerlessRole,
  CreateFnRoleRegister,
  CreateFnRoleRegisterWithoutRateLimiting,
  CreateFnRoleLogin,
  CreateFnRoleLoginWithoutRateLimiting,
  DeleteAllRoles,
  CreateLoggedInRole,
  CreateAllMightyRole,
  CreateFnRoleRegisterWithUser,
  CreateFnRoleManipulateFweet
}
