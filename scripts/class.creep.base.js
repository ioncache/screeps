'use strict';

let helpers = require('helpers');
let tasks = require('tasks');
let log = require('logger');

class CreepBase {
  constructor(role, parts = [WORK, CARRY, MOVE]) {
    this.parts = parts;
    this.role = role;
    this.tasks = [];
  }

  isDying() {
    let creep = Game.creeps[this.name];

    return creep.ticksToLive < 200;
  }

  activate() {
    let creep = Game.creeps[this.name];

    // everyone needs a little motivation now and then, just ask Shia Leboeuf
    let willMotivate = helpers.getRandomInt(1, 100) > 98 ? true : false;
    if (willMotivate) {
      tasks.motivate(creep);
    }

    // self renewal always takes precedence over other creep tasks
    if (this.isDying() || creep.memory.renewing) {
      this.renew();
    } else {
      let result;
      // if the creep already has an assigned task, do that first
      if (creep.memory.task) {
        result = tasks[creep.memory.task](creep);
      }

      // continue with other tasks if original task allows
      if (!result) {
        for (let task of this.tasks) {
          let result = tasks[task](creep);

          // if the task returns true, we are done this task loop
          // some tasks will return false if they cannot be done
          // some tasks will return false if other tasks can be done afterwards
          if (result) {
            break;
          }
        }
      }
    }
  }

  // renewal method on base creep as all creeps will need this
  // TODO: put this in tasks instead?
  renew(creep) {
    creep = creep || Game.creeps[this.name];

    let spawn = Game.getObjectById(creep.memory.target);
    if (!spawn || spawn.structureType != 'spawn') {
      spawn = helpers.getTarget(creep, 'spawn');
      creep.memory.target = spawn;
      spawn = Game.getObjectById(creep.memory.target)
      creep.say('renewing');
    }

    if (spawn) {
      let result = spawn.renewCreep(creep);

      switch (result) {
        case ERR_NOT_IN_RANGE:
          log.info(`moving to spawn to renew`);
          creep.moveTo(spawn);
          break;
        case ERR_FULL:
          creep.memory.renewing = false;
          creep.memory.target = null;
          break;
        case ERR_NOT_ENOUGH_ENERGY:
          creep.memory.renewing = false;
          creep.memory.target = null;
          break;
        default:
          log.info(`renewing`);
          creep.memory.renewing = true;
      }
    }
  }
}

module.exports = CreepBase;
