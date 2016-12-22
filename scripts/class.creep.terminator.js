'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepTerminator extends CreepBase {
  constructor(
    role = 'terminator',
    parts = [
      MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      ATTACK, ATTACK, ATTACK, ATTACK,
      HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
      HEAL
    ]
  ) {
    super(role, parts);
    this.tasks = [
      // TODO: should these even renew?  they are expensive, but travel time
      //       might be an issue, possibly rebirth task is better
      'renew',
      'hunt'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `come with me if you want to live`);

    super.activate();

    log.finish(`I'll be back`);
  }
}

module.exports = CreepTerminator;
