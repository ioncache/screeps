'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepStaticUpgrader extends CreepBase {
  constructor(role = 'upgrader', parts = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'staticUpgrade',
      'withdrawUpgrade'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `I could stand here all all day`);

    super.activate();

    log.finish(`I'll even do some upgradin' while I'm at it`);
  }
}

module.exports = CreepStaticUpgrader;
