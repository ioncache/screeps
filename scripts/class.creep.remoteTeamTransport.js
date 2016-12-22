'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepRemoteTeamTransporter extends CreepBase {
  constructor(role = 'courier', parts = [
    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE
  ]) {
    super(role, parts);
    this.tasks = [
      'remoteTeamFillup'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `...`);

    super.activate();

    log.finish(`???`);
  }
}

module.exports = CreepRemoteTeamTransporter;
