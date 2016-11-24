'use strict';

let CreepBase = require('class.creep.base');
let log = require('logger');

class CreepPioneer extends CreepBase {
  constructor(role = 'pioneer', parts = [CLAIM, MOVE, MOVE, MOVE, MOVE, MOVE]) {
    super(role, parts);
    this.tasks = [
      'claim'
    ];
  }

  activate() {
    let creep = Game.creeps[this.name];

    log.start(creep.name, `claiming places in the name of ioncache`);

    super.activate();

    log.finish(`whew, claiming is hard work`);
  }
}

module.exports = CreepPioneer;
