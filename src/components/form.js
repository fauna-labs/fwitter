import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import PropTypes from 'prop-types'

const Form = props => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [alias, setAlias] = useState('')

  const handleChangeUserName = event => {
    setUsername(event.target.value)
  }

  const handleChangePassword = event => {
    setPassword(event.target.value)
  }

  const handleChangeName = event => {
    setName(event.target.value)
  }

  const handleChangeAlias = event => {
    setAlias(event.target.value)
  }

  const linkInfo = props.isLogin
    ? { linkText: 'No account yet? Register here!', link: 'register' }
    : { linkText: 'Already have an account? Login here!', link: 'login' }

  return (
    <React.Fragment>
      <div className="account-form-container">
        <form className="account-form" onSubmit={e => props.handleSubmit(e, username, password, alias, name)}>
         {props.isLogin ? null : renderInputField('Name', name, 'text', e => handleChangeName(e))}
          {props.isLogin ? null : renderInputField('Alias', alias, 'text', e => handleChangeAlias(e))}
          {renderInputField('Email', username, 'text', e => handleChangeUserName(e))}
          {renderInputField('Password', password, 'password', e => handleChangePassword(e))}          
          <div className="input-row align-right">
            <Link to={linkInfo.link}> {linkInfo.linkText}</Link>
            <button className={props.isLogin ? 'login' : 'register'}> {props.isLogin ? 'Login' : 'Register'} </button>
          </div>
        </form>
      </div>
    </React.Fragment>
  )
}

const renderInputField = (name, value, type, fun) => {
  const lowerCaseName = name.toLowerCase()
  return (
    <div className="input-row">
      <label htmlFor="{lowerCaseName}" className="input-row-column">{name}</label>
      <input
        className="input-row-column"
        autoComplete={lowerCaseName}
        value={value}
        onChange={fun}
        type={type}
        id={lowerCaseName}
        name={lowerCaseName}
      />
    </div>
  )
}

Form.propTypes = {
  isLogin: PropTypes.bool,
  handleSubmit: PropTypes.func
}

export default Form
