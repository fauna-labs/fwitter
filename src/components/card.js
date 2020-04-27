import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faComments, faHeart, faRetweet } from '@fortawesome/free-solid-svg-icons'
import Asset from './asset'

const Card = props => {
  const [state, setState] = useState(false)

  const [content, setContent] = useState('')

  const icon =
    props.fweetAndMore.user && props.fweetAndMore.user.icon ? props.fweetAndMore.user.icon.toLowerCase() : 'noicon'

  const generateFweetContent = fweetAndMore => {
    // Refweet
    if (fweetAndMore.original) {
      return (
        <React.Fragment>
          <div className="refweet-header">
            <FontAwesomeIcon icon={faRetweet} />
            <span className="fweet-name"> {fweetAndMore.user.name} refweeted</span>
          </div>
          <div className="fweet-card-text">
            <p className="fweet-description"> {fweetAndMore.fweet.message} </p>
          </div>
          <div className="fweet-card-text refweet">
            <div className="fweet-header">
              <span className="fweet-name"> {fweetAndMore.original.user.name} </span>
              <span className="fweet-alias"> @{fweetAndMore.original.user.alias} </span>
            </div>
            <p className="fweet-description"> {fweetAndMore.original.fweet.message} </p>
          </div>
          {fweetAndMore.original.fweet.asset ? <Asset asset={fweetAndMore.original.fweet.asset}></Asset> : null}
        </React.Fragment>
      )
    }
    // Normal fweet
    else {
      return (
        <React.Fragment>
          <div className="fweet-card-text">
            <div className="fweet-header">
              <span className="fweet-name"> {fweetAndMore.user.name} </span>
              <span className="fweet-alias"> @{fweetAndMore.user.alias} </span>
            </div>
            <p className="fweet-description"> {fweetAndMore.fweet.message} </p>
          </div>
          {fweetAndMore.fweet.asset ? <Asset asset={fweetAndMore.fweet.asset}></Asset> : null}
        </React.Fragment>
      )
    }
  }

  const generateComments = fweetAndMore => {
    return fweetAndMore.comments.map((commandAndAuthor, index) => {
      return (
        <div className="comment-container" key={'container_' + commandAndAuthor.comment.ref.toString()}>
          <div className="fweet-comment-bullet"></div>
          <div className="fweet-card-text comment" key={commandAndAuthor.comment.ref.toString()}>
            <div className="fweet-header">
              <span className="fweet-name"> {commandAndAuthor.author.name} </span>
              <span className="fweet-alias"> @{commandAndAuthor.author.alias} </span>
            </div>
            <p className="fweet-description"> {commandAndAuthor.comment.message} </p>
          </div>
        </div>
      )
    })
  }

  const generateFweetActions = () => {
    return (
      <div className="fweet-card-actions">
        <div className="icon" onClick={handleStartCommenting}>
          <FontAwesomeIcon
            className={props.fweetAndMore.fweetstats.comment ? 'highlight-comment' : ''}
            icon={faComments}
          />
          <div className="icon-text"> {props.fweetAndMore.fweet.comments} </div>
        </div>
        <div className="icon" onClick={() => startRefweet(props.handleRefweet)}>
          <FontAwesomeIcon
            className={props.fweetAndMore.fweetstats.refweet ? 'highlight-refweet' : ''}
            icon={faRetweet}
          />
          <div className="icon-text"> {props.fweetAndMore.fweet.refweets} </div>
        </div>
        <div className="icon" onClick={() => props.handleLike(props.fweetAndMore)}>
          <FontAwesomeIcon className={props.fweetAndMore.fweetstats.like ? 'highlight-like' : ''} icon={faHeart} />
          <div className="icon-text"> {props.fweetAndMore.fweet.likes} </div>
        </div>
      </div>
    )
  }

  const startRefweet = () => {
    setState('refweeting')
  }

  const handleStartCommenting = () => {
    setState('commenting')
  }

  const handleChangeInput = event => {
    setContent(event.target.value)
  }

  const generateInputField = () => {
    let placeholder = null
    let handleSubmit = null
    if (state === 'refweeting') {
      handleSubmit = event => {
        event.preventDefault()
        props.handleRefweet(props.fweetAndMore, content)
        setContent('')
        setState(false)
        return false
      }
      placeholder = 'refweet message'
    }
    if (state === 'commenting') {
      handleSubmit = event => {
        event.preventDefault()
        props.handleComment(props.fweetAndMore, content)
        setContent('')
        setState(false)
        return false
      }
      placeholder = 'write your comment'
    }
    if (state) {
      return (
        <form className="fweet-comment-edit" onSubmit={handleSubmit}>
          <input
            className="fweet-comment-input-field"
            type="text"
            id="fname"
            name="fname"
            placeholder={placeholder}
            value={content}
            onChange={handleChangeInput}
          />
        </form>
      )
    }
  }

  return (
    <div className="fweet-card-container">
      <div className="fweet-card">
        <div className="avatar">
          <img className="avatar-image" src={`/images/${icon}.png`} alt="profile" />
        </div>
        <div className="fweet-card-main">
          {generateFweetContent(props.fweetAndMore)}
          {generateFweetActions()}
          {generateInputField()}
        </div>
      </div>

      <div className="fweet-comments">{generateComments(props.fweetAndMore)}</div>
    </div>
  )
}

Card.propTypes = {
  fweetAndMore: PropTypes.object,
  handleLike: PropTypes.func,
  handleRefweet: PropTypes.func,
  handleComment: PropTypes.func
}

export default Card
