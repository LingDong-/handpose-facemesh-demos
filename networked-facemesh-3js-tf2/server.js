// server.js
// where everyone's data got sent to everyone else


const express = require("express");
const app = express();
var server = app.listen(process.env.PORT || 300);

// make all the files in 'public' available
//// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

var io = require('socket.io')(server);

var serverData = {}; // everyone's data

function newConnection(socket){
	console.log('new connection: ' + socket.id);
  
  socket.on('client-start', onClientStart);
	socket.on('client-update', onClientUpdate);
	socket.on('disconnect', onClientExit);

  // client is ready
	function onClientStart(){
    // uncomment to send an update every 10 milliseconds
		// currently we will be sending update every time
    // the client updates us, to avoid wasting resources
		// setInterval(function(){
		// 	socket.emit('server-update', serverData);
		// }, 10);
	}
  
  // client is sending us an update
	function onClientUpdate(data){
    serverData[socket.id] = data;
    
    // we update them too
    socket.emit('server-update', serverData);
	}
  
  // bye bye
	function onClientExit(){
    delete serverData[socket.id];
    console.log(socket.id+' disconnected');
	}
}	

console.log("listening...")
io.sockets.on('connection', newConnection);

