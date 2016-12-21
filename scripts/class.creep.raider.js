'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepRaider extends CreepBase {
  constructor(
    role = 'raider',
    parts = [
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE
    ]
  ) {
    super(role, parts);
    this.tasks = [
      'guard',
      'patrol'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `And I'm the world's forgotten boy`);

    super.activate();

    log.finish(`The one who's searchin', searchin' to destroy`);
  }
}

module.exports = CreepRaider;
