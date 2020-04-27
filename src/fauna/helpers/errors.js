const handlePromiseError = (promise, entity) => {
  return promise
    .then(data => {
      console.log(`   [ Query Success ] '${entity}'`)
      return data
    })
    .catch(error => {
      if (error && error.message === 'instance already exists') {
        console.warn(`   [ Query Skipped ] '${entity}', it already exists`)
      } else {
        console.error(`   [ Query Failed  ] '${entity}', with error:`, error)
      }
    })
}

const wrapPromiseError = (promise, entity) => {
  return promise
    .then(data => {
      return [null, data]
    })
    .catch(error => {
      return [error, null]
    })
}

const handleSetupError = (promise, entity) => {
  return promise
    .then(data => {
      console.log(`   [ Executed ] '${entity}'`)
      return data
    })
    .catch(error => {
      if (error && error.message === 'instance already exists') {
        console.warn(`   [ Skipped ] '${entity}', it already exists`)
      } else {
        console.error(`   [ Failed  ] '${entity}', with error:`, error)
      }
    })
}

const safeVerifyError = (error, keys) => {
  if (keys.length > 0) {
    if (error && error[keys[0]]) {
      const newError = error[keys[0]]
      keys.shift()
      return safeVerifyError(newError, keys)
    } else {
      return false
    }
  }
  return error
}
export { handlePromiseError, wrapPromiseError, handleSetupError, safeVerifyError }
