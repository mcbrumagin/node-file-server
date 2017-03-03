const Datastore = require('nedb')
const { Promise, throwCustomError } = require('./utils.js')
const fs = Promise.promisifyAll(require('fs'))
const filesDb = new Datastore({ filename: './data/files.db', autoload: true })

filesDb.createFile = (req, name, path) => {
  return Promise.sequence(
    filesDb.findOneAsync({name}),
    (document) => {
      if (document.files.some(file => file.path === path)) {
        throwCustomError(400, `Document already exists, use "PUT" to overwrite it`)
      } else return new Promise((resolve, reject) => {
        let writeStream = fs.createWriteStream(path)
        req.pipe(writeStream)
        req.on('error', reject)
        req.on('end', resolve)
      })
    },
    () => fs.statSync(path),
    ({size}) => filesDb.updateAsync({name}, {
      $push: { files: { path, size } }
    })
  )
}

filesDb.updateFile = (req, name, path) => {
  let fileIndex
  return Promise.sequence(
    filesDb.findOneAsync({name}),
    (document) => {
      let fileIndex = document.files.findIndex((file) => file.path === path)
      if (!document.files.some(file => file.path === path)) {
        throwCustomError(400, `Document doesn't exist, use "POST" to create it`)
      }
    },
    () => new Promise((resolve, reject) => {
      let writeStream = fs.createWriteStream(path)
      req.pipe(writeStream)
      req.on('error', reject)
      req.on('end', resolve)
    }),
    () => fs.statSync(path),
    ({size}) => {
      let $set = {}
      $set[`files.${fileIndex}.size`] = size
      filesDb.updateAsync({name}, {$set})
    }
  )
}

filesDb.deleteFile = (req, name, path) => {
  let $unset = {}
  return Promise.sequence(
    () => filesDb.findOneAsync({name}),
    (document) => {
      let fileIndex = document.files.findIndex((file) => file.path === path)
      if (fileIndex === -1) {
        throwCustomError(400, `Document doesn't exist, use "POST" to create it`)
      }
      else $unset[`files.${fileIndex}`] = 1
    },
    () => fs.unlinkAsync(path),
    () => filesDb.updateAsync({name}, {$unset}),
    () => filesDb.updateAsync({name}, { $pull : {files: null} })
  )
}

module.exports = filesDb
