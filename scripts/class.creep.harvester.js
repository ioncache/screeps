'use strict';

let CreepBase = require('class.creep.base');
let helpers = require('helpers');
let log = require('logger');

class CreepHarvester extends CreepBase {
  constructor(role = 'harvester', parts = [WORK, WORK, CARRY, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'renew',
      'pickup',
      'harvest',
      'transfer'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `lookin' to do some harvestin'`);

    super.activate();

    log.finish(`might have harvested, might not have`);
  }
}

module.exports = CreepHarvester;
