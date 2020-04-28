import React, { useState, useEffect, useContext } from 'react'
import Feed from '../components/feed'

import Nav from './../components/nav'
import Search from './../components/search'
import Fweeter from '../components/fweeter'
import { faunaQueries } from '../fauna/query-manager'
import { safeVerifyError } from '../fauna/helpers/errors'
import { toast } from 'react-toastify'
import SessionContext from '../context/session'

const Home = () => {
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
      faunaQueries
        .getFweets()
        .then(result => {
          setState({
            fweets: result,
            loaded: true
          })
        })
        .catch(err => {
          console.log(err)
          const rawError = safeVerifyError(err, ['requestResult', 'responseRaw'])
          if (rawError && rawError.includes('Rate limiting')) {
            setState({ error: { message: 'Rate-limiting' }, fweets: [], loaded: true })
            toast.warn('You are reloading too fast')
          } else if (rawError && rawError.includes('permission denied')) {
            setState({ error: { message: 'Permission denied!' }, fweets: [], loaded: true })
            toast.error('No data permissions')
          } else {
            setState({ error: err, fweets: [], loaded: true })
            toast.error('Unknown error')
          }
        })
    }
  }, [user])

  const handleCreateFweet = (message, asset) => {
    return faunaQueries
      .createFweet(message, asset)
      .then(fweetArray => {
        setState({
          fweets: fweetArray.concat(state.fweets),
          loaded: true
        })
        toast.success('Fweeted')
      })
      .catch(err => {
        const rawError = safeVerifyError(err, ['requestResult', 'responseRaw'])
        if (rawError.includes('Rate limiting')) {
          toast.warn('You are fweeting too fast')
        } else {
          console.error('error on Fweet', err)
          toast.error('Fweet failed')
        }
      })
  }

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
      <div className="main-column">
        {user ? <Fweeter handleCreateFweet={handleCreateFweet}></Fweeter> : null}
        <Feed update={update} error={state.error} loaded={state.loaded} fweets={state.fweets} />
      </div>
      {user ? <Search /> : null}
    </React.Fragment>
  )
}

export default Home
