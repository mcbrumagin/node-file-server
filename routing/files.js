const { Promise, throwCustomError, handleError } = require('../lib/utils.js')
const { Router } = require('../lib/rest-server.js')
const fs = Promise.promisifyAll(require('fs'))
const filesDb = Promise.promisifyAll(require('../lib/files-db.js'))
const basePath = './files/'

function validateRequest(req) {
  if (!req.params.file)
    throwCustomError(400, `Missing 'file' parameter`)
  if (req.params.file.indexOf('../') > -1)
    throwCustomError(400, `Invalid file name`)
}

function getNameAndPath(req) {
  let name = req.session.name
  if (!name) name = 'public'
  let path = basePath + name + '/' + req.params.file
  return { name, path }
}

function createFile(req, res) {
  validateRequest(req)
  let { name, path } = getNameAndPath(req)
  return Promise.tryCatch(
    Promise.sequence(
      () => filesDb.createFile(req, name, path),
      () => res.status(201).content('Created')
    ),
    (err) => handleError(res, err)
  )
}


function readFile(req, res) {
  validateRequest(req)
  let { name, path } = getNameAndPath(req)
  return Promise.tryCatch(
    Promise.sequence(
      () => fs.statAsync(path),
      ({size}) => {
        res.status(200).headers({ 'Content-Length': size })
        fs.createReadStream(path).pipe(res.handler)
        // TODO Test return res
      }
    ),
    (err) => handleError(res, err)
  )
}

function updateFile(req, res) {
  validateRequest(req)
  let { name, path } = getNameAndPath(req)
  return Promise.tryCatch(
    Promise.sequence(
      () => filesDb.updateFile(req, name, path),
      () => res.status(201).content('Updated')
    ),
    (err) => handleError(res, err)
  )
}

function deleteFile(req, res) {
  validateRequest(req)
  let { name, path } = getNameAndPath(req)
  return Promise.tryCatch(
    Promise.sequence(
      () => filesDb.deleteFile(req, name, path),
      () => res.status(204)
    ),
    (err) => handleError(res, err)
  )
}

const files = new Router('/files')
.post('/', createFile)
.get('/', readFile)
.put('/', updateFile)
.delete('/', deleteFile)

module.exports = files
