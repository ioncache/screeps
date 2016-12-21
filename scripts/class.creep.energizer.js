'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepEnergizer extends CreepBase {
  constructor(role = 'energizer', parts = [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'transferTower',
      'withdrawUpgrade',
      'fillup'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `Hey McFly, you bojo, those boards don't work on water! `);

    super.activate();

    log.finish(`Unless you've got POWER!`);
  }
}

module.exports = CreepEnergizer;
