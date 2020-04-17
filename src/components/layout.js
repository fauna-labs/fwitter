import React from 'react'
import PropTypes from 'prop-types'
import { ToastContainer, toast } from 'react-toastify'

const Layout = props => {
  return (
    <div className="page">
      <ToastContainer position={toast.POSITION.BOTTOM_RIGHT} />
      <link
        href="https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700&display=swap"
        rel="stylesheet"
      ></link>
      <div className="body-container">{props.children}</div>
    </div>
  )
}

Layout.propTypes = {
  children: PropTypes.node
}

export default Layout
