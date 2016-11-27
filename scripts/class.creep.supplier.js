'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepSupplier extends CreepBase {
  constructor(role = 'supplier', parts = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'transferResources',
      'transferUpgrade',
      'pickup',
      'fillup'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `you need supplies to do some upgradin'?`);

    super.activate();

    log.finish(`the suppliers union has you covered`);
  }
}

module.exports = CreepSupplier;
