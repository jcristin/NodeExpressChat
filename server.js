var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
    port = 80,
    // hash object to save clients data,
    // { socketid: { clientid, nickname }, socketid: { ... } }
    chatClients = new Object();

server.listen(port);

var rooms = ['Teresa', 'João', 'Duarte', 'Miguel'];

// configure express, since this server is also a web server, we need to define the paths to the static files
app.use("/styles", express.static(__dirname + '/public/styles'));
app.use("/scripts", express.static(__dirname + '/public/scripts'));
app.use("/images", express.static(__dirname + '/public/images'));

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/public/index.html');
});

io.set('transports', ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling', 'polling']);

io.sockets.on('connection', function(socket){
  
    socket.on('nick', function (data){connect(socket, data);});

	socket.on('chatmessage', function (data){chatmessage(socket, data);});
	
	socket.on('subscribe', function (data){subscribe(socket, data);});

	socket.on('unsubscribe', function (data){unsubscribe(socket, data);});
	
    socket.on('disconnect', function (){disconnect(socket);});
});

function connect(socket, data){
	//generate clientId
	data.clientId = generateId();

	// save the client to the hash object for
	// quick access, we can save this data on
	// the socket with 'socket.set(key, value)'
	// but the only way to pull it back will be
	// async
	chatClients[socket.id] = data;

	// now the client objtec is ready, update the client
	socket.emit('ready', { clientId: data.clientId });
	
	// auto subscribe the client to the 'João'
	subscribe(socket, { room: 'Jo&atildeo' });

	// sends a list of all active rooms in the server
    socket.emit('roomslist', { rooms: getRooms() });
}

// when a client disconnect, unsubscribe him from the rooms he subscribed to
function disconnect(socket){
	// get a list of rooms for the client
	var rooms = io.sockets.adapter.roomclients[socket.id];
	
	// unsubscribe from the rooms
	for(var room in rooms){
		if(room && rooms[room]){
			unsubscribe(socket, { room: room.replace('/','') });
		}
	}

	// client was unsubscribed from the rooms,
	// now we can selete him from the hash object
	delete chatClients[socket.id];
}

// receive chat message from a client and send it to the relevant room
function chatmessage(socket, data){
	// by using 'socket.broadcast' we can send/emit
	// a message/event to all other clients except
	// the sender himself
	socket.broadcast.to(data.room).emit('chatmessage', { client: chatClients[socket.id], message: data.message, room: data.room });
}

// subscribe a client to a room
function subscribe(socket, data){
	// get a list of all active rooms
	var rooms = getRooms();

	// check if this room is exist, if not, update all 
	// other clients about this new room
	if(rooms.indexOf('/' + data.room) < 0){
		socket.broadcast.emit('addroom', { room: data.room });
	}

	// subscribe the client to the room
	socket.join(data.room);

	// update all other clients about the online
	// presence
	updatePresence(data.room, socket, 'online');

	// send to the client a list of all subscribed clients
	// in this room
	socket.emit('roomclients', { room: data.room, clients: getClientsInRoom(socket.id, data.room) });
}

// unsubscribe a client from a room, this can be
// occured when a client disconnected from the server
// or he subscribed to another room
function unsubscribe(socket, data){
	// update all other clients about the offline
	// presence
	updatePresence(data.room, socket, 'offline');
	
	// remove the client from socket.io room
	socket.leave(data.room);

	// if this client was the only one in that room
	// we are updating all clients about that the
	// room is destroyed
	if(!countClientsInRoom(data.room)){

		// with 'io.sockets' we can contact all the
		// clients that connected to the server
		io.sockets.emit('removeroom', { room: data.room });
	}
}

// 'io.sockets.manager.rooms' is an object that holds
// the active room names as a key, returning array of
// room names
function getRooms(){
    console.log("getRooms");
	return Object.keys(io.sockets.adapter.rooms);
}

// get array of clients in a room
function getClientsInRoom(socketId, room){
	// get array of socket ids in this room
	var socketIds = io.sockets.adapter.rooms['/' + room];
	var clients = [];
	
	if(socketIds && socketIds.length > 0){
		socketsCount = socketIds.lenght;
		
		// push every client to the result array
		for(var i = 0, len = socketIds.length; i < len; i++){
			
			// check if the socket is not the requesting
			// socket
			if(socketIds[i] != socketId){
				clients.push(chatClients[socketIds[i]]);
			}
		}
	}
	
	return clients;
}

// get the amount of clients in aroom
function countClientsInRoom(room){
	// 'io.sockets.adapter.rooms' is an object that holds
	// the active room names as a key and an array of
	// all subscribed client socket ids
	if(io.sockets.adapter.rooms['/' + room]){
		return io.sockets.adapter.rooms['/' + room].length;
	}
	return 0;
}

// updating all other clients when a client goes
// online or offline. 
function updatePresence(room, socket, state){
	// socket.io may add a trailing '/' to the
	// room name so we are clearing it
	room = room.replace('/','');

	// by using 'socket.broadcast' we can send/emit
	// a message/event to all other clients except
	// the sender himself
	socket.broadcast.to(room).emit('presence', { client: chatClients[socket.id], state: state, room: room });
}

// unique id generator
function generateId(){
	var S4 = function () {
		return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
	};
	return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
}

// show a message in console
console.log('Chat server is running and listening to port %d...', port);