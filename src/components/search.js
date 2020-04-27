import React, { useState } from 'react'
import { faunaQueries } from '../fauna/query-manager'
import { toast } from 'react-toastify'
import { safeVerifyError } from '../fauna/helpers/errors'
import { useHistory } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus } from '@fortawesome/free-solid-svg-icons'

const Search = props => {
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const history = useHistory()

  const handleChange = event => {
    const input = event.target.value
    setSearchInput(input)
    faunaQueries
      .searchPeopleAndTags(input)
      .then(result => {
        return setSearchResults(result)
      })
      .catch(err => {
        console.error(err)
        return setSearchResults([{ error: 'Failed to search' }])
      })
  }

  const handleTagClick = (event, searchResult) => {
    history.push(`/tags/${searchResult.name}`)
    event.stopPropagation()
  }

  const handleUserClick = (event, searchResult) => {
    history.push(`/users/${searchResult.alias}`)

    event.stopPropagation()
  }

  const handleFollowUser = (event, searchResult) => {
    console.log('follow user', searchResult)
    faunaQueries
      .follow(searchResult.ref)
      .then(result => {
        console.log('following', result)
        toast.success('following')
      })
      .catch(err => {
        const functionErrorDescription = safeVerifyError(err, [
          'requestResult',
          'responseContent',
          'errors', // The errors of the call
          0,
          'cause', // the underlying cause (the error in the function)
          0,
          'description'
        ])
        if (functionErrorDescription.includes('not unique')) {
          toast.warn('You are already folllowing this author')
        } else {
          toast.error('Unknown error')
        }
      })
    event.stopPropagation()
  }

  function renderResults(searchResults) {
    if (searchResults.length > 0 && !searchResults[0].error) {
      return (
        <React.Fragment>
          <div className="search-results">
            <div className="search-results-title">People</div>
            <div className="search-results-people">{renderUserResults(searchResults.filter(e => e.alias))}</div>
          </div>
          <div className="search-results">
            <div className="search-results-title">Tags</div>
            <div className="search-results-tags">{renderTagResults(searchResults.filter(e => !e.alias))}</div>
          </div>
        </React.Fragment>
      )
    } else {
      return null
    }
  }

  function renderUserResults(searchResults) {
    return searchResults.map(res => {
      const key = 'user-search-result-' + res.name
      return (
        <div key={key} className="search-result" onClick={event => handleUserClick(event, res)}>
          <div className="avatar">
            <img className="avatar-image" src={`/images/${res.icon}.png`} alt="profile" />
          </div>
          <div className="search-result-name-and-alias">
            <div className="name">{res.name}</div>
            <div className="alias">@{res.alias}</div>
          </div>
          <div className="search-result-follow-button" onClick={event => handleFollowUser(event, res)}>
            <button className="icon">
              <FontAwesomeIcon icon={faPlus} />
            </button>
          </div>
        </div>
      )
    })
  }

  function renderTagResults(searchResults) {
    return searchResults.map(res => {
      const key = 'user-search-result-' + res.name
      return (
        <div key={key} className="search-result" onClick={event => handleTagClick(event, res)}>
          <div className="search-result-tag-and-fweets">
            <div className="tag">#{res.name}</div>
          </div>
        </div>
      )
    })
  }

  return (
    <div className="search-and-results-container">
      <div className="search">
        <input
          className="search-input-field"
          type="text"
          id="fsearch"
          name="fsearch"
          placeholder="Search users and tags"
          value={searchInput}
          onChange={handleChange}
        />
      </div>
      {renderResults(searchResults)}
    </div>
  )
}

Search.propTypes = {}

export default Search
