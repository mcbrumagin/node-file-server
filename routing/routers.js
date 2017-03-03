const files = require('./files.js')
const privateFiles = require('./private-files.js')
const images = require('./images.js')

function getAll() {
  return [files, privateFiles, images]
}

module.exports = { getAll }
