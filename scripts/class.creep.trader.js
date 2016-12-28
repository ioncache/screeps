'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepTrader extends CreepBase {
  constructor(role = 'trader', parts = [
    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
  ]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'trade',
      'parking'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    if (
      creep.memory &&
      !creep.memory.tradeAmount
    ) {
      creep.memory.tradeAmount = 0;
    }

    if (
      creep.memory &&
      !creep.memory.tradeType
    ) {
      creep.memory.tradeType = null;
    }

    log.start(creep.name, `lugging minerals... golly why me?`);

    super.activate();

    log.finish(`wonder what I could get on the open market for these`);
  }
}

module.exports = CreepTrader;
