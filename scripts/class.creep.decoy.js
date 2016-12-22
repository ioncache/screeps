'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepDecoy extends CreepBase {
  constructor(
    role = 'decoy',
    parts = [
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE,
      HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
      HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL
    ]
  ) {
    super(role, parts);
    this.tasks = [
      'renew',
      'decoy'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `go ahead and hit me`);

    super.activate();

    log.finish(`won't make a lick a' difference`);
  }
}

module.exports = CreepDecoy;
