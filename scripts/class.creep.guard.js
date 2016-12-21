'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepGuard extends CreepBase {
  constructor(role = 'guard', parts = [
    TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK
  ]) {
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
