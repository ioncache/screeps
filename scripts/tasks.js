'use strict';

/*
Methods will return true if the creep should perform no other tasks this tick

Methods will return false if either the creep should not do this task or if
the task allows for other actions to be taken afterwards

*/

let helpers = require('helpers');
let log = require('logger');
let strings = require('strings');

function build(creep) {
  let flag = true;

  if (creep.carry.energy == 0) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let target;

    if (creep.memory.task == 'build' && creep.memory.target) {
      // TODO: verify target
      target = creep.memory.target;
    }

    if (!target) {
      target = helpers.getTarget(creep, 'buildable');
    }

    // if there is no target at this point, no valid target was found
    if (!target) {
      creep.memory.target = null;
      flag = false;
    } else {
      creep.memory.target = target;
      if (creep.memory.task != 'build') {
        creep.memory.task = 'build';
        creep.say('building');
      }

      target = Game.getObjectById(target);

      let result = creep.build(target);

      switch (result) {
        case ERR_FULL:
          log.info(`build: structure full of energy`);
          creep.memory.target = null;
          flag = false;
          break;
        case ERR_INVALID_TARGET:
          // for some reason current target is no longer valid
          // reset target for next tick, but keep task as task should still be valid
          log.info(`build: target no longer valid`);
          creep.memory.target = null;
          flag = false;
          break;
        case ERR_NOT_IN_RANGE:
          log.info(`build: moving to buildable '${target}'`);
          let moveResult = creep.moveTo(target);
          switch (moveResult) {
            case ERR_NO_PATH:
              log.info(`build: cannot find path to buildable`);
              creep.memory.target = null;
              flag = false;
              break;
            case ERR_TIRED:
              log.info(`build: creep is tired during move, will tray again later`);
              flag = true;
              break;
            case OK:
              flag = true;
              break;
            default:
              log.info(`build: unknown response during move to buildable '${moveResult}'`);
              flag = true;
          }
          break;
        case OK:
          log.info(`build: constructing`);
          // reset task now if creep is out of energy after fix
          if (creep.carry.energy == 0) {
            creep.memory.target = null;
            creep.memory.task = null;
          }

          // TODO:
          // do an inital repair of ramparts just to give them some life
          // as they start with very little and decay quickly
          else if (target.structureType == STRUCTURE_RAMPART) {
            console.log('-> target was a rampart');
            // let items = creep.room.lookAt(target.pos.x, target.pos.y);
            // look.forEach(function(lookObject) {
            //   console.log(lookObject.type);
            // });
            // creep.memory.target = ???;
            // creep.memeory.task = 'fix';
          }

          flag = true;
          break;
        default:
          log.info(`build: unknown response '${result}'`);
          creep.memory.target = null;
          creep.memory.task = null;
          flag = true;
      }
    }
  }

  return flag;
}

function fix(creep) {
  let flag = true;

  let maxHits = {
    constructedWall: 5000,
    rampart: 10000
  };

  if (creep.carry.energy == 0) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let target;

    if (creep.memory.task == 'fix' && creep.memory.target) {
      // TODO: verify target
      target = creep.memory.target;
    }

    if (!target) {
      target = helpers.getTarget(creep, 'fixable', { maxHits: maxHits });
    }

    // if there is no target at this point, no valid target was found
    if (!target) {
      creep.memory.target = null;
      flag = false;
    } else {
      creep.memory.target = target;
      if (creep.memory.task != 'fix') {
        creep.memory.task = 'fix';
        creep.say('fixing');
      }

      target = Game.getObjectById(target);

      let result = creep.repair(target);

      switch (result) {
        case ERR_FULL:
          log.info(`fix: structure full of energy`);
          creep.memory.target = null;
          flag = false;
          break;
        case ERR_INVALID_TARGET:
          // for some reason current target is no longer valid
          // reset target for next tick, but keep task as task should still be valid
          log.info(`fix: target no longer valid`);
          creep.memory.target = null;
          flag = false;
          break;
        case ERR_NOT_IN_RANGE:
          log.info(`fix: moving to fixable '${target}'`);
          let moveResult = creep.moveTo(target);
          switch (moveResult) {
            case ERR_NO_PATH:
              log.info(`fix: cannot find path to fixable`);
              creep.memory.target = null;
              flag = false;
              break;
            case ERR_TIRED:
              log.info(`fix: creep is tired during move, will tray again later`);
              flag = true;
              break;
            case OK:
              flag = true;
              break;
            default:
              log.info(`fix: unknown response during move to buildable '${moveResult}'`);
              flag = true;
          }
          break;
        case OK:
          log.info(`fix: fixing`);
          // reset task now if creep is out of energy after fix
          if (creep.carry.energy == 0) {
            creep.memory.target = null;
            creep.memory.task = null;
          } else if ( // if stucture is at max desired health, remove target
            maxHits[target.structureType] &&
            target.hits > maxHits[target.structureType]
          ) {
            creep.memory.target = null;
          } else if (target.hits == target.hitsMax) { // if strucre full health, remove target
            creep.memory.target = null;
          }
          flag = true;
          break;
        default:
          log.info(`fix: unknown response '${result}'`);
          creep.memory.target = null;
          creep.memory.task = null;
          flag = true;
      }
    }
  }

  return flag;
}

function guard(creep) {
  let flag = true;

  let post = creep.memory.post;

  if (!post) {
    post = helpers.getTarget(creep, 'guardPost');
  }

  if (post) {
    creep.memory.post = post;
    if (creep.memory.task != 'guard') {
      creep.memory.task = 'guard';
      creep.say('guarding');
    }

    let guardPosts = creep.room.find(FIND_FLAGS, {
      filter: (post) => {
        return post.name == creep.memory.post;
      }
    });

    if (Game.flags[post]) {
      if (creep.pos.getRangeTo(Game.flags[post]) > 0) {
        log.info(`guard: moving to guard post`);
        let moveResult = creep.moveTo(target);
        switch (moveResult) {
          case ERR_NO_PATH:
            log.info(`guard: cannot find path to guard post`);
            creep.memory.post = null;
            flag = false;
            break;
          case ERR_TIRED:
            log.info(`guard: creep is tired during move, will tray again later`);
            flag = true;
            break;
          case OK:
            flag = true;
            break;
          default:
            log.info(`guard: unknown response during move to post '${moveResult}'`);
            flag = true;
        }
      } else {
        log.info(`guard: guarding ${post}`);
        if (helpers.getRandomInt(1, 100) > 90) {
          creep.say(strings.guardChat[helpers.getRandomInt(0, strings.guardChat.length - 1)], true);
        }
        flag = true;
      }
    } else {
      creep.memory.task = null;
      creep.memory.post = null;

      flag = false
    }
  } else {
    creep.memory.task = null;
    creep.memory.post = null;
    flag = false;
  }

  return flag;
}

function harvest(creep) {
  let flag = true;

  if (creep.carry.energy < creep.carryCapacity) {
    let target;

    if (creep.memory.task == 'harvest' && creep.memory.target) {
      // TODO: verify target
      target = creep.memory.target;
    }

    if (!target) {
      target = helpers.getTarget(creep, 'source');
    }

    // if there is no target at this point, no valid target was found
    if (!target) {
      creep.memory.target = null;
      flag = false;
    } else {
      creep.memory.target = target;
      if (creep.memory.task != 'harvest') {
        creep.memory.task = 'harvest';
        creep.say('harvesting');
      }

      target = Game.getObjectById(target);

      let result = creep.harvest(target);

      switch (result) {
        case ERR_INVALID_TARGET:
          // for some reason current target is no longer valid
          // reset target for next tick, but keep task as task should still be valid
          log.info(`harvest: target no longer valid`);
          creep.memory.target = null;
          flag = false;
          break;
        case ERR_NOT_IN_RANGE:
          log.info(`harvest: moving to source '${target}'`);
          let moveResult = creep.moveTo(target);
          switch (moveResult) {
            case ERR_NO_PATH:
              log.info(`harvest: cannot find path to source`);
              creep.memory.target = null;
              flag = true;
              break;
            case ERR_TIRED:
              log.info(`harvest: creep is tired during move, will tray again later`);
              flag = true;
              break;
            case OK:
              flag = true;
              break;
            default:
              log.info(`harvest: unknown response during move to source '${moveResult}'`);
              flag = true;
          }
          break;
        case OK:
          log.info(`harvest: harvesting`);
          // store the current source so that we can move away from it once
          // harvesting is complete, this is so we don't block the source
          // from other creeps
          creep.memory.nearSource = target.id;
          flag = true;
          break;
        default:
          log.info(`harvest: unknown response '${result}'`);
          flag = true;
      }
    }
  } else {
    creep.memory.task = null;
    creep.memory.target = null;
    // move away from the source if the creep was near one
    if (creep.memory.nearSource) {
      helpers.moveAwayFromSource(creep, creep.memory.nearSource);
      creep.memory.nearSource = null;
      flag = true;
    } else {
      flag = false;
    }
  }

  return flag;
}

function motivate(creep) {
  creep.say(strings.motivations[helpers.getRandomInt(0, strings.motivations.length - 1)], true);

  return false;
}

function patrol(creep) {
  // TODO: implement
  log.info(`patrol: well I would, but patrolling isn't implemented yet`);

  return false;
}

function pickup(creep) {
  let flag = true;

  if (creep.carry.energy < creep.carryCapacity) {
    // always get a new target, if for some reason there is other
    // droppedEnergy closer, might as well get that instead of original
    let target = helpers.getTarget(creep, 'droppedEnergy');

    // if there is no target at this point, no valid target was found
    if (!target) {
      creep.memory.task = null;
      flag = false;
    } else {
      creep.memory.target = target;
      if (creep.memory.task != 'pickup') {
        creep.memory.task = 'pickup';
        creep.say('grabbing');
      }

      target = Game.getObjectById(target);

      let result = creep.pickup(target);

      switch (result) {
        case ERR_INVALID_TARGET:
          log.info(`pickup: target no longer valid`);
          creep.memory.target = null;
          creep.memory.task = null;
          flag = false;
          break;
        case ERR_NOT_IN_RANGE:
          log.info(`pickup: moving to source '${target}'`);
          let moveResult = creep.moveTo(target);
          switch (moveResult) {
            case ERR_NO_PATH:
              log.info(`pickup: cannot find path to dropped energy`);
              creep.memory.target = null;
              flag = false;
              break;
            case ERR_TIRED:
              log.info(`pickup: creep is tired during move, will tray again later`);
              flag = true;
              break;
            case OK:
              flag = true;
              break;
            default:
              log.info(`pickup: unknown response during move to droppedEnergy '${moveResult}'`);
              flag = true;
          }
          flag = true;
          break;
        case OK:
          log.info(`pickup: picking up energy`);
          flag = true;
          break;
        default:
          log.info(`pickup: unknown response '${result}'`);
          flag = true;
      }
    }
  } else {
    creep.memory.task = null;
    creep.memory.target = null;
    flag = false;
  }

  return flag;
}

function transfer(creep) {
  let flag = true;

  if (creep.carry.energy == 0) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let target;

    if (creep.memory.task == 'transfer' && creep.memory.target) {
      // TODO: verify target
      target = creep.memory.target;
    }

    if (!target) {
      target = helpers.getTarget(creep, 'storage');
    }

    // if there is no target at this point, no valid target was found
    if (!target) {
      creep.memory.target = null;
      flag = false;
    } else {
      creep.memory.target = target;
      if (creep.memory.task != 'transfer') {
        creep.memory.task = 'transfer';
        creep.say('giving');
      }

      target = Game.getObjectById(target);

      let result = creep.transfer(target, RESOURCE_ENERGY);

      switch (result) {
        case ERR_FULL:
          log.info(`transfer: structure full of energy`);
          creep.memory.target = null;
          flag = false;
          break;
        case ERR_INVALID_TARGET:
          // for some reason current target is no longer valid
          // reset target for next tick, but keep task as task should still be valid
          log.info(`transfer: target no longer valid`);
          creep.memory.target = null;
          flag = false;
          break;
        case ERR_NOT_IN_RANGE:
          log.info(`transfer: moving to structure '${target}'`);
          let moveResult = creep.moveTo(target);
          switch (moveResult) {
            case ERR_NO_PATH:
              log.info(`transfer: cannot find path to structure`);
              creep.memory.target = null;
              flag = false;
              break;
            case ERR_TIRED:
              log.info(`transfer: creep is tired during move, will tray again later`);
              flag = true;
              break;
            case OK:
              flag = true;
              break;
            default:
              log.info(`transfer: unknown response during move to structure '${moveResult}'`);
              flag = true;
          }
          break;
        case OK:
          log.info(`transfer: transferring`);
          // reset task now if creep is out of energy after transfer
          if (creep.carry.energy == 0) {
            creep.memory.target = null;
            creep.memory.task = null;
          }
          flag = true;
          break;
        default:
          log.info(`transfer: unknown response '${result}'`);
          creep.memory.target = null;
          creep.memory.task = null;
          flag = true;
      }
    }
  }

  return flag;
}

function withdraw(creep) {
  let flag = true;

  if (creep.carry.energy == creep.carryCapacity) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let target;

    if (creep.memory.task == 'withdraw' && creep.memory.target) {
      // TODO: verify target
      target = creep.memory.target;
    }

    if (!target) {
      target = helpers.getTarget(creep, 'energyStore');
    }

    // if there is no target at this point, no valid target was found
    if (!target) {
      creep.memory.target = null;
      flag = false;
    } else {
      creep.memory.target = target;
      if (creep.memory.task != 'withdraw') {
        creep.memory.task = 'withdraw';
        creep.say('taking');
      }

      target = Game.getObjectById(target);
      // if (creep.pos.getRangeTo(target) == 1 && target.energy == 0) {
      //   target = helpers.getTarget(creep, 'energyStore');
      // }

      let result = creep.withdraw(target, RESOURCE_ENERGY);

      switch (result) {
        case ERR_FULL:
          log.info(`withdraw: creep full of energy`);
          creep.memory.target = null;
          flag = false;
          break;
        case ERR_INVALID_TARGET:
          // for some reason current target is no longer valid
          // reset target for next tick, but keep task as task should still be valid
          log.info(`withdraw: target no longer valid`);
          creep.memory.target = null;
          flag = false;
          break;
        case ERR_NOT_ENOUGH_RESOURCES:
          log.info(`withdraw: store is out of resources`);
          creep.memory.target = null;
          flag = true;
          break;
        case ERR_NOT_IN_RANGE:
          log.info(`withdraw: moving to energy store '${target}'`);
          let moveResult = creep.moveTo(target);
          switch (moveResult) {
            case ERR_NO_PATH:
              log.info(`withdraw: cannot find path to energy store`);
              creep.memory.target = null;
              flag = false;
              break;
            case ERR_TIRED:
              log.info(`withdraw: creep is tired during move, will tray again later`);
              flag = true;
              break;
            case OK:
              flag = true;
              break;
            default:
              log.info(`withdraw: unknown response during move to energy store '${moveResult}'`);
              flag = true;
          }
          break;
        case OK:
          log.info(`withdraw: withdrawing`);
          // reset task now if creep is full of energy after withdraw
          if (creep.carry.energy == creep.carryCapacity) {
            creep.memory.target = null;
            creep.memory.task = null;
          } else if (target.energy < 2) { // reset if if current target is out of energy
            creep.memory.target = null;
          }
          flag = true;
          break;
        default:
          log.info(`withdraw: unknown response '${result}'`);
          creep.memory.target = null;
          creep.memory.task = null;
          flag = true;
      }
    }
  }

  return flag;
}

function upgrade(creep) {
  let flag = true;

  if (creep.carry.energy == 0) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    if (creep.memory.task != 'upgrade') {
      creep.memory.task = 'upgrade';
      creep.say('upgrading');
    }

    let result = creep.upgradeController(creep.room.controller);

    switch (result) {
      case ERR_INVALID_TARGET:
        // for some reason current target is no longer valid
        // reset target for next tick, but keep task as task should still be valid
        log.info(`upgrade: target no longer valid`);
        creep.memory.target = null;
        flag = false;
        break;
      case ERR_NOT_IN_RANGE:
        log.info(`upgrade: moving to controller`);
        let moveResult = creep.moveTo(creep.room.controller);
        switch (moveResult) {
          case ERR_NO_PATH:
            log.info(`upgrade: cannot find path to controller`);
            creep.memory.target = null;
            flag = false;
            break;
          case ERR_TIRED:
            log.info(`upgrade: creep is tired during move, will tray again later`);
            flag = true;
            break;
          case OK:
            flag = true;
          default:
            log.info(`harvest: unknown response during move to controller '${moveResult}'`);
            flag = true;
        }

        break;
      case OK:
        log.info(`upgrade: controller is being enhanced`);
        // reset task now if creep is out of energy after upgrade
        if (creep.carry.energy == 0) {
          creep.memory.target = null;
          creep.memory.task = null;
        }
        flag = true;
        break;
      default:
        log.info(`upgrade: unknown response '${result}'`);
        creep.memory.target = null;
        creep.memory.task = null;
        flag = true;
    }
  }

  return flag;
}

module.exports = {
  build: build,
  fix: fix,
  guard:  guard,
  harvest: harvest,
  motivate: motivate,
  patrol: patrol,
  pickup: pickup,
  transfer: transfer,
  withdraw: withdraw,
  upgrade:  upgrade
};
