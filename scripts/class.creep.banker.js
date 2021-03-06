'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepBanker extends CreepBase {
  constructor(role = 'banker', parts = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'transferResources',
      'transferStorage',
      'pickup',
      'fillup'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `hoarding energy is a solid investment strategy`);

    super.activate();

    log.finish(`the security of my storage is second to none`);
  }
}

module.exports = CreepBanker;
