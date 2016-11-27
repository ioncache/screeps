'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepLongHauler extends CreepBase {
  constructor(role = 'longHauler', parts = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'transferStorage',
      'fillup'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `breaker breaker, shaking the bushes`);

    super.activate();

    log.finish(`headin' out on the big slab now`);
  }
}

module.exports = CreepLongHauler;
