'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepBuilder extends CreepBase {
  constructor(role = 'builder', parts = [WORK, WORK, CARRY, CARRY, MOVE, MOVE]) {
    super(role, parts);

    this.tasks = [
      'renew',
      'build',
      'fix',
      'getWorkEnergy'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `I like to build it, build it`);

    super.activate();

    log.finish(`do you like to build it, build it`);
  }
}

module.exports = CreepBuilder;
