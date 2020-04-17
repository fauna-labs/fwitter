// Fauna typically returns objects that look like:
// {
//   ref: ..
//   ts: ...
//   data: {..}
// }
// We will never use a ref or ts key in our data so we'll just flatten it to work more easily.

function flattenDataKeys(obj) {
  if (Array.isArray(obj)) {
    return obj.map(e => flattenDataKeys(e))
  } else if (typeof obj === 'object') {
    // the case where we have just data pointing to an array.
    if (Object.keys(obj).length === 1 && obj.data && Array.isArray(obj.data)) {
      return flattenDataKeys(obj.data)
    } else {
      Object.keys(obj).forEach(k => {
        if (k === 'data') {
          const d = obj[k]
          delete obj.data

          Object.keys(d).forEach(dataKey => {
            obj[dataKey] = flattenDataKeys(d[dataKey])
          })
        } else {
          obj[k] = flattenDataKeys(obj[k])
        }
      })
    }
    return obj
  } else {
    return obj
  }
}

function isFunction(functionToCheck) {
  return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]'
}

export { flattenDataKeys, isFunction }
