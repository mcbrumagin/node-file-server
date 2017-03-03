//const { Promise } = require('./utils.js')
const http = require('http')

function getArray(obj) {
  return Array.prototype.slice.call(obj)
}

const protocolRegex = /(https?):\/\/(.+)/ig
const hostRegex = /(.+?)\/(.+)/ig
const pathRegex = /\/(.+?)(\?(.+)?)?$/ig
const paramsRegex = /(.+)=(.+)/ig

function parseUrl(url) {
  //let [, protocol, address] = protocolRegex.exec(url)
  //let [, host, path] = hostRegex.exec(address)
  let match = new RegExp(pathRegex).exec(url)
  if (match) {
    let [, endpoint,, paramString] = match
    let params = {}

    if (paramString) {
      let paramRegex = new RegExp(paramsRegex)
      let paramFrags = paramString.split('&')
      for (let frag of paramFrags) {
        let match = new RegExp(paramsRegex).exec(frag)

        if (match) {
          let [, name, value] = match
          params[name] = value
        }
      }
    }

    return { endpoint, params }
  }
}

function isPathMatch(expected, actual) {
  expected = expected.split('/').filter(str => str !== "")
  actual = actual.split('/').filter(str => str !== "")

  if (actual.length !== expected.length)
    return false

  for (let i = 0; i < actual.length; i++)
    if (expected[i] !== actual[i])
      return false

  return true
}

function extendRequest(req, res) {
  req.session = {}
  return req
}

function extendResponse(res, req) {
  res.status = function setStatus(code) {
    res.statusCode = code
    return res
  }
  let endFn = res.end
  res.end = function end(message) {
    console.info(`[${res.statusCode}] ${req.method} /${req.endpoint}`)
    endFn.call(res, message)
  }
  return res
}

function handleError(response, err) {
  if (err.statusCode) {
    response.status(err.statusCode).end(err.message)
  } else {
    response.writeHead(500)
    response.end(`${err.message}\n${err.stack}`)
  }
}

function mainHandler(request, response) {
  request = extendRequest(request, response)
  response = extendResponse(response, request)

  let { endpoint, params } = parseUrl(request.url)
  request.endpoint = endpoint
  request.params = params

  console.log(`Incoming request - ${request.endpoint}:${JSON.stringify(request.params)}`)

  for (let i = 0; i < this.handlers.length; i++) {
    let obj = this.handlers[i]
    if (typeof obj === 'function') {
      // TODO?
      obj(request, response)
      return
    } else {

      console.log(`Checking path handler - ${obj.method}:${obj.path}`)

      if (request.method === obj.method
      && isPathMatch(obj.path, request.endpoint)) {
        // TODO: Test to see if this is actually optimized, lol
        if (i > 0) {
          this.handlers.splice(i, 1)
          this.handlers.unshift(obj)
        }
        try {
          let result = obj.handler(request, new Response(response), obj.parent)
          if (result && result.then) {
            result.then(res => {
              if (res) {
                if (!res.isSent) res.send()
              }
            })
            result.catch(err => handleError(response, err))
          }
        }
        catch (err) {
          handleError(response, err)
        }
        return
      }
    }
  }

  response.status(404).end('Not Found')
}

const Server = function () {
  this.handlers = []
  this.use(...getArray(arguments))
}

Server.prototype.use = function (/* fn or Router list */) {
  let args = getArray(arguments)
  for (let arg of args) {
    if (arg.handlers) {
      for (let service of arg.handlers) {
        this.handlers.push(service)
      }
    } else {
      this.handlers.push(arg)
    }
  }
  return this
}

Server.prototype.get = function (path, handler) {
  this.handlers.push({ method: 'GET', path, handler })
  return this
}

Server.prototype.post = function (path, handler) {
  this.handlers.push({ method: 'POST', path, handler })
  return this
}

Server.prototype.put = function (path, handler) {
  this.handlers.push({ method: 'PUT', path, handler })
  return this
}

Server.prototype.delete = function (path, handler) {
  this.handlers.push({ method: 'DELETE', path, handler })
  return this
}

Server.prototype.listen = function (port, callback) {
  let server = http.createServer(mainHandler.bind(this))
  server.listen(port, callback)
  return server
}


const Router = function (path, baseRouter) {
  path = path.split('/').filter(str => str !== "").join('/')
  this.handlers = []
  this.baseEndpoint = path

  if (baseRouter) {
    let base = baseRouter.baseEndpoint
    let baseFrags = base.split('/').filter(str => str !== "")
    let pathFrags = path.split('/').filter(str => str !== "")
    path = baseFrags.concat(pathFrags).join('/')

    this.baseEndpoint = path

    for (let obj of baseRouter.handlers) {
      let { method, path: endpoint, handler } = obj
      endpoint = endpoint.replace(base, '')
      this.add(method, endpoint, handler)
    }
  }
}

Router.prototype.find = function (method, path) {
  path = path.split('/').filter(str => str !== "").join('/')
  return this.handlers.filter(
    h => h.method === method && h.path === path
  ).map(h => h.handler)
}

Router.prototype.findOne = function (method, path) {
  return this.find(method, path)[0]
}

Router.prototype.add = function (method, endpoint, handler) {
  let base = this.baseEndpoint.split('/')
  endpoint = endpoint.split('/').filter(str => str !== "")
  let path = base.concat(endpoint).join('/')
  let handlerObject = { method, path, handler }

  console.log(`Adding path handler - ${method}:${path}`)

  // Remove any handler that matches
  let dupeIndex = this.handlers.findIndex(h => h.method === method && h.path === path)
  if (dupeIndex > -1) {
    let parent = this.handlers.splice(dupeIndex, 1)[0]
    handlerObject.parent = parent
  }

  this.handlers.push(handlerObject)
  return this
}

Router.prototype.get = function (endpoint, handler) {
  this.add('GET', endpoint, handler)
  return this
}

Router.prototype.post = function (endpoint, handler) {
  this.add('POST', endpoint, handler)
  return this
}

Router.prototype.put = function (endpoint, handler) {
  this.add('PUT', endpoint, handler)
  return this
}

Router.prototype.delete = function (endpoint, handler) {
  this.add('DELETE', endpoint, handler)
  return this
}

function response() {
  this.statusCode = null
  this.message = ''
}

response.prototype.status = function (code) {
  this.statusCode = code
  return this
}

response.prototype.end = function (message) {
  this.message = message
  return this
}

function Response(handler) {
  this.isSent = false
  this.statusCode = null
  this.message = null
  this.header = null
  this.handler = handler
}

Response.prototype.send = function () {
  if (!this.isSent) {
    this.handler.end(this.message)
  } else {
    console.warn(new Error('Tried to send response more than once'))
  }
}

Response.prototype.headers = function (header) {
  this.header = header
  this.handler.writeHead(this.statusCode || 200, header)
  return this
}

Response.prototype.status = function (code) {
  this.statusCode = code
  this.handler.status(code)
  return this
}

Response.prototype.content = function (message) {
  this.message = message
  return this
}

module.exports = { Server, Router, Response }
