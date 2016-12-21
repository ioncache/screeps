'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepRemoteTeamHarvester extends CreepBase {
  constructor(
    role = 'remoteTeamHarvester',
    parts = [
      WORK, WORK, WORK,
      CARRY,
      MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
    ]
  ) {
    super(role, parts);
    this.tasks = [
      'remoteTeamHarvest'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `farewell my family`);

    super.activate();

    log.finish(`I"m off to harvest the rest of my days`);
  }
}

module.exports = CreepRemoteTeamHarvester;
