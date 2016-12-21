'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepRemoteHarvester extends CreepBase {
  constructor(
    role = 'remoteHarvester',
    parts = [
      WORK, WORK, WORK, WORK, WORK,
      CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
      MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE
    ]
  ) {
    super(role, parts);
    this.tasks = [
      'remoteHarvest'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `braving unknown caverns for months`);

    super.activate();

    log.finish(`to bring you the tastiest of energy`);
  }
}

module.exports = CreepRemoteHarvester;
