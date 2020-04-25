import React, { useState, useEffect, useContext } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'react-toastify'

import SessionContext from '../context/session'
import Feed from '../components/feed'
import Search from './../components/search'
import Nav from './../components/nav'

import { faunaQueries } from '../fauna/query-manager'
import { safeVerifyError } from '../fauna/helpers/errors'

const UserPage = () => {
  // The userid in the url
  const { authorAlias } = useParams()

  const [state, setState] = useState({
    fweets: [],
    loaded: false,
    error: false
  })

  // Fetch the fweets on first load.
  const sessionContext = useContext(SessionContext)
  const { user } = sessionContext.state

  useEffect(() => {
    if (user) {
      setState({ error: null, fweets: [], loaded: false })
      faunaQueries
        .getFweetsByAuthor(authorAlias)
        .then(result => {
          console.log('fweets', result)
          setState({
            fweets: result,
            loaded: true
          })
        })
        .catch(err => {
          console.log(err)
          const rawError = safeVerifyError(err, ['requestResult', 'responseRaw'])
          if (rawError.includes('Rate limiting')) {
            setState({ error: { message: 'Rate-limiting' }, fweets: [], loaded: true })
            toast.warn('You are reloading too fast')
          } else if (rawError.includes('permission denied')) {
            console.log(err)
            setState({ error: { message: 'Permission denied!' }, fweets: [], loaded: true })
            toast.error('No data permissions')
          } else {
            setState({ error: err, fweets: [], loaded: true })
            toast.error('Unknown error')
          }
        })
    }
  }, [user, authorAlias])

  const update = (fweets, loaded, error) => {
    setState({
      fweets: fweets,
      loaded: loaded,
      error: error
    })
  }

  return (
    <React.Fragment>
      <Nav />
      <div className="fweeter-and-feed-container">
        <div className="feed-title">{'@' + authorAlias}</div>
        <Feed update={update} error={state.error} loaded={state.loaded} fweets={state.fweets} />
      </div>
      {user ? <Search /> : null}
    </React.Fragment>
  )
}

export default UserPage
