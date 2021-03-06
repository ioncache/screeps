'use strict';

let helpers = require('helpers');
let tasks = require('tasks');
let log = require('logger');

class CreepBase {
  constructor(role = 'harvester', parts = [WORK, CARRY, MOVE]) {
    this.parts = parts;
    this.role = role;
    this.tasks = [];
  }

  activate() {
    let creep = Game.creeps[this.name];

    // everyone needs a little motivation now and then, just ask Shia Leboeuf
    let willMotivate = helpers.getRandomInt(1, 100) > 98 ? true : false;
    if (willMotivate) {
      tasks.motivate(creep);
    }

    let result;
    // if the creep already has an assigned task, do that first
    if (creep.memory.task) {
      let task = tasks[creep.memory.task];
      if (task) {
        result = task(creep);
      }
    }

    // continue with other tasks if original task allows
    if (!result) {
      let result;
      for (let task of this.tasks) {
        result =  false;
        if (tasks[task]) {
          result = tasks[task](creep);
        } else {
          log.log(`unknown task: ${task}`);
        }

        // if the task returns true, we are done this task loop
        // some tasks will return false if they cannot be done
        // some tasks will return false if other tasks can be done afterwards
        if (result) {
          break;
        }
      }

      // if at this point nothing has been done, move somewhere so creep
      // isn't left standing around blocking other things
      // if (!result && !creep.memory.task) {
      //   tasks.parking(creep, true);
      // }
    }
  }
}

module.exports = CreepBase;
