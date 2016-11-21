'use strict';

let CreepBase = require('class.creep.base');
let helpers = require('helpers');
let log = require('logger');
helpers.setLogger(log);

class CreepFixer extends CreepBase {
  constructor(role = 'fixer', parts = [WORK, CARRY, CARRY, MOVE, MOVE]) {
    super(role, parts);

    this.tasks = [
      'fix',
      'harvest'
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
