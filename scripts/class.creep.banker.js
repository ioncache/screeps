'use strict';

let CreepBase = require('class.creep.base');
let helpers = require('helpers');
let log = require('logger');
helpers.setLogger(log);

class CreepBanker extends CreepBase {
  constructor(role = 'harvester', parts = [WORK, WORK, CARRY, CARRY, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'harvest',
      'deposit'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `must save all the energy`);

    super.activate();

    log.finish(`hope no one takes it from my storage`);
  }
}

module.exports = CreepBanker;
