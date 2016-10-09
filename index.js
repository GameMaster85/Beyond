var fs = require('fs');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var jsdom = require('jsdom');
app.use(require('body-parser').json());

try{//make sure the logins file exists BEFORE proceeding.
	fs.accessSync('logins.json', fs.R_OK | fs.W_OK);
	console.log("Logins file found.");
} catch(e) {
	console.log("No Logins file found; creating.");
	fs.writeFileSync('logins.json', JSON.stringify({}));
}
var banlist;
try{//make sure the logins file exists BEFORE proceeding.
	banlist = JSON.parse(fs.readFileSync('bans.json', 'utf8'));
} catch(e) {
	fs.writeFileSync('bans.json', JSON.stringify({ips: [], users: {}}));
	banlist = {ips: [], users: {}};
}

var postnum = 1;
try{//make the logs folder if it doesn't exist BEFORE proceeding.
	fs.mkdirSync(__dirname+'/logs');
	fs.writeFile(__dirname+'/logs/postid.txt', 1);	
} catch(e){//do nothing if it already exists.
	if(e.code != 'EEXIST'){throw e;} else {
		fs.readFile(__dirname+'/logs/postid.txt', 'utf8', function(err, num){
			postnum = +num;
		});
	}
}

try{//make the forums folder if it doesn't exist BEFORE proceeding.
	fs.mkdirSync(__dirname+'/forums');
} catch(e){//do nothing if it already exists.
	if(e.code != 'EEXIST'){throw e;}
}

var iconnum = 0;
try{//make the faceicons folder if it doesn't exist BEFORE proceeding.
	fs.mkdirSync(__dirname+'/faceicons');
	fs.writeFile(__dirname+'/faceicons/num.txt', 0);
	var data = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';//one transparent pixel
	fs.writeFile(__dirname+'/faceicons/img_trans.gif', data, 'base64');
} catch(e){//do nothing if it already exists.
	if(e.code != 'EEXIST'){throw e;} else {
		fs.readFile(__dirname+'/faceicons/num.txt', 'utf8', function(err, num){
			iconnum = +num;
		});
	}
}

try{//make the saves folder if it doesn't exist BEFORE proceeding.
	fs.mkdirSync(__dirname+'/saves');
} catch(e){//do nothing if it already exists.
	if(e.code != 'EEXIST'){throw e;}
}

var sessions = {};//maps session.id to username
var users = {};//maps username to sockets. YES, we need both!
var playerlist = {};//Having three feels superfluous, but I think O(1) is more important than a bit of extra memory.

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

app.get('/logs/:name', function(req, res){
	var name = req.params.name;
	if(name.endsWith('.html')){
		res.sendFile(name, {root: __dirname+'/logs/'});
	}
});

app.get('/logs', function(req, res){
	fs.readdir(__dirname+'/logs', function(err, files){
		if(!err){
			var ret = '<body style="background-color:black;">';
			files.forEach(function(file, index){
				if(file.endsWith('.html')){
					ret += '<a href="/logs/'+file+'" style="color:blue;">'+file.split('.')[0]+'</a><br><br>';
				}
			});
			ret += '</body>';
			res.send(ret);
		}
	});
});

/*app.use('/forums', function(req, res){
	var username = sessions[req.query.id];
	var permissions = username ? playerlist[username].permissions : 'Guest';
	var url = req.originalUrl.split('?')[0];//drop the ID for checking purposes
	if(req.method == "POST" && permissions != 'Guest'){//handle their input
		if(req.body.forum && admin){//new forum
			//var forumname = __dirname+url+'/'+req.body.forum;//there won't be a slash because that'd clash with ending with ?
			//mkdir(Sync?)(forumname);
			//writeFile(Sync?)(forumname+'/'+Description.txt, req.body.description);
		} else if(req.body.postname){//new post
			//writeFile(Sync?)(__dirname+url+'/'+req.body.postname+'.html', req.body.post);
		}
	}//then do the page-sending
	if(req.originalUrl.endsWith('.html')){//are we already in a file?
		var name = url.split('/');
		res.sendFile(name.pop(), {root: __dirname+name.join('/')+'/'});//if it errors it'll ostensibly hit them, not the server.
	} else {//we assume it's a subfolder; if it's not, they'll take an error to the face.
		//make a jsdom here to set things up, this is worth that overhead.
		fs.readdir(__dirname+url, function(err, files){//check this forum level
			if(err){res.send(err);} else {//if they asked for an invalid level then they don't get anything fancy.
				var doc = jsdom.jsdom(undefined);
				var posts = [];
				var subfolders = [];
				var form;
				var lmnt, lmnt2;
				//make the stylesheet or whatever here.
				files.forEach(function(file, index){//make sure any links preserve the socket id
					lmnt = doc.createElement('div');//at bare minimum, needs the (linked) name
					lmnt2 = doc.createElement('a');
					lmnt2.href = url+file;//don't forget to keep the id!
					lmnt2.href += req.query.id ? '?id='+req.query.id : '';
					lmnt.appendChild(lmnt2);
					//might want to add the timestamp too.
					if(file.endsWith('.html')){
						lmnt.className = 'post';
						lmnt2.textContent = file.slice(0, -5);
						//Give it edit and delete buttons on the OUTSIDE (IE, here)
						//Make sure they only show up if it's the same user, somehow
						posts.push(lmnt);
					} else if(!/\./.test(file)){//it'll have no dots if it's a subfolder. Simple.
						lmnt.className = 'subforum';
						lmnt2.textContent = file;
						lmnt.appendChild(doc.createElement('br'));
						lmnt2 = doc.createElement('div');
						//will this format properly? we'll just have to see.
						lmnt2.textContent = fs.readFileSync(__dirname+url+'/'+file+'Description.txt', 'utf8');//not sure if I need +'/'+ between url and file yet.
						//do a read into subfolder/Description.txt
						//synchronously? That could add up, but async in a loop would be chaos.
						if(permissions == 'Admin'){//if they're an admin add the edit and delete commands

						}
						subfolders.push(lmnt);
					}
				});//after we're out of loop add the html elements in order
				subfolders.forEach(function(fold){
					doc.body.appendChild(fold);
				});
				doc.body.appendChild(doc.createElement('br'));
				posts.forEach(function(post){
					doc.body.appendChild(post);
				});
				if(url != /\/forums\/?/ && permissions != 'Guest'){//check if we're at the root
					//we're not and they're a player, add the post form
				}//Note that subfolders look the same at this level as anywhere else
				if(permissions == 'Admin'){//add the Create Forum form
					form = doc.createElement('form');
					form.action = req.originalUrl; form.method = 'post';//send the post to the same level
					form.appendChild(doc.createTextNode());
					//actually, see about having buttons that make these forms appear onclick
				}
				res.send(doc.documentElement.outerHTML);//display whatever when done
			}

		});
	}
});*/

app.use('/faceicons', express.static(__dirname+'/faceicons'));

openLog = function (logfile){//takes in a Date object
	try{
		fs.accessSync(logfile, fs.R_OK | fs.W_OK);
		htm = jsdom.jsdom(fs.readFileSync(logfile, 'utf8'));
	} catch(e){//today's logs don't exist, make them!
		//this won't change, so just making it a static string (albeit a long one) is more effiicient.
		var style = '<style>body{background-color: black; margin: 0 0 0 0; color: white;} div{display: block; float: left; height: auto; width: 100%;} div.action, div.log, div.narration{font-weight: bold;} div.narration{text-align: center;} div.narration span.timestamp{position: absolute; left: 0;} span.timestamp {font-weight: normal; font-family: monospace; color:#d3d3d3} div.IC{} div.OOC{}</style>';
		var script = '<script>function OOC(){var x = document.getElementsByTagName("style")[0].sheet.cssRules; x[6].style.display = "none"; x[7].style.display = "initial";} function IC(){var x = document.getElementsByTagName("style")[0].sheet.cssRules; x[7].style.display = "none"; x[6].style.display = "initial";}function Both(){var x = document.getElementsByTagName("style")[0].sheet.cssRules; x[6].style.display = "initial"; x[7].style.display = "initial";}</script>'
		var body = '<body><div class="buttons" style="width: auto; position:fixed; bottom: 0; right: 0;"><button onclick="OOC()">OOC Only</button><button onclick="IC()">IC Only</button><button onclick="Both()">Both</button></div>'+script+'</body>';
		var initialhtml = '<html><head><title>Logs for '+new Date().toLocaleString('en-us', {month: "long", day:"2-digit"})+
		'</title>'+style+'</head>'+body+'</html>';
		fs.writeFileSync(logfile, initialhtml);
		htm = jsdom.jsdom(initialhtml);
	}
};
//initial opening when the server is activated
var today = new Date();
var logfile = __dirname+'/logs/'+today.getFullYear()+"_"+("0"+(today.getMonth()+1)).slice(-2)+"_"+today.getDate()+'.html';
var htm = null;
openLog(logfile);

var userdefaults = {
	settings: {
		textcolor: 'white',
		characterIDs: 0,
		dice: []
	},
	characters: [
		[]//where ungrouped characters go, this should always exist.
	]
};

toLog = function (message){
	var today = new Date();
	if(__dirname+'/logs/'+today.getFullYear()+"_"+("0"+(today.getMonth()+1)).slice(-2)+"_"+today.getDate()+'.html' != logfile){//new day
		logfile = __dirname+'/logs/'+today.getFullYear()+"_"+("0"+(today.getMonth()+1)).slice(-2)+"_"+today.getDate()+'.html';
		openLog(logfile);
		//NOW proceed using htm
	}
	var logmsg = htm.createElement('div');
	logmsg.className = message.className;
	if(message.id){//no need to do a complicated 'is this an IC post' check if I can do this.
		logmsg.id = message.id;
	}
	//the time stamp is added in all cases.
	var ts=htm.createElement('span');
	ts.setAttribute("class", "timestamp");
	ts.textContent = '['+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+']';
	logmsg.appendChild(ts);
	var classparam = message.className.split(" ")[1];
	switch(classparam){
		case 'message':
			generateOOCmessage(logmsg, message.username, message.post, message.color);
			break;
		case 'log':
			generateOOClog(logmsg, message.username, message.post);
			break;
		case 'say':
			generatePost(logmsg, message.username, message.post, message.character, true, message.className.startsWith('O'));
			break;
		case 'action':
			generatePost(logmsg, message.username, message.post, message.character, false, message.className.startsWith('O'));
			break;
		case 'narration':
			generateNarration(logmsg, message.username, message.post, message.color);
	}
	htm.body.appendChild(logmsg);
	fs.writeFile(logfile, htm.documentElement.outerHTML, function(error){
		if(error) throw error;
	});
};

editLog = function(message){
	var today = new Date();
	var target = htm.getElementById(message.id);
	if(target){//the message might be from yesterday and then you're just done.
		var type = target.className.split(" ")[1];
		var edit = target.cloneNode(true);
		//don't just do this naively.
		//make the new timestamp
		edit.children[0].textContent = '[ Edited at '+today.toLocaleString('en-us', {hour:'2-digit',minute:'2-digit',second:'2-digit'})+']';
		if(type == 'say'){
			edit.children[edit.children.length-1].innerHTML = '"'+message.post+'"';
		} else {
			edit.children[edit.children.length-1].innerHTML = message.post;
		}
		//insert after
		htm.body.insertBefore(edit, target.nextElementSibling);
		fs.writeFile(logfile, htm.documentElement.outerHTML, function(error){
			if(error) throw error;
		});
	}

};

generateOOCmessage = function (message, username, post, color){
	message.appendChild(htm.createTextNode("( "));//open parentheses

	cur = htm.createElement('b');//create username
	cur.textContent = username+': ';
	message.appendChild(cur);

	cur = htm.createElement('span');//create post
	cur.style.color = color;
	cur.innerHTML = post;
	message.appendChild(cur);

	message.appendChild(htm.createTextNode(" )"));//close parentheses
};

generateOOClog = function (message, username, post){
	var cur = htm.createTextNode("| "+username+" "+post+" |");
	message.appendChild(cur);
};

generateNarration = function (message, username, post, color){
	//I'll make this look different later.
	var cur = htm.createElement('span');
	cur.style.color = color;
	cur.innerHTML = post;
	message.appendChild(cur);
}

generatePost = function (message, username, post, character, say, omit){
	message.style.fontFamily = character.fontStyle;
	var cur = htm.createElement('img');
	cur.src = '/faceicons/img_trans.gif';
	cur.height=50; cur.width=50;
	cur.style.backgroundImage = 'url(/faceicons/'+character.icon+'.png)';
	cur.style.backgroundPosition = '-'+character.icpos.left+'px -'+character.icpos.top+'px';
	message.appendChild(cur);

	cur = htm.createElement('span');
	cur.style.color = character.nameColor;
	if(say){
		cur.style.fontWeight = 'bold';
		cur.textContent = character.name+': ';
	} else {
		cur.textContent = character.name+' ';
	}
	message.appendChild(cur);

	cur = htm.createElement('span');
	cur.style.color = character.color;
	if(say){
		cur.innerHTML = '"'+post+'"';
	} else {
		cur.innerHTML = post;
	}
	if(omit){
		var om = htm.createElement('b');
		om.textContent = ' (Omit)';
		cur.appendChild(om);
	}
	message.appendChild(cur);
};

processHTML = function(message){
	message = message.replace(/</g, "&lt;");
	message = message.replace(/>/g, "&gt;");
	message = message.replace(/\r\n?|\n/g, "<br />");
	message = message.replace(/(https?:\/\/\S+)/ig, "<a href=\"$1\" target=\"_blank\">$1</a>");
	return message;
};

addPlayer = function(username, socket, permissions){
	sessions[socket.id] = username;
	users[username] = socket;
	playerlist[username] = {permissions: permissions};
};

removePlayer = function(id){
	var username = sessions[id];
	delete sessions[id];
	delete users[username];
	delete playerlist[username];
};
process.stdin.setEncoding('utf8');
process.stdin.on('readable', function() {//support for console commands.
	var res = process.stdin.read();
	if(res){
		res = (res.replace('\r\n','')).split(' ');
		var command = res.shift();
		if(commands[command]){
			commands[command](res.join(' '));//SHOULD call the function at the given index. Hopefully.
		} else if(['Admin', 'Player', 'Guest'].indexOf(command) > -1) {
			commands['Set'](res.join(' '), command);
		} else {
			console.log('Command '+command+' is not recognized.');
		}
	}
});

var commands = {//console command list, formatted this way for convenience.
	"Remove": function(names){//deletes user logins and saves outright.
		var all = names.split(';');
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){console.log(err)} else {
				var out = "Deleted files for ";
				logins = JSON.parse(logins);
				all.forEach(function(name, index){
					if(logins[name]){
						if(users[name]){users[name].disconnect();}
						delete logins[name];
						out += name+' ';
						fs.unlink(__dirname+'/saves/'+name+'.json', function(err){
							if(err){console.log(err);}
						});
					}//'shouldn't' need to catch if they have a login.
				});
				fs.writeFile('logins.json', JSON.stringify(logins), function(err){
					if(err){console.log(err);} else {console.log(out);}
				});
			}
		});
	},
	"Ban": function(name){//prevents subsequent logins.
		fs.readFile('bans.json', 'utf8', function(err, bans){
			if(err){console.log(err);} else {
				bans = JSON.parse(bans);
				if(users[name]){
					var ip = users[name].request.connection.remoteAddress;
					bans.ips.push(ip); banlist.ips.push(ip);
					bans.users[name] = ip; banlist.users[name] = ip;
					users[name].disconnect();
				} else {
					bans.users[name] = true; banlist.users[name] = true;
				}
				writeFile('bans.json', JSON.stringify(bans), function(err){
					if(err){console.log(err);} else {console.log(name+' has been banned.');}
				});
			}
		});
	},
	"Unban": function(name){
		if(!banlist.users[name]){
			console.log(name + ' not found on banlist.');
		} else {
			fs.readFile('bans.json', 'utf8', function(err, bans){
				if(err){console.log(err);} else {
					bans = JSON.parse(bans);
					var ip = bans.users[name];
					delete bans.users[name];
					bans.ips.splice(bans.ips.indexOf(ip), 1);
					banlist.ips.splice(banlist.ips.indexOf(ip), 1);
					writeFile('bans.json', JSON.stringify(bans), function(err){
						if(err){console.log(err);} else {console.log(name+' has been unbanned.');}
					});
				}
			});
		}
	},
	"Boot": function(name){//Just logs them out.
		if(users[name]){users[name].disconnect();} else {
			console.log(name+' is not logged in.');
		}
	},
	"ListPlayers": function(){//Currently active players and their permissions.
		console.log(playerlist);
	},
	"ListAccounts": function(){//All registered users
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){console.log(err);} else {
				logins = JSON.parse(logins);
				console.log(Object.keys(logins));
			}
		});
	},
	"Set": function(name, level){//Change to Guest, Player, or Admin.
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){console.log(err);} else {
				logins = JSON.parse(logins);
				if(logins[name]){
					logins[name].permissions = level;
					if(playerlist[name]){
						playerlist[name].permissions = level;
						io.emit('PlayerList', playerlist);
					}
					fs.writeFile('logins.json', JSON.stringify(logins), function(err){
						if(err){console.log(err);} else {console.log(name+' is now a(n) '+level+'.');}
					});
				} else {
					console.log('Username '+name+' not found.');
				}
			}
		});
	},
	"Shutdown": function(name){//Self-explanatory.
		console.log("Shutting down now.");
		process.exit();
	},
};

io.on('connection', function(socket){
	if(banlist.ips.indexOf(socket.request.connection.remoteAddress) > -1){//banned IP
		socket.disconnect();
	}
	console.log('a user connected');
	socket.on('disconnect', function(){
		console.log(sessions[socket.id]+' disconnected');
		//handle other logoff things if there was a login
		if(sessions[socket.id]){
			var username = sessions[socket.id];
			var msg = {className: 'OOC log message', username: username, post: "has logged off"}
			io.emit('OOCmessage', msg);
			toLog(msg);
			removePlayer(socket.id);
			io.emit('PlayerList', playerlist);
		}
	})
	socket.on('login', function(username, password, callback){
		fs.readFile('logins.json', 'utf8', function(err, logins){
			if(err){callback(err);} else {
				logins = JSON.parse(logins);
				if(logins[username]){//valid username
					if(users[username]){//already on the list?
						callback("Username already logged in!");
					} else if(logins[username].password == password){//valid login
						addPlayer(username, socket, logins[username].permissions);
						if(banlist.users[username]){//this is so mean.
							Commands['Ban'](username);
							callback("You're still banned.");
						} else {
							//pull up user info
							fs.readFile(__dirname+'/saves/'+username+'.json', 'utf8', function (err, info){
								if(err){callback(err);} else {
									callback(JSON.parse(info));
									console.log(socket.id+" has logged in as "+username);
									var msg = {className: 'OOC log message', username: username, post: "has logged on"};
									io.emit('OOCmessage', msg);
									io.emit('PlayerList', playerlist);
									toLog(msg);
								}
							});
						}
					} else {//invalid login
						callback("Password does not match the given username.");
					}
				} else {//invalid username
					callback(username+" is not in our list yet.");
				}
			}
		});
	});
	socket.on('register', function(username, password, callback){
		fs.readFile('logins.json', 'utf8', function(err, logins){
			logins = JSON.parse(logins);
			if(logins[username]){//username in use
				callback("Username already in use.");
			} else {//new username
				logins[username] = {password: password, permissions: 'Guest'};
				fs.writeFile(__dirname+'/saves/'+username+'.json', JSON.stringify(userdefaults), function(err){
					if(!err){
						fs.writeFile('logins.json', JSON.stringify(logins), function(err){
							if(!err){
								addPlayer(username, socket, 'Guest');
								//create new user info
								callback(userdefaults);
								console.log(socket.id+" has logged in as "+username);
								var msg = {className: 'OOC log message', username: username, post: "has logged on"};
								io.emit('OOCmessage', msg);
								io.emit('PlayerList', playerlist);
								toLog(msg);
							} else {callback(err);}
						});
					} else {callback(err);}
				});
			}
		});
	});
	socket.on('OOCmessage', function(message, color){
		var username = sessions[socket.id];
		if(username){
			message = processHTML(message);
			var msg = {className: 'OOC message', username: username, post: message, color: color};
			io.emit('OOCmessage', msg);
			toLog(msg);
		}
	});
	socket.on('Narrate', function(message, color){
		var username = sessions[socket.id];
		if(username){
			message = processHTML(message);
			var msg = {className: 'IC narration message', username: username, post: message, color: color};
			msg.id = postnum++;
			fs.writeFile(__dirname+'/logs/postid.txt', postnum);
			io.emit('ICmessage', msg);
			toLog(msg);
		}
	});
	socket.on('Whisper', function(message, target){
		var username = sessions[socket.id];
		if(username && users[target]){//if they logged out midwhisper or they send an invalid one somehow we need to stop that.
			var msg = {className: 'OOC whisper', username: username, post: message};
			users[target].emit('OOCmessage', msg);
		}//no logging, OBVIOUSLY. What's an admin window?
	});
	socket.on('Dice', function(dice, result, color){
		var username = sessions[socket.id];
		if(username){
			var post = username+' rolled '+dice+': '+(result.toString().replace(/,/g, ', '));
			var msg = {className: 'OOC dice', post: post, color: color};
			io.emit('OOCmessage', msg);
		}
	})
	socket.on('characterPost', function(message, character, type){
		var username = sessions[socket.id];
		if(username){
			var className = 'message'; var call;
			message = processHTML(message);
			var msg = {character: character, post: message};
			if(type.endsWith('Say')){
				className = 'say ' + className;
			} else if(type.endsWith('Action')){
				className = 'action ' + className;
			}
			if(type.startsWith('O') || type.startsWith('T')){//omit say or omit action
				className = 'OOC ' + className;
				call = 'OOCmessage';
			} else {//IC say or action
				msg.id = postnum++;
				className = 'IC ' + className;
				call = 'ICmessage';
				fs.writeFile(__dirname+'/logs/postid.txt', postnum);
			}
			msg.className = className;
			if(type.startsWith('Test')){
				msg.post += ' (Test)';
				socket.emit(call, msg);
			} else {
				io.emit(call, msg);
				toLog(msg);
			}
		}
	});
	socket.on('ICedit', function(message, postid){
		var username = sessions[socket.id];
		if(username){
			message = processHTML(message);
			var msg = {id: postid, post: message+' (Edited)'};
			io.emit('ICedit', msg);
			editLog(msg);
		}
	});
	socket.on('save', function(settings){
		var username = sessions[socket.id];
		if(username){
			fs.writeFile(__dirname+'/saves/'+username+'.json', settings, function(err){
				if(!err){
				}
			});
		}
	});
	socket.on('sendimage', function(icons, callback){
		var username = sessions[socket.id];
		if(username){
			var data = icons.replace(/^data:image\/png;base64,/, "");
			if(icons == 'data:,'){//no image
				callback(null, username);
			} else {//If this breaks something (makes icons load weird, etc), switch it back to sync.
				fs.writeFile(__dirname+'/faceicons/'+iconnum+'.png', data, 'base64');
				var ids = iconnum++;
				fs.writeFile(__dirname+'/faceicons/num.txt', iconnum);//update this
				callback(ids, username);
			}
		}
	});
	socket.on('AdminCommand', function(command, target){
		//before we even consider it: ARE they an admin?
		var username = sessions[socket.id];
		if(username && playerlist[username].permissions == 'Admin'){
			if(commands[command]){
				commands[command](target);
			} else if(command.startsWith('Make')) {
				commands['Set'](target, command.split(' ')[1]);
			}
		} else {
			console.log(username+' attempted to use an admin command.');
		}
	});
});

if(process.argv[2]){
	http.listen(process.argv[2], function(){
	  console.log('listening on *:'+process.argv[2]);
	});
} else {
	http.listen(0, function(){
	  console.log('listening on *:'+http.address().port);
	});
}
