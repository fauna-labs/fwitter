/*
 * Ideally we limit the amount of calls that come to Login.
 */
const faunadb = require('faunadb')
const q = faunadb.query
const {
  If,
  Epoch,
  Match,
  Index,
  Update,
  Collection,
  Let,
  Var,
  Paginate,
  Select,
  TimeDiff,
  Or,
  GTE,
  Abort,
  Create,
  IsEmpty,
  Count,
  LT,
  Do,
  Now,
  And,
  Not,
  Equals
} = q

const rateLimitingConfig = {
  get_fweets: {
    calls: 5,
    perSeconds: 60 * 1000
  },
  get_fweets_by_tag: {
    calls: 5,
    perSeconds: 60 * 1000
  },
  get_fweets_by_author: {
    calls: 5,
    perSeconds: 60 * 1000
  },
  create_fweet: {
    calls: 5,
    perSeconds: 300 * 1000 // one fweet a minute please (5 per 5 minutes)
  },
  login: {
    calls: 3, // login will be reset by a succesful login.
    perSeconds: 0
  },
  // A global register limit to protect against bots creating many users
  register: {
    calls: 10, // 10 users per 10 minutes
    perSeconds: 10 * 1000
  }
}

const getRateLimitingConf = action => {
  const conf = rateLimitingConfig[action]
  if (conf) {
    return conf
  } else {
    throw new Error(`No rate limiting configuration defined (or passed) for ${action}
     Either define it in the config or pass it to the AddRateLimiting function`)
  }
}

// This function shows that you can add complex logic within FQL without a problem and
// Completely abstract it away. For example here we are adding Rate limiting by wrapping it around any other
// FQL function that we pass in. FQL is a powerful programming language.

function AddRateLimiting(action, FqlQueryToExecute, Identifier, calls, perSeconds) {
  let conf = {}
  if (typeof calls !== 'undefined' && typeof perSeconds !== 'undefined') {
    conf.calls = calls
    conf.perSeconds = perSeconds
  } else {
    conf = getRateLimitingConf(action)
  }

  return Let(
    { rateLimitingPage: Paginate(Match(Index('rate_limiting_by_action_and_identity'), action, Identifier)) },
    If(
      // Check whether there is a value
      IsEmpty(Var('rateLimitingPage')),
      // THEN: we store the initial data. Since our collection has a Time To Live set to one day.
      // older data will be automatically reclaimed (e.g. users that don't use the application anymore)
      Do(
        Create(Collection('rate_limiting'), {
          data: {
            action: action,
            identity: Identifier
          }
        }),
        FqlQueryToExecute
      ),
      // ELSE: we actually retrieve a page of the last X events for this rate limiting entry, take the first (the oldest of this page)
      // and verify whether they are long enough ago to allow another call.
      VerifyRateLimitingAndUpdate(action, conf.calls, conf.perSeconds, FqlQueryToExecute, Identifier)
    )
  )
}

function VerifyRateLimitingAndUpdate(action, numberOfEvents, maxAgeInMs, FqlQueryToExecute, Identifier) {
  return Let(
    // We split up the calculation for educational purposes. First we get the first X events of the ratelimiting entry in reverse order (before: null does that)
    {
      eventsPage: Paginate(q.Events(Select(['data', 0], Var('rateLimitingPage'))), {
        size: numberOfEvents,
        before: null
      }),
      page: Select(['data'], Var('eventsPage')),
      // then we retrieve the first element of that page. If X would be 3, it would be the 3th oldest event
      firstEventOfPage: Select([0], Var('page')),
      // then we get the timestamp of the event
      timestamp: Select(['ts'], Var('firstEventOfPage')),
      // transform the Fauna timestamp to a Time object
      time: Epoch(Var('timestamp'), 'microseconds'),
      // How long ago was that event in ms
      ageInMs: TimeDiff(Var('time'), Now(), 'milliseconds')
    },
    If(
      // if there are  'numberOfEvents' timestamps in the page, take the first of the page and see if it is old enough
      // If maxAgeInMs is 0 we don't care about the time, something in the FqlQueryToExecute will reset
      // delete the rate-limiting events in order to reset (e.g. useful for max 3 faulty logins).
      Or(LT(Count(Var('page')), numberOfEvents), And(Not(Equals(0, maxAgeInMs)), GTE(Var('ageInMs'), maxAgeInMs))),
      // Then great we update
      Do(
        Update(Select(['document'], Var('firstEventOfPage')), {
          data: {
            action: action,
            identity: Identifier
          }
        }),
        FqlQueryToExecute
      ),
      // Else.. Abort! Rate-limiting in action
      Abort('Rate limiting exceeded for this user/action')
    )
  )
}

export { AddRateLimiting }
