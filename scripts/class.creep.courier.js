'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepCourier extends CreepBase {
  constructor(role = 'staticHarvester', parts = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'transferResources',
      'transfer',
      'pickup',
      'fillup'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `guaranteed* delivery tomorrow before noon`);

    super.activate();

    log.finish(`*guarantee not a real guarantee`);
  }
}

module.exports = CreepCourier;
