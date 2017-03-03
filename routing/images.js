const { Promise } = require('../lib/utils.js')
const { Router } = require('../lib/rest-server.js')
const files = require('./files.js')

// TODO: Is this clever or really stupid?
// Decoupled services?
// Should at least fail if dependency is unresolved?
let createFile = files.findOne('POST', '/files')

const cropFile = (req, res) => Promise.sequence(
  createFile(req, res),
  result => res.status(200)
)

const images = new Router('/images')
.post('/crop', cropFile)

module.exports = images
