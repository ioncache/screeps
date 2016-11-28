'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepUpgrader extends CreepBase {
  constructor(role = 'upgrader', parts = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'upgrade',
      'withdrawUpgrade',
      'getWorkEnergy'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `man I love upgrading controllers`);

    super.activate();

    log.finish(`that controller is so, so upgraded`);
  }
}

module.exports = CreepUpgrader;
