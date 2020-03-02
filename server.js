var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

var users = [];
var connections = [];
dotenv.config();

var AWS = require("aws-sdk");
var awsConfig = {
    "region": "us-east-1",
    "endpoint": "http://dynamodb.us-east-1.amazonaws.com",
    "accessKeyId": "AKIAVLJCUMU3RPOOWFU3", "secretAccessKey": "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"
};
AWS.config.update(awsConfig);

var docClient = new AWS.DynamoDB.DocumentClient();


server.listen(process.env.PORT || 5000);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

function loginNewPlayer(username, password) {
    var uuid = uuidv4();
    var params = {
        TableName: 'mud-users',
        Item: {
            "username": username,
            "password": password,
            "uuid": uuid
        }
    };

    docClient.put(params, function (err, data) {
        if (err) console.log(err);
        else {
            console.log(data);
            io.sockets.emit('login message', {
                msg: "New Character.",
                name: username,
                password: password,
                uuid: uuid
            });
        }
    });
}

function loginPlayer(username, uuid) {
    io.sockets.emit('login message', {
        msg: "Welcome back, " + username,
        username: username,
        uuid: uuid
    });
}


io.sockets.on('connection', function (socket) {
    connections.push(socket);
    console.log("Connected: %s sockets connected, ", connections.length);


    // Check the Username/Password in the Dynamo
    var checkLogin = function (username, password) {
        username = username.trim();
        password = password.trim();

        var params = {
            TableName: 'mud-users',
            FilterExpression: 'username = :username',
            ExpressionAttributeValues: {
                ':username': username
            }
        };
        var loginAttempt = docClient.scan(params, function (err, data) {
            console.log("data: ", data);
            var playerObj = data;
            console.log("data in login", data)
            // Acknowledge New Player
            if (data.Count === 0) {
                // New Player Login message
                loginNewPlayer(username, password);
                return;
            } else if (data.Items[0].username === username && data.Items[0].password === password) {
                // Login player by getting the uuid
                loginPlayer(data.Items[0].username, data.Items[0].uuid);
            }
            return data;
        })
    }

    // Disconnect
    socket.on('disconnect', function (data) {
        if (!socket.username) return;
        console.log('data: ', data);
        users.splice(users.indexOf(socket.username), 1);
        updateUsernames()
        connections.splice(connections.indexOf(socket), 1);
        console.log('Disconnected: %s sockets connected.', connections.length);
        socket.close();
    })

    socket.on('send message', function (data) {
        io.sockets.emit('new message', { msg: data, user: socket.username });
    });

    socket.on('login', function (user, password, callback) {
        console.log('user', user)
        console.log('password', password)
        // If someone tries to login without a password.
        if (user === "" || password === "") {
            io.sockets.emit('login message', {
                msg: "Please choose a username/password."
            });
            return
        }
        checkLogin(user, password);
    })

    function updateUsernames() {
        io.sockets.emit('get users', users)
    }

})
