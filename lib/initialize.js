const { Promise } = require('./utils.js')
const filesDb = Promise.promisifyAll(require('./files-db.js'))

function initialize() {
  return filesDb.findOneAsync({ name: 'public' })
  .then(document => {
    if (!document) return filesDb.insertAsync({
      name: 'public',
      files: [ /* TODO: Automatically read folder and sync */ ]
    }) // TODO: Create folder at this time
  })
}

module.exports = initialize
