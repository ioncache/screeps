'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepFixer extends CreepBase {
  constructor(role = 'fixer', parts = [WORK, WORK, CARRY, CARRY, MOVE, MOVE]) {
    super(role, parts);

    this.tasks = [
      'renew',
      'fix',
      'getWorkEnergy'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `a fixin' I will go, a fixin' I will go`);

    super.activate();

    log.finish(`hi-ho, the derry-o, a fixin' I will go`);
  }
}

module.exports = CreepFixer;
