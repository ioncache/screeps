'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepCarter extends CreepBase {
  constructor(role = 'carter', parts = [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'transferResources',
      'withdrawResources'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `lugging minerals... golly why me?`);

    super.activate();

    log.finish(`wonder what I could get on the open market for these`);
  }
}

module.exports = CreepCarter;
