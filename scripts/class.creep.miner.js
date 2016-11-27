'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepMiner extends CreepBase {
  constructor(role = 'miner', parts = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'mine'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `there's gold in them there hills!`);

    super.activate();

    log.finish(`and by golly I'm gonna get rich on it`);
  }
}

module.exports = CreepMiner;
