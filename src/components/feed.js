import React, { useContext } from 'react'
import PropTypes from 'prop-types'
import { toast } from 'react-toastify'

import SessionContext from '../context/session'
import Card from '../components/card'
import { safeVerifyError } from '../fauna/helpers/errors'
import { faunaQueries } from '../fauna/query-manager'

const Feed = props => {
  const sessionContext = useContext(SessionContext)
  const { user } = sessionContext.state

  const generateFweetsOrUserFeedback = (fweets, error, loaded, user) => {
    // Unexpected error
    if (error) {
      return generateUserError(error)
    }
    // We are not logged in yet
    else if (!user) {
      return generateNotLoggedIn(fweets)
    } else if (!loaded) {
      return generateLoading()
    }
    // We received an empty list of profiles (e.g. they are all private or our filtering is too aggressive)
    else if (fweets && fweets.length === 0) {
      return generateNotFound()
    }
    // Or we just received profiles
    else {
      return generateFweets(fweets)
    }
  }

  const generateLoading = () => {
    return (
      <div className="no-results-container">
        <p className="no-results-text"></p>
        <img className="no-results-image" src="/images/dino-loading.gif" alt="no results" />
        <p className="no-results-subtext">Loading... ...</p>
      </div>
    )
  }

  const generateUserError = error => {
    console.log('User Error', error)
    return (
      <div className="no-results-container">
        <p className="no-results-text">400</p>
        <img className="no-results-image" src="/images/dino-error.png" alt="no results" />
        <p className="no-results-subtext">{error.message}</p>
      </div>
    )
  }

  const generateNotLoggedIn = () => {
    return (
      <div className="no-results-container">
        <p className="no-results-text">Hi anonymous</p>
        <img className="no-results-image" src="/images/dino-notloggedin.png" alt="no results" />
        <p className="no-results-subtext">You should log in first</p>
      </div>
    )
  }

  const generateNotFound = () => {
    return (
      <div className="no-results-container">
        <p className="no-results-text">No Results Found</p>
        <img className="no-results-image" src="/images/dino-noresults.png" alt="no results" />
        <p className="no-results-subtext">You should be the very first to fweet</p>
      </div>
    )
  }

  const generateFweets = fweetsAndMore => {
    return fweetsAndMore.map((fweetAndMore, index) => {
      return (
        <Card
          key={'fweet_' + fweetAndMore.fweet.ref.toString()}
          fweetAndMore={fweetAndMore}
          handleLike={handleLike}
          handleRefweet={handleRefweet}
          handleComment={handleComment}
        ></Card>
      )
    })
  }

  const handleLike = fweetAndUser => {
    // we only need to pass the user, the liker can be identified with the FaunaDB Identity() function.
    // Trying to make any other user like a fweet should be blocked via security rules.
    // In this application we will use an ABAC rule to do that. You could also opt to
    // group this logic in a UDF function to make sure that the user can't do anything else.
    faunaQueries
      .likeFweet(fweetAndUser.fweet.ref)
      .then(res => {
        if (res.length > 0) {
          // immutably changing fweets
          const newFweet = res[0]
          props.update(
            props.fweets.map(el => (el.fweet.ref === fweetAndUser.fweet.ref ? newFweet : el)),
            true
          )
        } else {
          toast.error('Something went wrong')
        }
      })
      .catch(err => {
        console.error(err)
        toast.error('Something went wrong')
      })
  }

  const handleRefweet = (fweetAndUser, message) => {
    faunaQueries
      .refweet(fweetAndUser.fweet.ref, message)
      .then(refweetAndOriginalUpdated => {
        const newFweets = [refweetAndOriginalUpdated.refweet].concat(props.fweets)
        const originalIndex = newFweets.findIndex(el => el.fweet.ref.toString() === fweetAndUser.fweet.ref.toString())
        newFweets[originalIndex] = refweetAndOriginalUpdated.original

        props.update(newFweets, true)
        toast.success('Fweeted')
      })
      .catch(err => {
        // Since Refweet is handled by the function, both the function call
        // as the content of the function can result in an error, therefore the error
        // is tucked away a bit more than usual.
        const functionErrorDescription = safeVerifyError(err, [
          'requestResult',
          'responseContent',
          'errors', // The errors of the call
          0,
          'cause', // the underlying cause (the error in the function)
          0,
          'description'
        ])
        if (functionErrorDescription === 'already refweeted') {
          toast.error('Already refweeted')
        } else {
          toast.error('Refweet failed')
        }
      })
  }

  const handleComment = (fweetAndUser, message) => {
    faunaQueries
      .comment(fweetAndUser.fweet.ref, message)
      .then(fweetUpdated => {
        console.log('comment res', fweetUpdated)
        const fweetUpdatedIndex = props.fweets.findIndex(
          el => el.fweet.ref.toString() === fweetAndUser.fweet.ref.toString()
        )
        const newFweets = props.fweets.slice()
        newFweets[fweetUpdatedIndex] = fweetUpdated
        props.update(newFweets, true)
        toast.success('Fweeted')
      })
      .catch(err => {
        console.error('error on Comment', err)
        toast.error('Comment failed')
      })
  }

  // Return the header and either show an error or render the loaded fweets.
  return (
    <main className="body-content">
      <div className="fweets">{generateFweetsOrUserFeedback(props.fweets, props.error, props.loaded, user)}</div>
    </main>
  )
}

Feed.propTypes = {
  title: PropTypes.string,
  fweets: PropTypes.array,
  error: PropTypes.any,
  loaded: PropTypes.bool,
  update: PropTypes.func
}

export default Feed
