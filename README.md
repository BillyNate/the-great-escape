# The Great Escape

The Great Escape is an in-browser location based online multiplayer game. The game cannot be played singleplayer; it requires a group of people to be in the same area.  
One player starts a new game and sends out invites to others to join his game. The game can be started when all players have joined and are ready to play.  
One of the players is the fugitive, just escaped from prison, trying to get to an extraction point while gathering enough money to leave the area.
The other players are cops hunting down the fugitive.

### Technical
The game is an in-browser (JavaScript) game, running on the client. It connects to a Firebase Realtime Database in order to share the data between all clients.  
Before the game starts it checks the client for location access and notifications.

### Setup
1. Make sure you've installed [Node.js](https://nodejs.org) (including NPM) and the Firebase CLI tools (`npm install -g firebase-tools`)
2. Open up the [Firebase console](console.firebase.google.com) and create a new project
3. In the project go to `Authentication`, `Set up sign-in method` and enable `Anonymous`
4. Clone this repository to your local drive
5. Open up a terminal (a.k.a. command prompt) on your workstation and navigate to the cloned repository directory
6. Initialize a Firebase project:
   - `firebase init`  
   - Enable the `Database` and the `Hosting`
   - Set the just created project as the default
   - Set `database.rules.json` as Database rules, don't overwrite
   - Set `pages` as the public hosting directory, it's a single page app, don't overwrite `pages/index.html`
7. Download `/__/firebase/init.js` from your firebase project url (`*.firebaseapp.com`) and save it in the root directory as `firebase.init.js`
8. Install all required node modules: `npm install`
9. Run a development or production build: `npm run build:dev` or `npm run build:prod`
10. Push the database and its rules to the server: `npm run push:db`
11. Push the static content to the server: `npm run push:pages`

### Contributing
If you found a bug, got an idea for an improvement or some other comment, please feel free to open up an issue on the issues page.  
It would be even better if you would fix the bug or create the improvement yourself and share your changes by means of a pull request.  
Just fork this repository, clone it to your local workstation, create a new branch, make the changes, push it and create a pull request.

### Thanks
None of this would possible without the generosity of various creators of free content:
- [Game-icons.net](https://game-icons.net)
- [Material Design](https://material.io/tools/icons)
- [Caroline Keyzor on FREEIMAGES](https://nl.freeimages.com/photographer/ckeyzor-44210)
- [Webpack](https://webpack.js.org)
- [jQuery](https://jquery.com)
- [Google Maps](https://maps.google.com)
- [Modernizr](https://modernizr.com)
- [Bowser](https://github.com/lancedikson/bowser)
- [Push](https://pushjs.org/)
- [Computer Sleep](https://github.com/ivanmaeder/computer-sleep)
- [jQuery Fullscreen Plugin](https://github.com/kayahr/jquery-fullscreen-plugin)
- [Slip.js](https://kornel.ski/slip)
- [Firebase (Spark Plan)](https://firebase.google.com)
- And probably some more...