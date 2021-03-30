import React, { useContext, useEffect } from 'react'
import { useHistory } from 'react-router-dom'
import { toast } from 'react-toastify'

import SessionContext from './../context/session'
import { faunaQueries } from '../fauna/query-manager'
import { safeVerifyError } from '../fauna/helpers/errors'

// Components
import Form from '../components/form'

const handleLogin = (event, username, password, history, sessionContext) => {
  faunaQueries
    .login(username, password)
    .then(e => {
      if (e === false) {
        toast.error('Login failed')
      } else {
        toast.success('Login successful')
        sessionContext.dispatch({ type: 'login', data: e })
        history.push('/')
      }
    })
    .catch(err => {
      const underlyingError = safeVerifyError(err, [
        'requestResult',
        'responseContent',
        'errors',
        0,
        'cause',
        0,
        'description'
      ])
      console.log(err)
      if (underlyingError && underlyingError.includes('Rate limiting')) {
        toast.warn('Too many attempts, account blocked')
      } else if (err.message === 'permission denied') {
        toast.error(
          'No permission, did you run the setup script and set your key in env.local as it tells you to? (remember to restart the frontend)'
        )
      } else {
        console.error('error on login', err)
        toast.error('Login failed')
      }
    })
  event.preventDefault()
}

const Login = props => {
  const history = useHistory()
  const sessionContext = useContext(SessionContext)

  useEffect(() => {
    // For debugging, autologin to get in faster for testing, add a user and pword in the .env.local
    const { user } = sessionContext.state
    if (
      !user &&
      process.env.REACT_APP_LOCAL___DEBUG_AUTO_LOGIN_USER &&
      process.env.REACT_APP_LOCAL___DEBUG_AUTO_LOGIN_PWORD
    ) {
      faunaQueries
        .login(
          process.env.REACT_APP_LOCAL___DEBUG_AUTO_LOGIN_USER,
          process.env.REACT_APP_LOCAL___DEBUG_AUTO_LOGIN_PWORD
        )
        .then(e => {
          if (e === false) {
            toast.error('Login failed')
          } else {
            toast.success('Login successful')
            sessionContext.dispatch({ type: 'login', data: e })
            history.push('/')
          }
        })
        .catch(err => {
          console.log('auto login failed', err)
        })
    }
  }, [history, sessionContext])

  return (
    <Form
      isLogin={true}
      handleSubmit={(event, username, password) => handleLogin(event, username, password, history, sessionContext)}
    ></Form>
  )
}

export default Login
