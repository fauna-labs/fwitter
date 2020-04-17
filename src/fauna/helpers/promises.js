// Just a small helper to run promises in serial fassion

const serial = (...funcs) =>
  funcs.reduce(
    (promise, func) => promise.then(result => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([])
  )

export { serial }
