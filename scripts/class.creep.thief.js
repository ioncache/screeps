'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepThief extends CreepBase {
  constructor(role = 'thief', parts = [
    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
  ]) {
    super(role, parts);
    this.tasks = [
      'steal',
      'transferResources',
      'transferMasterStorage'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `I've got my fingers in your cookie jar`);

    super.activate();

    log.finish(`mmm cookies, om, nom, nom`);
  }
}

module.exports = CreepThief;
