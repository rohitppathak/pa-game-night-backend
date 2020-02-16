const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const _ = require('lodash');

const Dao = require('./data/Dao');
const GameRepository = require('./data/GameRepository');
const UserRepository = require('./data/UserRepository');
const GameUserRankingsRepository = require('./data/GameUserRankingsRepository');
const AssignedUserGameRepository = require('./data/AssignedUserGameRepository');

const WebSocketServer = require('websocket').server;
const http = require('http');
const httpServer = http.createServer((request, response) => {
});
httpServer.listen(process.env.PORT || 3002);
const wsServer = new WebSocketServer({httpServer: httpServer});
const clients = [];

wsServer.on('request', async (request) => {
  const connection = request.accept(null, request.origin);
  clients.push(connection);
  await sendDataToClients();
});

async function sendDataToClients() {
  const gamesData = await gameRepo.getAll();
  for (const game of gamesData) {
    const interestedPlayers = await gameUserRankingsRepo.getInterestedPlayersForGame(
        game.id);
    game.interestedPlayers = interestedPlayers;
  }
  const userList = await userRepo.getAll();
  const users = userList.map(user => {
    return user.username;
  });
  const gameMappings = {
    gamesData,
    users
  };
  for (const client of clients) {
    client.sendUTF(JSON.stringify(gameMappings));
  }
}

const app = express();
const port = 3001;
let server;

global.gameMappings = require("./static/Games.json");

app.use(bodyParser.json());
app.use(cors());

const dao = new Dao("./gameDB.sqlite3");
const gameRepo = new GameRepository(dao);
const userRepo = new UserRepository(dao);
const gameUserRankingsRepo = new GameUserRankingsRepository(dao);
const assignedUserGameRepo = new AssignedUserGameRepository(dao);

// for (const game of global.gameMappings.gameList) {
//   gameRepo.create(game);
// }

async function main() {
  await gameRepo.createTable();
  await userRepo.createTable();
  await gameUserRankingsRepo.createTable();
  await assignedUserGameRepo.createTable();

  app.delete('/users/:userName', removeUser);
  app.post('/users/:username', addUser);
  app.get('/users/:username', getUserSelections);

  app.post('/games', updateGameMappings);
  app.put('/games', addGame);

  app.delete('/games/:gameId/users/:userId', deleteUserFromGame);

  app.get('/matchUsers', findAllGameUserCombinations);

  server = app.listen(port);
  await sendDataToClients();
}

const addUser = async (req, res) => {
  const username = req.params.username;
  try {
    await userRepo.create(username);
    console.log('Created user: ' + username);
    await sendDataToClients();
    res.send('success');
  } catch (error) {
    console.log("Username " + username + " already exists");
    res.send('failure');
  }
};

const getUserSelections = async (req, res) => {
  const username = req.params.username;
  const user = await userRepo.getByUsername(username);
  const userSelections = {};
  let success = false;
  if (user) {
    success = true;
    const userRankings = await gameUserRankingsRepo.getRankingsForUser(user.id);
    for (const userRanking of userRankings) {
      userSelections[userRanking.gameId] = userRanking.ranking;
    }
  }
  res.send({success, userSelections});
};

const removeUser = async (req, res) => {
  const userName = req.params.userName;
  const user = await userRepo.getByUsername(userName);
  await gameUserRankingsRepo.removeUserRankings(user.id);
  console.log('Deleted user rankings by user: ' + userName);
  await userRepo.deleteByUsername(userName);
  console.log("Deleted username: " + userName);
  await sendDataToClients();
  res.send();
};

const updateGameMappings = async (req, res) => {
  const {userSelections, userName} = req.body;

  const gameUserRankings = [];

  const user = await userRepo.getByUsername(userName);
  for (const gameId in userSelections) {
    if (userSelections.hasOwnProperty(gameId)) {
      const ranking = userSelections[gameId];
      gameUserRankings.push({gameId, userId: user.id, ranking});
    }
  }

  await gameUserRankingsRepo.removeUserRankings(user.id);

  console.log("Adding game rankings for user: " + userName);
  for (const gameUserRanking of gameUserRankings) {
    await gameUserRankingsRepo.create(gameUserRanking);
  }
  console.log("Added game rankings for user: " + userName);

  await sendDataToClients();
  res.send();
};

const addGame = async (req, res) => {
  const {name, estimatedTime, numPlayers, rulesComplexity, type, description, year, bggRank, boxArtFile, minPlayers, maxPlayers} = req.body;
  const game = {
    name,
    year,
    boxArtFile,
    estimatedTime,
    numPlayers,
    rulesComplexity,
    type,
    bggRank,
    description,
    minPlayers,
    maxPlayers
  };

  await gameRepo.create(game);
  console.log("Added game: " + name);
  await sendDataToClients();
  res.send();
};

const deleteUserFromGame = async (req, res) => {
  const gameId = req.params.gameId;
  const userId = req.params.userId;

  await gameUserRankingsRepo.deleteUserFromGame(gameId, userId);
  await gameUserRankingsRepo.updateRankingsForUser(userId);

  if ((await gameUserRankingsRepo.getRankingsForUser(userId)).length === 0) {
    await userRepo.deleteById(userId);
  }
  await sendDataToClients();
  res.send();
};

/**
 * Find, match, and return users to games using a Max-Flow Min-Cost algorithm.
 *
 * A little background: we have a list of users and a list of games. Users can
 * select up to three games that they want to play (by numbered ranking), and so
 * we also have a list of rankings from users to games. We want to find the
 * optimal pairing of users to games so that the maximum number of users can
 * play and their rankings for their respective games are as high as possible.
 */
const findAllGameUserCombinations = async (req, res) => {
  // filter out games where players interested < minimum players necessary for game
  const gamesWithEnoughInterest = await findGamesWithEnoughInterest();

  // generate the power set for all available games with enough interest
  const powerSetOfGamesWithEnoughInterest = generatePowerSet(
      gamesWithEnoughInterest);

  // filter out sets of games where the minimum players are too many for the users
  // for example, if there were two games, game A and game B, which needed a
  // minimum of one player for each game, and user U was interested in both
  // these games, this set of games would be filtered out, as user U cannot
  // be assigned to both games
  const setsOfGamesWhichCouldPossiblyBeAllPlayed = await filterOutSubsetsWithTooManyMinimumPlayers(
      powerSetOfGamesWithEnoughInterest);

  // create the necessary parameters to call the max-flow min-cost algorithm
  const gamesToUsersAllSets = [];
  const paramsForSets = [];
  const {spawn} = require("child_process");
  for (let i = 0; i < setsOfGamesWhichCouldPossiblyBeAllPlayed.length; i += 1) {
    const subset = setsOfGamesWhichCouldPossiblyBeAllPlayed[i];
    const params = buildMaxFlowMinCostParams(subset);
    paramsForSets.push(params);
  }

  // for all the game sets, call the max-flow min-cost algorithm, which is a
  // separate python script; we can use a Promise to wait till all the processes
  // have completed to take advantage of the fact we can spawn multiple python
  // processes simultaneously, which speeds up performance
  await new Promise((res) => {
    let setsRun = 0;
    for (let i = 0; i < setsOfGamesWhichCouldPossiblyBeAllPlayed.length; i += 1) {
      const {startNodes, endNodes, unitCosts, capacities, nodesToSupplies, nodesToDataObjects} = paramsForSets[i];
      const process = spawn('python',
          ['./src/data/MaxFlowMinCost.py', JSON.stringify(startNodes),
            JSON.stringify(endNodes), JSON.stringify(capacities),
            JSON.stringify(unitCosts), JSON.stringify(nodesToSupplies),
            JSON.stringify(nodesToDataObjects)]);
      process.stdout.on('data', (data) => {
        const gamesToUsersSet = JSON.parse(data.toString());
        const filteredGamesToUsersSetWithCost = removeGamesWithoutEnoughPlayers(gamesToUsersSet);
        gamesToUsersAllSets.push(filteredGamesToUsersSetWithCost);
        setsRun += 1;
        if (setsRun === setsOfGamesWhichCouldPossiblyBeAllPlayed.length) {
          res();
        }
      });
    }
  });

  // post-processing to find the optimal game-set, store this in the database,
  // and return it to the front-end
  const {playableGamesToUsers} = findOptimalGameSet(gamesToUsersAllSets);
  const allGames = await gameRepo.getAll();
  const allUsers = await userRepo.getAll();
  const {gamesWithUsers: allGamesWithUsers, unmatchedUsers} =
      addUsersToGames(allGames, playableGamesToUsers, allUsers);
  await assignedUserGameRepo.clearAll();
  await assignedUserGameRepo.insertAll(allGamesWithUsers);
  res.send({gameList: allGamesWithUsers, unmatchedUsers});
};

const findGamesWithEnoughInterest = async () => {
  const allGames = await gameRepo.getAll();
  const gamesWithEnoughInterest = [];
  for (const game of allGames) {
    const rankingsForGame = await gameUserRankingsRepo.getInterestedPlayersForGame(
        game.id);
    if (rankingsForGame.length >= game.minPlayers) {
      gamesWithEnoughInterest.push(game);
    }
  }
  return gamesWithEnoughInterest;
};

const generatePowerSet = (array) => {
  const result = [];
  result.push([]);
  for (let i = 1; i < (1 << array.length); i++) {
    const subset = [];
    for (let j = 0; j < array.length; j++) {
      if (i & (1 << j)) {
        subset.push(array[j]);
      }
    }
    result.push(subset);
  }
  return result;
};

const filterOutSubsetsWithTooManyMinimumPlayers = async (powerSet) => {
  const setsOfGamesWhichCouldPossiblyBeAllPlayed = [];
  for (const gameSubset of powerSet) {
    const gameSubsetRankings = await gameUserRankingsRepo.getRankingsForGames(
        gameSubset);
    let sumOfMinimumPlayers = 0;
    for (const game of gameSubset) {
      sumOfMinimumPlayers += game.minPlayers;
    }
    const leftoverPlayersCount = gameSubsetRankings.length
        - sumOfMinimumPlayers;
    if (leftoverPlayersCount >= 0) {
      setsOfGamesWhichCouldPossiblyBeAllPlayed.push(
          {gameSubset, gameSubsetRankings, leftoverPlayersCount});
    }
  }
  return setsOfGamesWhichCouldPossiblyBeAllPlayed;
};

const buildMaxFlowMinCostParams = ({gameSubset, gameSubsetRankings, leftoverPlayersCount}) => {
  const startNodes = [];
  const endNodes = [];
  const capacities = [];
  const unitCosts = [];
  const nodesToSupplies = {};
  const nodesToDataObjects = {};
  const gameIdMultiple = 1000;

  for (const ranking of gameSubsetRankings) {
    startNodes.push(ranking.userId);
    nodesToSupplies[ranking.userId] = 1;
    nodesToDataObjects[ranking.userId] = ranking;
    capacities.push(1);
    unitCosts.push(ranking.ranking);
    const gameIndex = ranking.gameId * gameIdMultiple;
    endNodes.push(gameIndex);

    if (!nodesToDataObjects[gameIndex]) {
      startNodes.push(gameIndex);
      nodesToSupplies[gameIndex] = ranking.minPlayers * -1;
      nodesToDataObjects[gameIndex] = ranking;
      capacities.push(ranking.maxPlayers - ranking.minPlayers);
      unitCosts.push(0);
      endNodes.push(0);
    }
  }

  nodesToSupplies[0] = leftoverPlayersCount * -1;

  return {
    startNodes,
    endNodes,
    unitCosts,
    capacities,
    nodesToSupplies,
    nodesToDataObjects
  };
};

const removeGamesWithoutEnoughPlayers = gamesToUsersSet => {
  const playableGamesToUsers = {};
  let totalUsers = 0;
  let rankingCost = 0;
  for (const [gameName, gameInfo] of Object.entries(gamesToUsersSet)) {
    if (gameInfo.user_list.length >= gameInfo.minPlayers) {
      playableGamesToUsers[gameName] = gameInfo;
      totalUsers += gameInfo.user_list.length;
      rankingCost += gameInfo.cost;
    }
  }
  return {playableGamesToUsers, totalUsers, rankingCost};
};

const findOptimalGameSet = gamesToUsersSets => {
  let optimalSet = { playableGamesToUsers: {}, totalUsers: 0, rankingCost: 0 };
  for (const gameToUserSet of gamesToUsersSets) {
    if (gameToUserSet.totalUsers > optimalSet.totalUsers ||
        (gameToUserSet.totalUsers === optimalSet.totalUsers &&
            gameToUserSet.rankingCost < optimalSet.rankingCost)) {
      optimalSet = gameToUserSet;
    }
  }
  return optimalSet;
};

const addUsersToGames = (allGames, gamesToUsers, allUsers) => {
  const gamesWithUsers = [];
  let matchedUsers = [];
  for (const game of allGames) {
    if (gamesToUsers[game.id]) {
      const assignedPlayers = gamesToUsers[game.id].user_list;
      game.assignedPlayers = assignedPlayers;
      matchedUsers = matchedUsers.concat(assignedPlayers);
      gamesWithUsers.push(game);
    }
  }
  const matchedUsersIds = new Set();
  for (const user of matchedUsers) {
    matchedUsersIds.add(user.id);
  }
  const unmatchedUsers = [];
  for (const user of allUsers) {
    if (!matchedUsersIds.has(user.id)) {
      unmatchedUsers.push(user);
    }
  }
  return {gamesWithUsers, unmatchedUsers};
};

main().then(async res => {
  await sendDataToClients();
});
