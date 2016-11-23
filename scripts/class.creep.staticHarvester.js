'use strict';

let CreepBase = require('class.creep.base');
let helpers = require('helpers');
let log = require('logger');

class CreepStaticHarvester extends CreepBase {
  constructor(role = 'staticHarvester', parts = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'staticHarvest'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `all I do is harvest`);

    super.activate();

    log.finish(`it fulfills me like nothing else`);
  }
}

module.exports = CreepStaticHarvester;
