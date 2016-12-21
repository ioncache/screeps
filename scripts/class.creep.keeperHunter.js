'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class KeeperHunter extends CreepBase {
  constructor(
    role = 'keeperHunter',
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

    log.start(creep.name, `my prey cannot hide`);

    super.activate();

    log.finish(`from the shadows I shall strike`);
  }
}

module.exports = KeeperHunter;
