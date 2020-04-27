import React, { useContext } from 'react'
import { toast } from 'react-toastify'
import { Link } from 'react-router-dom'
import SessionContext from './../context/session'
import { faunaQueries } from '../fauna/query-manager'
import { isFunction } from '../fauna/helpers/util'

const renderLogo = sessionContext => {
  return (
    <div key="link_logo" className="fauna-logo">
      <Link className="logo-container" to="/">
        <img alt="Fauna logo" src="/images/logo-fauna-white.svg" />
      </Link>
    </div>
  )
}

const renderLoginLink = sessionContext => {
  const { user } = sessionContext.state
  if (user) {
    return renderLink({ handleClick: handleLogout, label: 'Logout' }, sessionContext)
  } else {
    return renderLink({ href: '/accounts/login', label: 'Login' }, sessionContext)
  }
}

const renderProtectedLink = (sessionContext, linkData) => {
  if (sessionContext.state && sessionContext.state.user) {
    return renderLink(linkData, sessionContext)
  } else {
    return null
  }
}

const handleLogout = (event, sessionContext) => {
  return faunaQueries.logout().then(() => {
    toast.success('Logged out')
    sessionContext.dispatch({ type: 'logout', data: null })
    event.preventDefault()
  })
}
const links = [
  renderLogo,
  s => renderProtectedLink(s, { href: '/', label: 'Home' }),
  // Who knows, these features might be next.
  // s => renderProtectedLink(s, { href: '/', label: 'Topics' }),
  // s => renderProtectedLink(s, { href: '/', label: 'Messages' }),
  // s => renderProtectedLink(s, { href: '/', label: 'Profile' }),
  renderLoginLink
]

const renderLink = (link, sessionContext) => {
  if (link.handleClick) {
    return (
      <li onClick={event => handleLogout(event, sessionContext)} key={`nav-link-${link.label}`}>
        <Link key={'link_' + link.label}>{link.label}</Link>
      </li>
    )
  } else {
    return (
      <li key={`nav-link-${link.href}-${link.label}`}>
        <Link key={'link_' + link.label} to={link.href}>
          {link.label}
        </Link>
      </li>
    )
  }
}

const Nav = () => {
  const sessionContext = useContext(SessionContext)

  return (
    <nav className={links.length === 0 ? 'nav-hidden' : 'nav-shown'}>
      <ul>
        {links.map(link => {
          if (isFunction(link)) {
            return link(sessionContext)
          } else {
            return null
          }
        })}
      </ul>
    </nav>
  )
}

export default Nav
