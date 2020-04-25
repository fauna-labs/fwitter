import React, { useEffect } from 'react'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'

import Home from './pages/home'
import Login from './pages/login'
import User from './pages/user'
import Tag from './pages/tag'
import Register from './pages/register'
import Layout from './components/layout'
import { SessionProvider, sessionReducer } from './context/session'

const App = () => {
  const [state, dispatch] = React.useReducer(sessionReducer, { user: null })

  const loadScript = url => {
    const script = document.createElement('script')
    script.async = true
    script.src = url
    document.head.appendChild(script)
  }

  useEffect(() => {
    // Load all cloudinary scripts
    loadScript('https://widget.cloudinary.com/v2.0/global/all.js')
  }, [])

  // Return the header and either show an error or render the loaded profiles.
  return (
    <React.Fragment>
      <Router>
        <SessionProvider value={{ state, dispatch }}>
          <Layout>
            <Switch>
              <Route exact path="/accounts/login">
                <Login />
              </Route>
              <Route exact path="/accounts/register">
                <Register />
              </Route>
              <Route path="/users/:authorAlias" component={User} />
              <Route path="/tags/:tag" component={Tag} />
              <Route path="/">
                <Home />
              </Route>
            </Switch>
          </Layout>
        </SessionProvider>
      </Router>
    </React.Fragment>
  )
}

export default App
