# PA Game Night Backend
This backend code is hosted at https://fast-retreat-55590.herokuapp.com/.
To see it in action with the frontend code, visit https://blooming-coast-46890.herokuapp.com/.

## Overview
The goal of this project is to help assign users to games during an event to maximize the number of users who can play their preferred games. This backend code is responsible for the functionality of adding a user, removing a user, getting a user's preferred games, updating a user's preferred games, adding a game, deleting a user from a game, and matching users to games. The data is stored in a SQLite database. To implement real-time updating, the code uses a Websocket connection.

### Matching Users
The most involved action in this code is matching users to games given user rankings for games. This is done with the following:
1. Filter out games where the players interested in the game is less than the minimum number of players required for the game.
   - Ex. If Game A needs a minimum of 4 players, and it only got rankings from 3 users, it would be filtered out.
2. Create a power set of the remaining games.
3. Filter out sets of games where the minimum number of players cannot possibly be reached. 
   - Ex. Suppose set S contains games A and B, where A and B need one minimum player each. Suppose only user U was interested in both of these games. S would be filtered out, as user U can only be assigned to one of these games, leaving the other game not adequately filled.
4. Run the minimum-cost maximum-flow algorithm on each remaining set of games.
   - For more information, see https://developers.google.com/optimization/flow/mincostflow.
5. For each set for which the algorithm was run on, find the set with the maximum users matched. If there are two sets with the same number of maximum users matched, take the set with the least cost (higher ranking score overall).
6. Store data in the database and return it to the frontend.

## Local Use
Clone this repo, run `npm install` and `npm start`.
Assuming there is a local frontend instance running (see https://github.com/rohitppathak/pa-game-night-frontend/blob/master/README.md), change the `"HOST"` of src/env.json to `localhost:3001` and rerun.

## Authors
The initial code was written by Kevin Zhang, Jean Zhang, and Cristina Rong here: https://github.com/christinarong/pa-game-night. Andrew McCann and I built upon the original code to add more features.
