# apipub

Publish API from server to client and vice versa.

## Server example

```javascript
var apipub = require('apipub/server');
var express = require('express');
var promisify = require('bluebird').promisifyAll;
// promise API is preferred, but callback-style works too
var fs = promisify(require('fs'));

var app = express();

// create websocket RPC endpoint at /
apipub(app, '/', function (client) {
    // mount whole `fs` library
    client.mount('fs', fs);
    
    // per client state and access control example
    var authed = false;
    client.mount('auth', function (pass) {
        authed = pass == 'ossifrage';
    });
    client.mount('get', function (path) {
        if (!authed) {
            return Promise.reject('foo!');
        }
        return fs.readFileAsync(path).then(function (buf) {
            return Promise.resolve(buf.toString());
        });
    });
    
    // mount some object
    client.mound('test', {a: 1, b: 2});
    
    // when client connects, get its api
    client.on('join', function (api) {
        // call client-side mounted function
		api.console.log('Hello, client!');
	});
    
    // something happened
	client.on('error', function (err) {
		console.log(err);
	});
});

app.get('/', function (req, res) {
	res.sendFile(__dirname + "/index.htm");
});
app.use(express.static(__dirname));

app.listen('80', 'localhost');
```

## Client example (browserify)

```javascript
var apipub = require('apipub/client');
var Q = require('q');

var someFilePath = '.../file.txt';

// connect to current server to the / endpoint
apipub('/', function (server) {
    // mount `console` object
    server.mount('console', console);
    
    // when we've connected to the server
	server.on('join', function (api) {
        // nice syntax for promise-based computations
        // to use generators in older browsers you would need
        // to add `babelify` transform to `browserify`
        Q.spawn(function* () {
            // call something from fs
            api.fs.readFile(someFilePath, function (err, data) {
                console.log(err, data);
            });
            
            // promise-style call
            // mention that previously string-returning toString() returns a Promise now
            console.log(yield (yield api.fs.readFileAsync(someFilePath)).toString());
            
            // call with correct auth token
            yield api.auth('ossifrage');
            console.log(yield api.get(someFilePath));
            
            // call with wrong auth token
            yield api.auth('squeamish');
            console.log(yield api.get(someFilePath));
            
            // test object
            console.log(api.test.a, api.test.b);
        });
	});
});
```