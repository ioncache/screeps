'use strict';

let CreepBase = require('class.creep.base');
let helpers = require('helpers');
let log = require('logger');
helpers.setLogger(log);

class CreepGuard extends CreepBase {
  constructor(role = 'guard', parts = [RANGED_ATTACK, MOVE, TOUGH]) {
    super(role, parts);
    this.tasks = [
      'guard',
      'patrol'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `the life of a creep guard`);

    super.activate();

    log.finish(`may not be the life for me`);
  }
}

module.exports = CreepGuard;