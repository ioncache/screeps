'use strict';

let CreepBase = require('class.creep.base');
let helpers = require('helpers');
let log = require('logger');
helpers.setLogger(log);

class CreepUpgrader extends CreepBase {
  constructor(role = 'upgrader', parts = [WORK, WORK, CARRY, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'upgrade',
      'withdraw'
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
