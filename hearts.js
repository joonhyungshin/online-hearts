var app = require('express')();
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var multer = require('multer');
var upload = multer();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var lio = io.of('/lobby');
var gio = io.of('/game');

var user_list = [];
var room_list = [];

var lobby_users = [];

var admin_ip = '::1';
var login_allow = true;
var test_mode = false;
var temp_username;
var temp_request;
var ipban_list = [];

var card_suit = ['clubs', 'diamonds', 'spades', 'hearts'];
var card_value = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];
var card_dealmiss = [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 1, 1, 1, 1];
var card_strength = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
var mighty_score = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
var mighty_order = [52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40,
	26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14,
	13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
	39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27];

app.use(cookieParser());
app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());

app.get('/', function(req, res){
	if (test_mode){
		switch (temp_request){
			case 'lobby':
			res.redirect('/lobby');
			break;
			case 'game':
			res.redirect('/game');
			break;
			default:
			res.redirect('/login');
		}
	}
	else {
		if (req.cookies.auth) {
			var user = getUserByName(req.cookies.name);
			if (user == null){
				res.redirect('/lobby');
			}
			else {
				if (user.ip != req.ip){
					res.send('<h3>Access Denied.</h3>');
				}
				else {
					if (user.joining){
						res.redirect('/game');
					}
					else {
						res.redirect('/lobby');
					}
				}
			}
		}
		else {
			var user = getUserByIP(req.ip);
			if (user == null){
				res.redirect('/login');
			}
			else {
				res.send('<h3>Access Denied.</h3>');
			}
		}
	}
});

app.get('/login', function(req, res){
	if (req.cookies.auth && !test_mode) {
		res.redirect('/');
	}
	else {
		res.sendFile(__dirname + '/login.html');
	}	
});

app.post('/login', upload.array(), function(req, res){
	var banned = false;
	for (var i in ipban_list){
		if (ipban_list[i].ip == req.ip){
			banned = true;
		}
	}
	if ((login_allow && !banned) || req.ip == admin_ip){
		var name = req.body.name;
		var ip = req.ip;

		check = isValid(name, ip);
		if (check == 0){
			if (!test_mode){
				res.cookie('auth', true);
				res.cookie('name', name);
				res.redirect('/');
			}
			else {
				temp_username = name;
				temp_request = 'lobby';
				res.redirect('/');
			}
		}
		else {
			java_msg = "<scr" + "ipt language='javascript'>alert('"+check+"'); location.href='/'</script>";
			res.send(java_msg);
		}
	}
	else {
		if (banned){
			res.send('<h3> You are IP banned. </h3>');
		}
		else {
			res.send('<h3> Login is blocked. Sorry. </h3>');
		}
	}
});

app.get('/lobby', function(req, res){
	if (test_mode){
		var user = getUserByName(temp_username);
		if (temp_request == 'lobby'){
			temp_request = null;
			if (user == null){
				user = addUser(temp_username, req.ip);
				console.log(user.name + ' connected');
			}
			res.sendFile(__dirname + '/lobby.html');
		}
		else {
			res.redirect('/');
		}
	}
	else {
		var user = getUserByIP(req.ip);
		if (req.cookies.auth) {
			if (user != null && !user.leaving){
				res.send('<h3>Access Denied.</h3>');
			}
	 		else {
	 			if (user == null){
	 				user = addUser(req.cookies.name, req.ip);
					console.log(user.name + ' connected with IP ' + user.ip);
	 			}
	 			user.leaving = false;
	 			res.sendFile(__dirname + '/lobby.html');
	 		}
	 	}
	 	else {
	 		res.redirect('/');
	 	}
	}
});

app.get('/lobby.css', function(req, res){
	res.sendFile(__dirname + '/lobby.css');
});

app.get('/game.css', function(req, res){
	res.sendFile(__dirname + '/game.css');
});

app.post('/lobby', function(req, res){
	if (test_mode){
		deleteUserByName(req.body.lognum);
		res.redirect('/');
	}
	else {
		res.clearCookie('auth');
		res.clearCookie('name');
		deleteUserByIP(req.ip);
		res.redirect('/');
	}
});

app.get('/game', function(req, res){
	if (test_mode){
		if (temp_request == 'game'){
			temp_request = null;
			res.sendFile(__dirname + '/game.html');
		}
		else {
			res.redirect('/');
		}
	}
	else {
		var user = getUserByIP(req.ip);
		if (req.cookies.auth && user!=null) {
			if (user.joining){
				user.joining = false;
				res.sendFile(__dirname + '/game.html');
			}
			else {
				res.redirect('/');
			}
		}
		else {
			res.redirect('/');
		}
	}
});

app.post('/game', function(req, res){
	if (test_mode){
		deleteUserByName(req.body.lognum);
		res.redirect('/');
	}
	else {
		res.clearCookie('auth');
		res.clearCookie('name');
		deleteUserByIP(req.ip);
		res.redirect('/');
	}
});

app.get('/images/:id', function(req, res){
	var cardsrc = req.params.id;
	res.sendFile(__dirname + '/images/' + cardsrc);
});

app.all('*', function(req, res){
	res.status(404).send('<h3>ERROR - Page Not Found</h3>');
});

http.listen(8080, function(){
	console.log('listening on *:8080')
});

lio.on('connection', function(socket){
	if (test_mode){
		var user = getUserByName(temp_username);
		temp_username = null;
	}
	else {
		var ip = socket.request.connection.remoteAddress;
		var user = getUserByIP(ip);
	}
	if (user == null){
		socket.emit('redirect');
	}
	else {
		var name = user.name;
		user.id = socket.id;

		console.log(name + ' joined the lobby');
		lobby_users.push(name);

		socket.emit('your name', name, user.state == 'admin');
		socket.emit('blacklist', user.blacklist, null, null);

		socket.emit('load users', lobby_users);
		socket.broadcast.emit('add user', name);
		socket.emit('load rooms', encryptRoom(room_list));
	}

	socket.on('make game', function(title, password, hearts, maxm, setting){
		var room = createRoom(title, password, name, hearts, maxm, setting);
		user.room = room;
		user.channel = 'Room ' + room.num + ' [' + room.title + ']';
		if (test_mode){
			temp_request = 'game';
			temp_username = name;
		}
		else {
			user.joining = true;
		}
		socket.emit('redirect');
	});

	socket.on('return pw', function(roomnum, pw){
		var room = getRoomByNum(roomnum);
		if (room.password == pw){
			if (room.maxm > room.members.length){
				user.room = room;
				user.channel = room.title;
				if (test_mode){
					temp_request = 'game';
					temp_username = name;
				}
				else {
					user.joining = true;
				}
				socket.emit('redirect');
			}
			else {
				socket.emit('alert', 'The room is full!');
			}
		}
		else {
			socket.emit('alert', 'Wrong password!');
		}
	});

	socket.on('join game', function(roomnum){
		var room = getRoomByNum(roomnum);
		if (room != null){	
			if (room.maxm > room.members.length){
				if (room.password == ''){
					user.room = room;
					user.channel = room.title;
					if (test_mode){
						temp_request = 'game';
						temp_username = name;
					}
					else {
						user.joining = true;
					}
					socket.emit('redirect');
				}
				else {
					socket.emit('ask pw', roomnum);
				}
			}
			else {
				socket.emit('alert', 'The room is full!');
			}
		}
	});

	socket.on('chat msg', function(msg){
		if (msg.charAt(0) != '/'){
			if (msg != ''){
				lio.emit('public msg', name, msg);
			}
		}
		else {
			var cmd = msg.split(' ');
			var err_msg = 'Wrong usage. Use /? ' + cmd[0].substring(1) + ' for help.';
			var no_permission = 'You have no permission for this command.';
			switch (cmd[0]){
				case '/w':
				case '/whisper':
				case '/귓말':
				if (cmd.length >= 3){
					var msg_user = getUserByName(cmd[1]);
					for (i=3; i<cmd.length; i++){
						cmd[2] += (' ' + cmd[i]);
					}
					if (msg_user != null){
						if (msg_user.dnd){
							socket.emit('server msg', cmd[1] + ' is in DND mode.');
						}
						else {
							var whisper_msg = 'Whisper to ' + cmd[1] + ' : ' + cmd[2];
							socket.emit('server msg', whisper_msg);
							lio.to(msg_user.id).emit('private msg', name, cmd[2]);
							gio.to(msg_user.id).emit('private msg', name, cmd[2]);
						}
					}
					else {
						socket.emit('server msg', 'The user does not exist.');
					}
				}
				else {
					socket.emit('server msg', err_msg);
				}
				break;
				case '/ign':
				case '/ignore':
				case '/차단':
				if (cmd.length == 2){
					if (isUser(cmd[1])){
						if (user.isBlack(cmd[1])){
							socket.emit('server msg', 'You have already ignored this user.');
						}
						else {
							if (cmd[1] == user.name){
								socket.emit('server msg', 'Cannot ignore yourself.');
							}
							else {
								user.blacklist.push(cmd[1]);
								socket.emit('server msg', 'Ignore this user.');
								socket.emit('blacklist', user.blacklist, cmd[1], true);
							}
						}
					}
					else {
						socket.emit('server msg', 'The user does not exist.');
					}
				}
				else {
					socket.emit('server msg', err_msg);
				}
				break;
				case '/unign':
				case '/unignore':
				case '/차단해제':
				if (cmd.length == 2){
					if (user.isBlack(cmd[1])){
						for (i in user.blacklist){
							if (user.blacklist[i] == cmd[1]){
								break;
							}
						}
						user.blacklist.splice(i, 1);
						socket.emit('server msg', 'Unignore this user.');
						socket.emit('blacklist', user.blacklist, cmd[1], false);
					}
					else {
						socket.emit('server msg', 'You did not ignore this user.');
					}
				}
				else {
					socket.emit('server msg', err_msg);
				}
				break;
				case '/dnd':
				case '/방해금지':
				if (cmd.length == 1){
					if (!user.dnd){
						socket.emit('server msg', 'Do not disturb mode started.');
					}
					else {
						socket.emit('server msg', 'Do not disturb mode cancelled.');
					}
					user.dnd = !user.dnd;
				}
				else {
					socket.emit('server msg', err_msg);
				}
				break;
				case '/clr':
				case '/clear':
				case '/초기화':
				if (cmd.length == 1){
					socket.emit('chat clear');
				}
				else {
					socket.emit('server msg', err_msg);
				}
				break;
				case '/?':
				case '/help':
				switch (cmd[1]){
					case 'w':
					case 'whisper':
					case '귓말':
					socket.emit('server msg', 'Whisper to the user. Usage : /whisper <name> <message>');
					break;
					case 'ign':
					case 'ignore':
					case '차단':
					socket.emit('server msg', 'Ignore the user. Usage : /ignore <name>');
					break;
					case 'unign':
					case 'unignore':
					case '차단해제':
					socket.emit('server msg', 'Cancel the ignore. Usage : /unignore <name>');
					break;
					case 'dnd':
					case '방해금지':
					socket.emit('server msg', 'Do not disturb mode. Others cannot whisper to you. Usage : /dnd');
					break;
					case 'clr':
					case 'clear':
					case '초기화':
					socket.emit('server msg', 'Clear out the chat box. Usage : /clear');
					break;
					default:
					socket.emit('server msg', 'Command list : /w /whisper /ign /ignore /unign /unignore /dnd /clr /clear /help /귓말 /차단 /차단해제 /방해금지 /초기화');
				}
				break;
				case '/notice':
				if (cmd.length >= 2 && user.state == 'admin'){
					for (i=2; i<cmd.length; i++){
						cmd[1] += (' ' + cmd[i]);
					}
					lio.emit('server msg', cmd[1]);
					gio.emit('server msg', cmd[1]);
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/alert':
				if (cmd.length >= 2 && user.state == 'admin'){
					for (i=2; i<cmd.length; i++){
						cmd[1] += (' ' + cmd[i]);
					}
					socket.emit('server msg', 'Alert : ' + cmd[1]);
					socket.broadcast.emit('alert', cmd[1]);
					gio.emit('alert', cmd[1]);
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/block':
				if (cmd.length == 1 && user.state == 'admin'){
					socket.emit('server msg', 'Login blocked.');
					login_allow = false;
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/unblock':
				if (cmd.length == 1 && user.state == 'admin'){
					socket.emit('server msg', 'Login allowed.');
					login_allow = true;
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/kick':
				if (cmd.length == 2 && user.state == 'admin'){
					var kicked_user = getUserByName(cmd[1]);
					if (kicked_user != null){
						socket.emit('server msg', kicked_user.name + ' has been kicked out.');
						lio.to(kicked_user.id).emit('kicked');
						gio.to(kicked_user.id).emit('kicked');
					}
					else {
						socket.emit('server msg', 'Cannot find the user.');
					}
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/ban':
				if (cmd.length == 2 && user.state == 'admin'){
					if (test_mode){
						socket.emit('server msg', 'You cannot ban the user in test mode.');
					}
					else {
						var banned_user = getUserByName(cmd[1]);
						if (banned_user != null){
							socket.emit('server msg', banned_user.name + ' has been banned.');
							ipban_list.push(banned_user);
							lio.to(banned_user.id).emit('banned');
							gio.to(banned_user.id).emit('banned');
						}
						else {
							socket.emit('server msg', 'Cannot find the user.');
						}
					}
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/unban':
				if (cmd.length == 2 && user.state == 'admin'){
					for (i in ipban_list){
						if (ipban_list[i].name == cmd[1]){
							break;
						}
					}
					if (i < ipban_list.length){
						socket.emit('server msg', 'Unban the user.');
						ipban_list.splice(i, 1);
					}
					else {
						socket.emit('server msg', 'Cannot find the user.');
					}
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/test':
				if (cmd.length == 1 && user.state == 'admin'){
					if (test_mode){
						socket.emit('server msg', 'Test mode stopped.');
					}
					else {
						socket.emit('server msg', 'Test mode started.');
					}
					test_mode = !test_mode;
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/stop':
				if (cmd.length == 1 && user.state == 'admin'){
					login_allow = false;
					socket.emit('server msg', 'Server is ready to be stopped.');
					socket.broadcast.emit('stop server');
					gio.emit('stop server');
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				default:
				socket.emit('server msg', 'Command not found. Use /help or /? for help.');
			}
		}
	});

	socket.on('disconnect', function(){
		if (user != null){
			console.log(name + ' left the lobby');
			for (var i in lobby_users){
				if (lobby_users[i] == name){
					break;
				}
			}
			lobby_users.splice(i, 1);
			lio.emit('remove user', name);
			if (user.channel == 'lobby'){
				if (test_mode){
					console.log(name + ' disconnected');
				}
				else {
					console.log(name + ' disconnected with IP ' + ip);
				}
				deleteUserByName(name);
			}
		}
	});
});

gio.on('connection', function(socket){
	if (test_mode){
		var user = getUserByName(temp_username);
		temp_username = null;
	}
	else {
		var ip = socket.request.connection.remoteAddress;
		var user = getUserByIP(ip);
	}
	if (user == null){
		socket.emit('redirect');
	}
	else {
		var name = user.name;
		var room = user.room;
		user.id = socket.id;

		var wasleader = false;
		var g_user = null;

		if (user == room.leader){
			room.num = setRoomNum();
			room.register();
		}
		else {
			user.joinRoom(room);
		}
		socket.join(room.num);

		console.log(name + ' joined room '+room.num);
		gio.to(room.num).emit('server msg', name + ' joined.');
		lio.emit('room list', encryptRoom(room_list));
		if (user == room.leader){
			lio.emit('add room', encryptRoom([room])[0]);
		}
		socket.emit('member list', name, encryptRoom([room])[0]);
		socket.broadcast.to(room.num).emit('add member', name, user.isGamer());
		socket.emit('room info', room.num, room.title);
		socket.emit('blacklist', user.blacklist, null, null);
	}

	socket.on('move', function(){
		if (room.leader != user){
			if (!user.ready){
				var valid = user.move();
				if (valid){
					if (user.isGamer()){
						gio.to(room.num).emit('user move', name, true);
					}
					else {
						gio.to(room.num).emit('user move', name, false);
					}
				}
				else {
					socket.emit('alert', 'Gamers are full.');
				}
			}
		}
		else {
			socket.emit('alert', 'Leader cannot move!');
		}
	});

	socket.on('chat msg', function(msg){
		if (msg.charAt(0) != '/'){
			if (msg != ''){
				gio.to(room.num).emit('public msg', name, msg);
			}
		}
		else {
			var cmd = msg.split(' ');
			var err_msg = 'Wrong usage. Use /? ' + cmd[0].substring(1) + ' for help.';
			var no_permission = 'You have no permission for this command.';
			switch (cmd[0]){
				case '/w':
				case '/whisper':
				case '/귓말':
				if (cmd.length >= 3){
					var msg_user = getUserByName(cmd[1]);
					for (i=3; i<cmd.length; i++){
						cmd[2] += (' ' + cmd[i]);
					}
					if (msg_user != null){
						if (msg_user.dnd){
							socket.emit('server msg', cmd[1] + ' is in DND mode.');
						}
						else {
							var whisper_msg = 'Whisper to ' + cmd[1] + ' : ' + cmd[2];
							socket.emit('server msg', whisper_msg);
							lio.to(msg_user.id).emit('private msg', name, cmd[2]);
							gio.to(msg_user.id).emit('private msg', name, cmd[2]);
						}
					}
					else {
						socket.emit('server msg', 'The user does not exist.');
					}
				}
				else {
					socket.emit('server msg', err_msg);
				}
				break;
				case '/ign':
				case '/ignore':
				case '/차단':
				if (cmd.length == 2){
					if (isUser(cmd[1])){
						if (user.isBlack(cmd[1])){
							socket.emit('server msg', 'You have already ignored this user.');
						}
						else {
							if (cmd[1] == user.name){
								socket.emit('server msg', 'Cannot ignore yourself.');
							}
							else {
								user.blacklist.push(cmd[1]);
								socket.emit('server msg', 'Ignore this user.');
								socket.emit('blacklist', user.blacklist, cmd[1], true);
							}
						}
					}
					else {
						socket.emit('server msg', 'The user does not exist.');
					}
				}
				else {
					socket.emit('server msg', err_msg);
				}
				break;
				case '/unign':
				case '/unignore':
				case '/차단해제':
				if (cmd.length == 2){
					if (user.isBlack(cmd[1])){
						for (i in user.blacklist){
							if (user.blacklist[i] == cmd[1]){
								break;
							}
						}
						user.blacklist.splice(i, 1);
						socket.emit('server msg', 'Unignore this user.');
						socket.emit('blacklist', user.blacklist, cmd[1], false);
					}
					else {
						socket.emit('server msg', 'You did not ignore this user.');
					}
				}
				else {
					socket.emit('server msg', err_msg);
				}
				break;
				case '/kick':
				case '/강퇴':
				if (cmd.length == 2){
					if (user == room.leader){
						var kick_user = getUserByName(cmd[1]);
						if (kick_user == null){
							socket.emit('server msg', 'Cannot find the user.');
						}
						else if (getRoomByMemberName(cmd[1]) != room){
							socket.emit('server msg', 'The user is not in this room.');
						}
						else if (cmd[1] == user.name){
							socket.emit('server msg', 'Cannot kick yourself.');
						}
						else {
							gio.to(room.num).emit('server msg', kick_user.name + ' has been kicked out.');
							gio.to(room.num).emit('remove member', kick_user.name);
							gio.to(kick_user.id).emit('kicked out');
						}
					}
					else {
						socket.emit('server msg', no_permission);
					}
				}
				break;
				case '/des':
				case '/designate':
				case '/위임':
				if (cmd.length == 2){
					if (user == room.leader){
						var des_user = getUserByName(cmd[1]);
						if (des_user == null){
							socket.emit('server msg', 'Cannot find the user.');
						}
						else if (getRoomByMemberName(cmd[1]) != room){
							socket.emit('server msg', 'The user is not in this room.');
						}
						else if (cmd[1] == user.name){
							socket.emit('server msg', 'Cannot designate yourself.');
						}
						else if (!des_user.isGamer()){
							socket.emit('server msg', 'You can only designate gamer.');
						}
						else {
							room.leader = des_user;
							room.leader.ready = false;
							gio.to(room.num).emit('change leader', cmd[1]);
							gio.to(room.num).emit('server msg', cmd[1] + ' became the leader.');
						}
					}
				}
				break;
				case '/dnd':
				case '/방해금지':
				if (cmd.length == 1){
					if (!user.dnd){
						socket.emit('server msg', 'Do not disturb mode started.');
					}
					else {
						socket.emit('server msg', 'Do not disturb mode cancelled.');
					}
					user.dnd = !user.dnd;
				}
				else {
					socket.emit('server msg', err_msg);
				}
				break;
				case '/clr':
				case '/clear':
				case '/초기화':
				if (cmd.length == 1){
					socket.emit('chat clear');
				}
				else {
					socket.emit('server msg', err_msg);
				}
				break;
				case '/?':
				case '/help':
				switch (cmd[1]){
					case 'w':
					case 'whisper':
					case '귓말':
					socket.emit('server msg', 'Whisper to the user. Usage : /whisper <name> <message>');
					break;
					case 'ign':
					case 'ignore':
					case '차단':
					socket.emit('server msg', 'Ignore the user. Usage : /ignore <name>');
					break;
					case 'unign':
					case 'unignore':
					case '차단해제':
					socket.emit('server msg', 'Cancel the ignore. Usage : /unignore <name>');
					break;
					case 'kick':
					case '강퇴':
					socket.emit('server msg', 'Kick the user. Usage : /kick <name>')
					break;
					case 'des':
					case 'designate':
					case '위임':
					socket.emit('server msg', 'Designate new leader. Usage : /designate <name>')
					break;
					case 'dnd':
					case '방해금지':
					socket.emit('server msg', 'Do not disturb mode. Others cannot whisper to you. Usage : /dnd');
					break;
					case 'clr':
					case 'clear':
					case '초기화':
					socket.emit('server msg', 'Clear out the chat box. Usage : /clear');
					break;
					default:
					socket.emit('server msg', 'Command list : /w /whisper /ign /ignore /unign /unignore /kick /designate /dnd /clr /clear /help /귓말 /차단 /차단해제 /강퇴 /위임 /방해금지 /초기화');
				}
				break;
				case '/notice':
				if (cmd.length >= 2 && user.state == 'admin'){
					for (i=2; i<cmd.length; i++){
						cmd[1] += (' ' + cmd[i]);
					}
					lio.emit('server msg', cmd[1]);
					gio.emit('server msg', cmd[1]);
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/alert':
				if (cmd.length >= 2 && user.state == 'admin'){
					for (i=2; i<cmd.length; i++){
						cmd[1] += (' ' + cmd[i]);
					}
					socket.emit('server msg', 'Alert : ' + cmd[1]);
					socket.broadcast.emit('alert', cmd[1]);
					lio.emit('alert', cmd[1]);
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/block':
				if (cmd.length == 1 && user.state == 'admin'){
					socket.emit('server msg', 'Login blocked.');
					login_allow = false;
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/unblock':
				if (cmd.length == 1 && user.state == 'admin'){
					socket.emit('server msg', 'Login allowed.');
					login_allow = true;
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/kicks':
				if (cmd.length == 2 && user.state == 'admin'){
					var kicked_user = getUserByName(cmd[1]);
					if (kicked_user != null){
						socket.emit('server msg', kicked_user.name + ' has been kicked out from the server.');
						lio.to(kicked_user.id).emit('kicked');
						gio.to(kicked_user.id).emit('kicked');
					}
					else {
						socket.emit('server msg', 'Cannot find the user.');
					}
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/ban':
				if (cmd.length == 2 && user.state == 'admin'){
					if (test_mode){
						socket.emit('server msg', 'You cannot ban the user in test mode.');
					}
					else {
						var banned_user = getUserByName(cmd[1]);
						if (banned_user != null){
							socket.emit('server msg', banned_user.name + ' has been banned.');
							ipban_list.push(banned_user);
							lio.to(banned_user.id).emit('banned');
							gio.to(banned_user.id).emit('banned');
						}
						else {
							socket.emit('server msg', 'Cannot find the user.');
						}
					}
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/unban':
				if (cmd.length == 2 && user.state == 'admin'){
					for (i in ipban_list){
						if (ipban_list[i].name == cmd[1]){
							break;
						}
					}
					if (i < ipban_list.length){
						socket.emit('server msg', 'Unban the user.');
						ipban_list.splice(i, 1);
					}
					else {
						socket.emit('server msg', 'Cannot find the user.');
					}
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				case '/stop':
				if (cmd.length == 1 && user.state == 'admin'){
					login_allow = false;
					socket.emit('server msg', 'Server is ready to be stopped.');
					socket.broadcast.emit('stop server');
					lio.emit('stop server');
				}
				else {
					socket.emit('server msg', no_permission);
				}
				break;
				default:
				socket.emit('server msg', 'Command not found. Use /help or /? for help.');
			}
		}
	});

	socket.on('ready', function(isready){
		if (user.isGamer()){
			user.ready = isready;
			gio.to(room.num).emit('user ready', name, isready);
		}
	});

	socket.on('start', function(){
		if (user == room.leader){
			if (room.gamers.length < maxMember(room.hearts)){
				socket.emit('alert', 'Not enough gamers!');
			}
			else if (isReady(room.leader, room.gamers)){
				// Start
				room.start = true;
				room.trick = 1;
				room.round = 1;
				room.seat = shuffle(copyUser(room.gamers));
				gio.to(room.num).emit('start game', encryptUser(room.seat, 0));
				var temp_deck;
				cardDeck = shuffle(createDeck(room.hearts));
				for (i=0; i<4; i++){
					room.seat[i].seat = i;
					room.gamers[i].ready = false;
					temp_deck = cardDeck.splice(0, maxTrick(room.hearts));
					room.seat[i].deck = temp_deck;
				}
				room.leftover = cardDeck;
			}
			else {
				socket.emit('alert', 'Gamers are not ready!');
			}
		}
	});

	socket.on('make g_user', function(){
		for (var i in room.seat){
			if (room.seat[i].name == name){
				g_user = room.seat[i];
				break;
			}
		}
	});
	
	socket.on('deal card', function(){
		if (user == room.leader && !room.dealt){
			room.dealt = true;
			for (var i in room.seat){
				gio.to(room.seat[i].id).emit('your deck', room.seat[i].deck);
			}
			for (i in room.spectators){
				gio.to(room.spectators[i].id).emit('gamers deck', encryptUser(room.seat, 2), room.leftover);
			}
			if (room.hearts){
				for (i in room.seat){
					gio.to(room.seat[i].id).emit('send card');
				}
			}
			else {
				// Start with room leader
			}
		}
		else {
			report(name, ip, '3');
		}
	})

	socket.on('send card', function(send_deckname){
		if (g_user != null){
			var send_deck = g_user.popCardByNameArray(send_deckname);
			if (send_deck != null && !g_user.sent){
				g_user.sent = true;
				room.sent += 1;
				var next = nextSeat(room.round, g_user.seat);
				for (i=0; i<3; i++){
					room.seat[next].temp_card.push(send_deck[i]);
				}
				for (i in room.seat){
					gio.to(room.seat[i].id).emit('picked', name);
				}
				for (i in room.spectators){
					gio.to(room.spectators[i].id).emit('picked card', name, send_deck);
				}
				if (room.sent == 4){
					room.sent = 0;
					for (i in room.seat){
						for (j in room.seat[i].temp_card){
							room.seat[i].deck.push(room.seat[i].temp_card[j]);
						}
						room.seat[i].confirm = true;
						room.subcode = 0;
						gio.to(room.seat[i].id).emit('sent card', room.seat[i].temp_card);
					}
					for (i in room.spectators){
						gio.to(room.spectators[i].id).emit('card sent', encryptUser(room.seat, 4));
					}
					for (i in room.seat){
						room.seat[i].temp_card = [];
					}
				}
			}
			else {
				if (send_deck != null){
					for (var i in send_deck){
						g_user.deck.push(send_deck[i]);
					}
				}
				report(name, ip, '2');
			}
		}
		else {
			report(name, ip, '1');
		}
	});
	
	socket.on('send confirm', function(){
		if (g_user.confirm){
			g_user.confirm = false;
			if (room.subcode == 0){
				gio.to(room.num).emit('user confirm', name);
				var flag = 0;
				for (i=0; i<4; i++){
					if (room.seat[i].confirm){
						flag ++;
					}
				}
				if (flag == 0){
					for (i=0; i<4; i++){
						room.seat[i].deck.sort(function(card1, card2){
							return card1.order - card2.order;
						});
						if (room.seat[i].deck[0].name == '2_of_clubs'){
							break;
						}
					}
					room.seat[i].turn = true;
					gio.to(room.num).emit('gamer turn', room.seat[i].name);
				}
			}
			else if (room.subcode == 1){
				gio.to(room.num).emit('user confirm', name);
				var flag = 0;
				for (i=0; i<4; i++){
					if (room.seat[i].confirm){
						flag ++;
					}
				}
				if (flag == 0){
					var maxUser = room.first;
					room.first = null;
					if (room.trick == maxTrick(room.hearts)){
						// New moon? Old moon?
						for (i=0; i<4; i++){
							if (room.seat[i].score == 26){
								room.seat[i].score = 0;
								for (j=0; j<4; j++){
									if (i==j){
										continue;
									}
									room.seat[j].score = 26;
								}
							}
						}
						room.subcode = 2;
						for (i in room.seat){
							room.seat[i].confirm = true;
						}
						gio.to(room.num).emit('gamers score', encryptUser(room.seat, 5));
						for (i in room.seat){
							room.seat[i].scores[room.round-1] = room.seat[i].score;
							room.seat[i].score = 0;
							room.seat[i].penalty = [];
						}
						room.trick = 1;
						room.heartbreak = false;
					}
					else {
						room.trick += 1;
						maxUser.turn = true;
						gio.to(room.num).emit('gamer turn', maxUser.name);
					}
				}
			}
			else if (room.subcode == 2){
				var flag = 0;
				for (i=0; i<4; i++){
					if (room.seat[i].confirm){
						flag ++;
					}
				}
				if (flag == 0){
					if ((room.hearts && maxScore(room.seat) >= 100) || (!room.hearts && room.round == 10)){
						// Game over
						user.initialize();
						room.initialize();

						gio.to(room.num).emit('game over', encryptUser(room.seat, 3));
					}
					else {
						room.round += 1;
						var cardDeck = shuffle(createDeck(room.hearts));
						var temp_deck;
						for (i in room.seat){
							room.gamers[i].ready = false;
							temp_deck = cardDeck.splice(0, maxTrick(room.hearts));
							room.seat[i].deck = temp_deck;
							gio.to(room.seat[i].id).emit('your deck', temp_deck);
						}
						for (i in room.spectators){
							gio.to(room.spectators[i].id).emit('gamers deck', encryptUser(room.seat, 2), cardDeck);
						}
						if (room.hearts){
							// Start with 2 of Clubs
							if (room.round % 4 == 0){
								for (i in room.seat){
									room.seat[i].deck.sort(function(card1, card2){
										return card1.order - card2.order;
									});
									if (room.seat[i].deck[0].name == '2_of_clubs'){
										break;
									}
								}
								room.seat[i].turn = true;
								setTimeout(function(){
									gio.to(room.num).emit('gamer turn', room.seat[i].name);
								}, 4000);
								
							}
							else {
								for (i in room.seat){
									room.seat[i].sent = false;
									gio.to(room.seat[i].id).emit('send card');
								}
							}
						}
						else {
							// Start with previous friend
						}
					}
				}
			}
		}
		else {
			report(name, ip, '3');
		}		
	});

	socket.on('submit card', function(cardname){
		if (g_user != null){
			var card = g_user.popCardByName(cardname);
			if (card != null && g_user.checkCard(card) && g_user.turn){
				g_user.turn = false;
				room.s_users.push(g_user);
				room.s_cards.push(card);
				gio.to(room.num).emit('submit card', name, card);
				if (room.hearts && card.suit == 'hearts' && !room.heartbreak){
					room.heartbreak = true;
					gio.to(room.num).emit('heart break');
				}
				if (room.s_cards.length == maxMember(room.hearts)){
					var maxIndex = maxStrengthIndex(room.s_cards);
					var maxUser = room.s_users[maxIndex];
					for (i=0; i<4; i++){
						if (room.s_cards[i].score > 0){
							maxUser.penalty.push(room.s_cards[i]);
						}
					}
					var addScore = sumOfScore(room.s_cards);
					maxUser.score += addScore;
					room.s_users = [];
					room.s_cards = [];

					room.first = maxUser;
					room.subcode = 1;
					for (i in room.seat){
						room.seat[i].confirm = true;
						gio.to(room.seat[i].id).emit('max user', maxUser.name, addScore);
					}
				}
				else {
					var next = (g_user.seat+1)%4;
					room.seat[next].turn = true;
					gio.to(room.num).emit('gamer turn', room.seat[next].name);
				}
			}
			else {
				g_user.deck.push(card);
				report(name, ip);
			}
		}
		else {
			report(name, ip);
		}
	});

	socket.on('leave room', function(){
		if (user == room.leader){
			wasleader = true;
		}
		if (room.members.length == 1){
			lio.emit('remove room', room.num);
		}
		socket.leave(room.num);
		user.leaveRoom();
		if (test_mode){
			temp_request = 'lobby';
			temp_username = name;
		}
		else {
			user.leaving = true;
		}
		lio.emit('room list', encryptRoom(room_list));
		socket.emit('redirect');
	});

	socket.on('disconnect', function(){
		if (user != null){
			user.initialize();
			console.log(name + ' left room '+room.num);
			if (user.channel != 'lobby'){
				if (user == room.leader){
					wasleader = true;
				}
				if (room.members.length == 1){
					lio.emit('remove room', room.num);
				}
				socket.leave(room.num);
				user.leaveRoom();
				lio.emit('room list', encryptRoom(room_list));
				deleteUserByName(name);
			}
			gio.to(room.num).emit('server msg', name + ' left.');
			gio.to(room.num).emit('remove member', name);
			if (!room.leader.isGamer()){
				room.leader.move();
				gio.to(room.num).emit('user move', room.leader.name, true);
			}
			if (wasleader){
				gio.to(room.num).emit('change leader', room.leader.name);
				gio.to(room.num).emit('server msg', room.leader.name + ' became the leader.');
			}
		}
	});
});

function isValid(name, ip){
	var check_msg = 0;
	if (name == ''){
		check_msg = 'Please write your name.';
	}
	for (var i in user_list){
		if (name == user_list[i].name){
			check_msg = 'Your name already exists!';
		}
	}
	if (name.indexOf(' ') != -1 || (name == 'admin' && ip != admin_ip)){
		check_msg = 'You cannot use that name.';
	}
	return check_msg;
}

function User(name, ip){
	this.name = name;
	this.ip = ip;
	this.channel = 'lobby';
	this.joining = false;
	this.leaving = false;
	this.blacklist = [];
	this.dnd = false;
	this.room = null;
	this.joinRoom = joinRoom;
	this.leaveRoom = leaveRoom;
	this.id = null;
	this.kor = false;
	this.isGamer = isGamer;
	this.isBlack = isBlack;
	this.move = move;
	this.ready = false;
	this.deck = [];
	this.seat = null;
	this.turn = false;
	this.score = 0;
	this.scores = new Array(16);
	this.temp_card = [];
	this.penalty = [];
	this.checkCard = checkCard;
	this.sent = false;
	this.confirm = false;
	this.popCardByName = popCardByName;
	this.popCardByNameArray = popCardByNameArray;
	this.initialize = initialize_user;
	if (ip == admin_ip && name == 'admin') {
		this.state = 'admin';
	}
	else {
		this.state = 'visitor';
	}
}

function initialize_user(){
	this.deck = [];
	this.seat = null;
	this.turn = false;
	this.score = 0;
	this.scores = new Array(16);
	this.temp_card = [];
	this.penalty = [];
	this.sent = false;
	this.confirm = false;
}

function addUser(name, ip){
	var user = new User(name, ip);
	user_list.push(user);
	return user;
}

function getUserByIP(ip){
	for (var i in user_list){
		if (user_list[i].ip == ip){
			return user_list[i]
		}
	}
	return null;
}

function getUserByName(name){
	for (var i in user_list){
		if (user_list[i].name == name){
			return user_list[i];
		}
	}
	return null;
}

function deleteUserByIP(ip){
	var flag = 0;
	for (var i in user_list){
		if (user_list[i].ip == ip){
			flag = 1;
			break;
		}
	}
	if (flag == 0){
		return;
	}
	user_list.splice(i, 1);
}

function deleteUserByName(name){
	var flag = 0;
	for (var i in user_list){
		if (user_list[i].name == name){
			flag = 1;
			break;
		}
	}
	if (flag == 0){
		return;
	}
	user_list.splice(i, 1);
}

function encryptUser(user_array, tag){
	var enc_userlist = [];
	for (var i in user_array){
		if (tag == 0){
			enc_userlist.push(user_array[i].name);
		}
		else if (tag == 1){
			enc_userlist.push([user_array[i].name, user_array[i].ready]);			
		}
		else if (tag == 2){
			enc_userlist.push([user_array[i].name, user_array[i].deck]);
		}
		else if (tag == 3){
			enc_userlist.push([user_array[i].name, user_array[i].scores]);
		}
		else if (tag == 4){
			enc_userlist.push([user_array[i].name, user_array[i].temp_card]);
		}
		else if (tag == 5){
			enc_userlist.push([user_array[i].name, user_array[i].penalty, user_array[i].score]);
		}
	}
	return enc_userlist;
}

function copyUser(userarray){
	var name, ip;
	var duplicate = [];
	var temp_user;
	for (var i in userarray){
		name = userarray[i].name;
		ip = userarray[i].ip;
		temp_user = new User(name, ip);
		temp_user.id = userarray[i].id;
		duplicate.push(temp_user);
	}
	return duplicate;
}

function Room(title, password, leadername, hearts, maxm, setting){
	var leader = getUserByName(leadername);
	this.register = register;
	this.title = title;
	this.password = password;				// Private
	this.leader = leader;					// To private
	this.members = [leader];
	this.gamers = [leader];
	this.spectators = [];
	this.maxm = maxm;
	this.setting = setting;
	this.num = -1;
	this.hearts = hearts;
	this.seat = new Array(maxMember(hearts));
	this.leftover = [];
	this.dealt = false;
	this.s_users = [];	// Submitted users
	this.s_cards = [];	// Submitted cards
	this.president = null;
	this.trumpsuit = null;
	this.trick = 1;
	this.round = 1;
	this.first = null;
	this.start = false;
	this.sent = 0;
	this.heartbreak = false;
	this.subcode = null;
	this.initialize = initialize_room
}

function initialize_room(){
	this.seat = new Array(maxMember(hearts));
	this.leftover = [];
	this.dealt = false;
	this.s_users = [];	// Submitted users
	this.s_cards = [];	// Submitted cards
	this.president = null;
	this.trumpsuit = null;
	this.trick = 1;
	this.round = 1;
	this.first = null;
	this.start = false;
	this.sent = 0;
	this.heartbreak = false;	
	this.subcode = null;
}

function createRoom(title, password, leadername, hearts, maxm, setting){
	var room = new Room(title, password, leadername, hearts, maxm, setting);
	return room;
}

function register(){
	room_list.push(this);
}

function setRoomNum(){
	var i = 0;
	var flag = 0;
	for (i=0; i<room_list.length; i++){
		flag = 0;
		for (var j in room_list){
			if (i == room_list[j].num){
				flag ++;
			}
		}
		if (flag == 0){
			break;
		}
	}
	return i;
}

function getRoomByMemberName(name){
	for (var i in room_list){
		for (var j in room_list[i].members){
			if (room_list[i].members[j].name == name){
				return room_list[i];
			}
		}
	}
	return null;
}

function getRoomByNum(num){
	for (var i in room_list){
		if (room_list[i].num == num){
			return room_list[i];
		}
	}
	return null;
}

function joinRoom(room){
	room.members.push(this);
	var maxm = maxMember(room.hearts);
	if (room.gamers.length < maxm){
		room.gamers.push(this);
	}
	else {
		room.spectators.push(this);
	}
}

function leaveRoom(){
	var room = this.room;
	if (room != null){
		for (var i in room.members){
			if (room.members[i].name == this.name){
				break;
			}
		}
		room.members.splice(i, 1);
		var flag = 0;
		for (i in room.gamers){
			if (room.gamers[i].name == this.name){
				flag = 1;
				break;
			}
		}
		if (flag > 0){
			room.gamers.splice(i, 1);
		}
		else {
			for (i in room.spectators){
				if (room.spectators[i].name == this.name){
					break;
				}
			}
			room.spectators.splice(i, 1);
		}
		if (room.members.length == 0){
			for (i in room_list){
				if (room_list[i] == room){
					break;
				}
			}
			room_list.splice(i, 1);
		}
		else if (room.leader.name == this.name){
			room.leader = room.members[0];
			room.leader.ready = false;
		}
	}
	this.room = null;
	this.ready = false;
	this.channel = 'lobby';
}

function encryptRoom(room_array){
	var enc_roomlist = [];
	var temp_room;
	var r;
	for (var i in room_array){
		r = room_array[i];
		temp_room = new Room(r.title, r.password, r.leader.name, r.hearts, r.maxm, r.setting);
		temp_room.password = r.password != '';
		temp_room.leader = r.leader.name;
		temp_room.members = encryptUser(r.members, 0);
		temp_room.gamers = encryptUser(r.gamers, 1);
		temp_room.spectators = encryptUser(r.spectators, 0);
		temp_room.num = r.num;
		enc_roomlist.push(temp_room);
	}
	return enc_roomlist;
}

function isUser(name){
	for (var i in user_list){
		if (user_list[i].name == name){
			return true;
		}
	}
	return false;
}

function isBlack(name){
	for (var i in this.blacklist){
		if (this.blacklist[i] == name){
			return true;
		}
	}
	return false;
}

function isReady(leader, gamerarray){
	for (var i in gamerarray){
		if (leader.name != gamerarray[i].name && !gamerarray[i].ready){
			return false;
		}
	}
	return true;
}

function nextSeat(round, seat){
	switch (round % 4){
		case 1:
		return (seat + 1) % 4;
		break;
		case 2:
		return (seat + 3) % 4;
		break;
		case 3:
		return (seat + 2) % 4;
	}
}

function Card(){}

function createDeck(isHearts){
	var deck = [];
	var card;
	for (i=0; i<4; i++){
		for (j=0; j<13; j++){
			card = new Card();
			card.suit = card_suit[i];
			card.value = card_value[j];
			card.name = card.value + '_of_' + card.suit
			card.strength = card_strength[j];
			if (isHearts){
				card.score = 0;
				if (card.name == 'queen_of_spades'){
					card.score = 13;
				}
				else if (card.suit == 'hearts'){
					card.score = 1;
				}
				card.order = 13 * i + j;
			}
			else {
				if (card.name == 'ace_of_spades'){
					card.strength = 40;
				}
				card.score = mighty_score[j];
				card.order = mighty_order[13 * i + j];
			}
			deck.push(card);
		}
	}
	if (!isHearts){
		card = new Card();
		card.suit = '';
		card.value = 0;
		card.name = 'joker';
		card.strength = 39;
		card.score = 0;
		card.order = 53;
		deck.push(card);
	}
	return deck;
}

function popCardByName(cardname){
	var card;
	for (var i in this.deck){
		if (this.deck[i].name == cardname){
			card = this.deck[i];
			this.deck.splice(i, 1);
			return card;
		}
	}
	return null;
}

function popCardByNameArray(cardnamearr){
	var result_arr = [];
	var temp;
	for (var i in cardnamearr){
		temp = this.popCardByName(cardnamearr[i]);
		if (temp == null){
			for (var j in result_arr){
				this.deck.push(result_arr[j]);
			}
			return null;
		}
		result_arr.push(temp);
	}
	return result_arr;
}

function checkCard(card){
	var room = getRoomByMemberName(this.name);
	if (room.trick == 1){
		if (room.s_cards.length == 0 && card.name != '2_of_clubs'){
			return false;
		}
		this.deck.sort(function(card1, card2){
			return card1.order - card2.order;
		});
		if (card.score > 0 && (this.deck[0].score == 0 || this.deck[1].score == 0)){
			return false;
		}
	}
	else if (room.s_cards.length == 0 && card.suit == 'hearts' && !room.heartbreak){
		return false;
	}
	else if (room.s_cards.length > 0 && card.suit != room.s_cards[0].suit){
		var flag = 0;
		for (var i in this.deck){
			if (this.deck[i].suit == room.s_cards[0].suit){
				return false;
			}
		}
	}
	return true;
}

function maxStrengthIndex(cardarray){
	var str_val = [];
	var first_suit = cardarray[0].suit;
	var plus;
	for (var i in cardarray){
		if (cardarray[i].suit == first_suit){
			plus = 13;
		}
		else {
			plus = 0;
		}
		str_val.push(cardarray[i].strength + plus);
	}
	var maximum = max(str_val);
	for (i=0; i<str_val.length; i++){
		if (str_val[i] == maximum){
			return i;
		}
	}
}

function sumOfScore(cardarray){
	var scr_val = [];
	for (var i in cardarray){
		scr_val.push(cardarray[i].score);
	}
	return sum(scr_val);
}

function maxScore(userarray){
	var user_score = [];
	for (var i in userarray){
		user_score.push(sum(userarray[i].scores));
	}
	return max(user_score);
}

function check(card){
	var room = getRoomByMemberName(this.name);
	var flag = 0;
	if (room.s_cards.length > 0){
		var init_suit = room.s_cards[0].suit;
		for (i in this.deck){
			if (this.deck[i].suit == init_suit){
				flag = 1;
				break;
			}
		}
		if (flag == 0){
			if (room.hearts){
				if (room.trick == 1 && card.score > 0){
					return false;
				}
			}
		}
		else {
			if (card.suit != init_suit){
				if (room.hearts){
					return false;
				}
				else {
					if (room.trumpsuit == 'spades'){
						if (card.name != 'ace_of_diamonds'){
							return false;
						}
					}
					else {
						if (card.name != 'ace_of_spades'){
							return false;
						}
					}
				}
			}
		}
	}
	else {
		if (room.hearts && !room.heartbreak && card.suit == 'hearts'){
			return false;
		}
	}
	return true;
}

function shuffle(arr){
	for (var j, x, i = arr.length; i; j = Math.floor(Math.random() * i), x = arr[--i], arr[i] = arr[j], arr[j] = x);
	return arr;
}

function maxMember(hearts){
	var n = hearts ? 4 : 5;
	return n;
}

function maxTrick(hearts){
	var n = hearts ? 13 : 10;
	return n;
}

function isGamer(){
	var room = this.room;
	var flag = 0;
	if (room != null){
		for (var i in room.gamers){
			if (room.gamers[i].name == this.name){
				flag = 1;
				break;
			}
		}
		if (flag > 0){
			return true;
		}
	}
	return false;
}

function move(){
	var room = this.room;
	if (room == null){
		return null;
	}
	else {
		if (this.isGamer()){
			for (var i in room.gamers){
				if (room.gamers[i].name == this.name){
					break;
				}
			}
			room.gamers.splice(i, 1);
			room.spectators.push(this);
		}
		else {
			if (room.gamers.length >= maxMember(room.hearts)){
				return false;
			}
			for (var i in room.spectators){
				if (room.spectators[i].name == this.name){
					break;
				}
			}
			room.spectators.splice(i, 1);
			room.gamers.push(this);		
		}
		return true;
	}
}

function sum(array){
	var sum = 0;
	for (var i in array){
		sum += eval(array[i]);
	}
	return sum;
}

function max(array){
	if (array.length == 1){
		return array[0];
	}
	else {
		var l = array[array.length-1]
		var m = max(array.slice(0, -1));
		if (l > m){
			return l
		}
		else {
			return m;
		}
	}
}

function report(name, ip, code){
	console.log('Bad request sent by ' + name + '. IP : ' + ip + '. Code : ' + code);
}