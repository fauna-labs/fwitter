import React, { useState, useEffect, useContext } from 'react'

import SessionContext from './../context/session'
import Search from './../components/search'
import Nav from './../components/nav'
import { faunaQueries } from '../fauna/query-manager'
import { toast } from 'react-toastify'

// Components

const Profile = props => {
  const sessionContext = useContext(SessionContext)
  const { user } = sessionContext.state

  const [alias, setAlias] = useState(user ? user.alias : '')
  const [name, setName] = useState(user ? user.name : '')

  const handleEditProfile = event => {
    console.log('editing profile', name, alias)
    faunaQueries
      .updateUser(name, alias)
      .then(res => {
        toast.success('Profile updated')
      })
      .catch(err => {
        console.log(err)
        toast.error('Profile update failed')
      })
    event.preventDefault()
  }

  const handleChangeAlias = event => {
    setAlias(event.target.value)
  }

  const handleChangeName = event => {
    setName(event.target.value)
  }

  // Just for debugging to get in quickly
  useEffect(() => {
    // For debugging, autologin to get in faster for testing, add a user and pword in the .env.local
  }, [])

  return (
    <React.Fragment>
      <Nav />
      <div className="main-column">
        <div className="main-title">Profile</div>

        <form className="account-form" onSubmit={handleEditProfile}>
          <div className="input-row">
            <label htmlFor="{lowerCaseName}" className="input-row-column">
              Handle
            </label>
            <input className="input-row-column" value={alias} onChange={handleChangeAlias} type="text" />
          </div>
          <div className="input-row">
            <label htmlFor="{lowerCaseName}" className="input-row-column">
              Name
            </label>
            <input className="input-row-column" value={name} onChange={handleChangeName} type="text" />
          </div>
          <div className="input-row align-right">
            <button> Update </button>
          </div>
        </form>
      </div>
      {user ? <Search /> : null}
    </React.Fragment>
  )
}

export default Profile
