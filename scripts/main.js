'use strict';

let helpers = require('helpers');
let log = require('logger');

let RoomManager = require('class.manager.room');

let roomList = {};

module.exports.loop = function() {

  log.log('********************');
  log.log('***** NEW TICK *****');
  log.log('********************\n\n');

  for (let name in Memory.rooms) {
    if (!Game.rooms[name]) {
      delete Memory.rooms[name];
      delete roomList[name];
      log.log('Clearing non-existing room memory:', name);
    }
  }

  for (let name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      log.log('Clearing non-existing creep memory:', name);
    }
  }

  // ensure all rooms have a room manager instantiated
  for (let roomName in Game.rooms) {
    if (!roomList[roomName]) {
      let newRoom = new RoomManager(roomName);
      roomList[roomName] = newRoom;
    }

    roomList[roomName].manage();
  }

  log.log('\n\n');
};
