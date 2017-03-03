const { Promise, getBody, throwCustomError, handleError } = require('../lib/utils.js')
const Router = require('../lib/rest-server.js').Router
const files = require('./files.js')
const fs = Promise.promisifyAll(require('fs'))
const hat = require('hat')
const crypto = require('crypto')
const filesDb = Promise.promisifyAll(require('../lib/files-db.js'))
const basePath = './files/'


function getHash(text) {
  let shasum = crypto.createHash('sha1') // TODO: try outisde this method?
  shasum.update(text)
  let hash = shasum.digest('hex')
  return hash
}

function getBasicAuthCredentials(req) {
  let auth = req.headers.authorization
  if (!auth || auth.indexOf('Basic ') !== 0)
    throwCustomError(401, `'Authorization' header requires 'Basic <base64 user:pass>'`)
  auth = auth.replace('Basic ', '')
  let authString = new Buffer(auth, 'base64').toString()
  let [name, pass] = authString.split(':')
  return { name, pass }
}

function getUserToken(name) {
  let id = hat()
  let rawTokenString = `${name}:${id}`
  let token = new Buffer(rawTokenString).toString('base64')
  return token
}

function getNameFromToken(token) {
  let rawTokenString = new Buffer(token, 'base64').toString()
  return rawTokenString.split(':')[0]
}

function createUser(name, pass) {
  let token = getUserToken(name)
  pass = getHash(pass)
  return Promise.sequence(
    filesDb.findOneAsync({name}),
    (document) => {
      if (document && document.files != null) {
        throwCustomError(400, `Name is already taken`)
      }
    },
    () => filesDb.insertAsync({ name, pass, token, files: [] }),
    () => fs.mkdirAsync(basePath + name),
    () => token
  )
}

function checkBasicAuth(req) {
  let { name, pass } = getBasicAuthCredentials(req)
  req.session.name = name
  pass = getHash(pass)
  return Promise.sequence(
    filesDb.findOneAsync({name}),
    (document) => {
      if (!document || !document.pass || document.pass !== pass) {
        throwCustomError(401, `Name or pass is invalid`)
      }
      return document
    }
  )
}

function checkBearerAuth(req) {
  if (req.headers.authorization.indexOf('Bearer ') === -1) {
    throwCustomError(400, `'Authorization' header requires 'Bearer <token string>'`)
  }
  let token = req.headers.authorization.replace('Bearer ', '')
  let name = getNameFromToken(token)
  req.session.name = name
  return Promise.sequence(
    filesDb.findOneAsync({name}),
    (document) => {
      if (!document || !document.token || document.token !== token) {
        throwCustomError(401, `Bearer token is invalid`)
      }
      return document
    }
  )
}

function sendNewToken(res, name) {
  let token = getUserToken(name)
  return Promise.sequence(
    () => filesDb.updateAsync({name}, { $set: {token} }),
    () => res.status(201).content(token)
  )
}

const createAuth = (req, res) => Promise.tryCatch(
  Promise.sequence(
    getBody(req),
    (bodyText) => JSON.parse(bodyText),
    (body) => createUser(body.name, body.pass),
    (token) => res.status(201).content(token)
  ),
  (err) => handleError(res, err)
)

const getAuth = (req, res) => Promise.tryCatch(
  Promise.sequence(
    checkBasicAuth(req),
    ({name, token}) => (token)
      ? res.status(200).content(token)
      : sendNewToken(res, name)
  ),
  (err) => handleError(res, err)
)

const refreshAuth = (req, res) => Promise.tryCatch(
  Promise.sequence(
    checkBasicAuth(req),
    ({name}) => sendNewToken(res, name)
  ),
  (err) => handleError(res, err)
)

const revokeAuth = (req, res) => Promise.tryCatch(
  Promise.sequence(
    checkBasicAuth(req),
    ({name}) => filesDb.updateAsync({name}, { $unset: {token:1} }),
    () => res.status(204)
  ),
  (err) => handleError(res, err)
)

const authorizedBaseRequest = (req, res, base) => Promise.sequence(
  checkBearerAuth(req),
  () => base.handler(req, res)
)

const privateFiles = new Router('/private', files)

privateFiles.post('/auth/create', createAuth)
.post('/auth/refresh', refreshAuth)
.get('/auth', getAuth)
.delete('/auth', revokeAuth)
.get('/', authorizedBaseRequest)
.post('/', authorizedBaseRequest)
.put('/', authorizedBaseRequest)
.delete('/', authorizedBaseRequest)

module.exports = privateFiles
