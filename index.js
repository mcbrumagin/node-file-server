const initialize = require('./lib/initialize.js')
const Server = require('./lib/rest-server.js').Server
const routers = require('./routing/routers.js')

const PORT = 10000
const server = new Server(...routers.getAll())

initialize().then((result) => {
  server.listen(PORT, () => {
    console.log(`Server listening on: http://localhost:${PORT}`)
  })
})
