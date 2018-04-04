# Beyond: Cutting-Edge Edition
A chat program for roleplaying, to support multiple characters, actions, and expressions.

This version releases the locks of a short module list, allowing and having large functionality which is mostly maintained by (GameMaster85)[https://github.com/GameMaster85]. Features of the master branch will be merged often, but this branch will have extra stuff that might not be as "light" as the normal one. This version will try to merge as much as possible with the master version.

Set up is fairly simple (though it will require node and npm to work); just:

* [`Install node.js with npm`](https://nodejs.org/en/)
* Make sure your port of choice is forwarded for TCP/UDP
* Put the files in a folder
* Navigate to that folder with your command line ('cd C:\Users\[yourname]\Beyond' for instance)
* Use 'npm install' in the command line to acquire the needed node modules. This might take a bit due to the nature of this version of Beyond.
* Use 'node index.js [portnumber]' to start the server (0 or no number for a random port)
* Access the server with any modern browser using the IP address and port.

The server will make all other needed files for saving and management in the folder itself.

# Current Added Features

**INI Configuration** - a config.ini file now exists. This will probably contain hard-coded server-configurable information, like the discord webhooks, among other things.

**Discord Integration** - Set up webhooks on a discord server, then get their ID and Token from it's link. Plug in two for both OOC and IC channels, and they will relay all messages and posts to the discord. The post made on discord will change it's name and avatar to the character's name and current face icon. For the face icons to appear appropriately, make sure to put in your IP:PORT (or hostname:port) in the servaddress config variable.