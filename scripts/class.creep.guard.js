'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepGuard extends CreepBase {
  constructor(role = 'guard', parts = [TOUGH, MOVE, RANGED_ATTACK]) {
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
