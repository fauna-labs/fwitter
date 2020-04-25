import React, { useContext } from 'react'
import { toast } from 'react-toastify'
import { safeVerifyError } from './../fauna/helpers/errors'
import { faunaQueries } from '../fauna/query-manager'
import SessionContext from './../context/session'
import { useHistory } from 'react-router-dom'

// Components
import Form from './../components/form'

const handleRegister = (event, username, password, alias, name, sessionContext, history) => {
  faunaQueries
    .register(username, password, name, alias)
    .then(e => {
      toast.success('User registered')
      sessionContext.dispatch({ type: 'register', data: e })
      history.push('/')
    })
    .catch(err => {
      const errorCode = safeVerifyError(err, [
        'requestResult',
        'responseContent',
        'errors', // The errors of the call
        0,
        'cause', // the underlying cause (the error in the function)
        0,
        'code'
      ])
      const description = safeVerifyError(err, [
        'requestResult',
        'responseContent',
        'errors', // The errors of the call
        0,
        'cause', // the underlying cause (the error in the function)
        0,
        'description'
      ])
      if (errorCode === 'instance not unique') {
        toast.error('An account with that e-mail already exists')
      } else if (description.includes('Invalid e-mail provided')) {
        toast.error('Invalid e-mail format')
      } else if (description.includes('Invalid password')) {
        toast.error('Invalid password, please provide at least 8 chars')
      } else {
        console.log(err)
        toast.error('Oops, something went wrong')
      }
    })
  event.preventDefault()
}

const Register = () => {
  const history = useHistory()
  const sessionContext = useContext(SessionContext)
  return ( 
    <Form
      isLogin={false}
      handleSubmit={(event, username, password, alias, name) =>
        handleRegister(event, username, password, alias, name, sessionContext, history)
      }
    ></Form>
  )
}

export default Register
