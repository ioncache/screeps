'use strict';

let CreepBase = require('class.creep.base');
let helpers = require('helpers');
let log = require('logger');
helpers.setLogger(log);

class CreepBuilder extends CreepBase {
  constructor(role = 'builder', parts = [WORK, CARRY, CARRY, MOVE, MOVE]) {
    super(role, parts);

    this.tasks = [
      'build',
      'fix',
      'harvest'
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
