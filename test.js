var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
	res.sendFile(__dirname + '/test.html');
});

io.of('/my-namespace').on('connection', function(socket){
	console.log('someone connected');
});

http.listen(80, function(){
	console.log('*:80');
});