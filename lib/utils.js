const Promise = require('bluebird')

Promise.sequence = function sequence(...fns) {
  let context = {}
  let result
  for (let fn of fns) {
    if (!result && fn.then) result = fn.bind(context)
    else if (!result && !fn.then) result = fn.call(context)
    else if (result && !fn.then) result = Promise.resolve(result).then(fn.bind(context))
    else result = result.then(fn.bind(context))
  }
  return result
}

Promise.tryCatch = function tryCatch(tryFn, catchFn) {
  return tryFn.catch(catchFn)
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let data = '', chunk

    req.on('readable', () => {
      while ((chunk = req.read()) != null) {
        data += chunk
      }
    })

    req.on('error', (err) => reject(err))
    req.on('end', () => resolve(data))
  })
}

function throwCustomError(status, message) {
  let err = new Error(message)
  err.code = 'CUSTOM'
  err.statusCode = status
  throw err
}

function handleError(res, err) {
  if (err.code === 'ENOENT') {
    return res.status(404).content(`Document doesn't exist, use "POST" to create it`)
  } else if (err.code === 'CUSTOM') {
    return res.status(err.statusCode).content(err.message)
  } else throw err
}

module.exports = {
  Promise,
  getBody,
  throwCustomError,
  handleError
}
