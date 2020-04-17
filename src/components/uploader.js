import React from 'react'
import PropTypes from 'prop-types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage } from '@fortawesome/free-solid-svg-icons'

const Uploader = props => {
  const widget = window.cloudinary.createUploadWidget(
    {
      cloudName: process.env.REACT_APP_LOCAL___CLOUDINARY_CLOUDNAME,
      uploadPreset: process.env.REACT_APP_LOCAL___CLOUDINARY_TEMPLATE,
      styles: {
        palette: {
          window: '#E5E8EB',
          windowBorder: '#4A4A4A',
          tabIcon: '#000000',
          textDark: '#fff',
          textLight: '#FFFFFF',
          link: '#44c767',
          action: '#FF620C',
          inactiveTabIcon: '#4c5d73',
          error: '#F44235',
          inProgress: '#44c767',
          complete: '#20B832',
          sourceBg: '#fff'
        },
        fonts: {
          Roboto: 'https://fonts.googleapis.com/css?family=Roboto'
        }
      }
    },
    (error, result) => {
      if (!error && result && result.event === 'success') {
        props.onPhotosUploaded(result.info)
      } else if (error) {
        console.error(error)
      }
    }
  )

  const handleUploadClick = () => {
    widget.open()
  }

  return (
    <div>
      <FontAwesomeIcon icon={faImage} className="upload-photo" onClick={handleUploadClick}></FontAwesomeIcon>
    </div>
  )
}

Uploader.propTypes = {
  onPhotosUploaded: PropTypes.func
}

export { Uploader }
