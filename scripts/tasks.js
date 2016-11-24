'use strict';

/*
Methods will return true if the creep should perform no other tasks this tick

Methods will return false if either the creep should not do this task or if
the task allows for other actions to be taken afterwards

TODO: this should be changed to return something more along the lines of:

{
  didAction: boolean,
  didAnimation: boolean
}

some of the tasks could end up doing 1 or both of the types of creep actions

*/

let actions = require('taskActions');
let helpers = require('helpers');
let log = require('logger');
let strings = require('strings');

function build(creep) {
  let flag = true;

  let constructionSites = creep.room.find(FIND_CONSTRUCTION_SITES);
  if (constructionSites.length == 0)  {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  }
  else if (
    (creep.memory.task != 'build' &&
    creep.carry.energy < 50) ||
    creep.carry.energy == 0
  ) { // don't start building until we have a useful amount
    creep.memory.target = null;
    creep.memory.task = 'getWorkEnergy';
    flag = true;
  } else if (
    creep.room.energy < 50 * creep.room.find(FIND_SOURCES).length
  ) { // always leave a minimum of energy in the room
    log.info('build: not much energy in room, waiting to build');
    // creep.memory.target = null;
    // creep.memory.task = null;
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
          flag = actions.moveTo(creep, target, 'build');
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

function claim(creep) {
  let flag = true;

  let target;
  if (!creep.memory.target) {
    let targets = Object.keys(Game.flags).map((flagName) => {
      if (/^NewController/.test(flagName)) {
        return Game.flags[flagName];
      }
    });

    if (targets) {
      targets.sort((a, b) => {
        return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
      });

       target = targets[0].name;
    } else {
      log.info(`no valid controller flag found`);
    }
  } else {
    target = creep.memory.target;
  }

  if (target) {
    if (!creep.memory.task) {
      creep.memory.target = target;
      creep.memory.task = 'claim';
      creep.say('claiming');
    }

    if (creep.pos.getRangeTo(Game.flags[target]) > 0) {
      flag = actions.moveTo(creep, Game.flags[target], 'claim');
    } else {
      if (creep.room.controller.owner == 'ioncache') {
        log.info(`claim: I already own the controller in this room`);
        Game.flags[creep.memory.target].remove();
        creep.memory.target = null;
        creep.memory.task = null;
        flag = false;
      } else if (Object.keys(Game.rooms).length < Game.gcl) {
        log.info(`claim: attempting to claim ${creep.memory.target}`);
        let claimResult = creep.claimController(creep.room.controller);
        switch (claimResult) {
          case ERR_FULL:
            log.info(`claim: already own 3 controllers in novice area, removing target flag ${creep.memory.target}`);
            Game.flags[creep.memory.target].remove();
            creep.memory.target = null;
            creep.memory.task = null;
            flag = false;
            break;
          case ERR_GCL_NOT_ENOUGH:
            log.info(`claim: global control level not high enough`);
            flag = true;
            break;
          case ERR_INVALID_TARGET:
            log.info(`claim: cannot claim this controller`);
            creep.memory.target = null;
            creep.memory.task = null;
            flag = false;
            break;
          case ERR_NOT_IN_RANGE:
            flag = actions.moveTo(creep, creep.room.controller, 'claim');
            break;
          case OK:
            log.info(`claim: controller claimed huzzah`);
            Game.flags[creep.memory.target].remove();
            creep.memory.target = null;
            creep.memory.task = null;
            flag = true;
            break;
          default:
            log.info(`claim: unknown response '${claimResult}'`);
            flag = true;
        }
      } else if (!creep.room.controller.reservation || creep.room.controller.username == 'ioncache') {
        log.info(`claim: reserving new controller`);
        let reserveController = creep.reserveController(creep.room.controller);
        flag = true;
      } else {
        log.info(`claim: current gcl not high enough to claim new room`);
        flag = true;
      }
    }
  }  else {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  }

  return flag;
}

function fillup(creep) {
  let flag;

  if (creep.carry.energy == creep.carry.carryCapacity) {
    creep.memory.container = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let container = creep.memory.container;
    if (!container) {
      let containers = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            [
              STRUCTURE_CONTAINER
            ].includes(structure.structureType) &&
            structure.store[RESOURCE_ENERGY] > 1
          );
        }
      });

      container = _.max(containers, (i) => {
        return i.store[RESOURCE_ENERGY];
      });
      if (container) {
        container = container.id;
      }
    }

    if (!container) {
      log.info('fillup: no valid containers found');
      creep.memory.container = null;
      creep.memory.task = null;
      flag = false;
    } else {
      creep.memory.target = container;

      container = Game.getObjectById(creep.memory.target);

      flag = actions.withdraw(creep, container, 'fillup');
      creep.memory.container = null;
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
      target = creep.memory.target;
      if (target) {
        let tempTarget = Game.getObjectById(target);
        if (
          (maxHits[target.structureType] &&
          target.hits > maxHits[target.structureType]) ||
          target.hits >= target.hitsMax
        ) {
          target = null;
        }
      }
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
          flag = actions.moveTo(creep, target, 'fix');
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
            creep.memory.task = null;
          } else if (target.hits == target.hitsMax) { // if strucre full health, remove target
            creep.memory.target = null;
            creep.memory.task = null;
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

function getWorkEnergy(creep) {
  let flag;

  let staticHarvesters = Object.keys(Game.creeps).filter((name) => {
    return Game.creeps[name].memory.role == 'staticHarvester';
  });

  let harvesters = Object.keys(Game.creeps).filter((name) => {
    return ['harvester', 'basicHarvester'].includes(Game.creeps[name].memory.role);
  });

  let sources = creep.room.find(FIND_SOURCES);

  let energySource = helpers.getTarget(creep, 'energyStore');

  if (
    energySource &&
    (staticHarvesters.length >= sources.length ||
    harvesters.length >= (sources.length * 4))
  ) {
    return withdraw(creep);
  } else {
    return harvest(creep);
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
        flag = actions.moveTo(creep, Game.flags[post], 'guard');
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
      log.info('harvest: no valid harvest source could be found');
      creep.memory.target = null;
      flag = false;
    } else {
      creep.memory.target = target;
      if (creep.memory.task != 'harvest') {
        creep.memory.task = 'harvest';
        creep.say('harvesting');
      }

      target = Game.getObjectById(target);

      flag = actions.harvest(creep, target, 'harvest');
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
          flag = actions.moveTo(creep, target, 'pickup');
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

// task to replace current creep with a new creep
// this may be because:
// - the class for this type of creep has been upgraded
// - a new class of creep would be better suited for this creep's job
//
// this task will
// - trigger spawning of new creep
// - copy current creep's memory to new creep
// - set task of current creep to recycle
// - in the case of replacing this creep with one of a different kind
//   then the population min values will get updated accordingly
//   so that no new creeps spawn of this type when it recycles
function rebirth(creep, newRole) {
  let flag;

  // TODO: maybe write the actual function

  return flag;
}

function recycle(creep) {
  let flag;

  let spawn;
  let spawns = creep.room.find(FIND_MY_SPAWNS);
  if (spawns) {
    spawn = spawns[0];
  } else {
    spawns = Object.keys(Game.spawns);
    if (spawns) {
      spawn = Game.spawns[spawns[0]];
    }
  }

  if (creep.pos.getRangeTo(spawn) > 1) {
    flag = actions.moveTo(creep, spawn, 'recycle');
  } else {
    if (creep.carry.energy) {
      flag = actions.transfer(creep, spawn, 'recycle');
    } else {
      let result = spawn.recycleCreep(creep);

      switch (result) {
        case ERR_NOT_IN_RANGE:
          flag = actions.moveTo(creep, spawn, 'recycle');
          break;
        default:
          flag = true;
      }
    }
  }

  creep.memory.task = 'recycle';
  return flag;
}

function renew(creep) {
  let flag;

  if (creep.memory.task == 'renew' || creep.ticksToLive < 300) {
    if (creep.memory.task != 'renew') {
      creep.memory.task = 'renew';
      creep.say('renewing');
    }

    let spawn = Game.getObjectById(creep.memory.target);

    if (!spawn || spawn.structureType != 'spawn') {
      spawn = helpers.getTarget(creep, 'spawn');
      creep.memory.target = spawn;
      spawn = Game.getObjectById(creep.memory.target)
    }

    if (spawn) {
      let result = spawn.renewCreep(creep);

      switch (result) {
        case ERR_NOT_IN_RANGE:
          log.info('renew: not in range of spawn');
          flag = actions.moveTo(creep, spawn, 'renew');
          break;
        case ERR_FULL:
          log.info(`renew: all filled up`);
          creep.memory.target = null;
          creep.memory.task = null;
          flag = false;
          break;
        case ERR_NOT_ENOUGH_ENERGY:
          log.info(`renew: spawn out of energy`);
          if (creep.ticksToLive > 500) { // move on to other things
            creep.memory.target = null;
            creep.memory.task = null;
            flag = false;
          } else { // stick it out and wait for energy
            // transfer any held energy so we can renew
            if (creep.carry.energy > 0) {
              let result = creep.transfer(spawn, RESOURCE_ENERGY);
            }
            flag = true;
          }
          break;
        case OK:
          log.info(`renew: renewing`);
          if (creep.ticksToLive > 750) { // move on to other things
            creep.memory.target = null;
            creep.memory.task = null;
            flag = true;
          }
          flag = true;
        default:
          flag = true;
      }
    }
  } else {
    creep.memory.target = null;
    creep.memory.task = 0;
    flag = false;
  }

  return flag;
}

function staticHarvest(creep) {
  let flag;

  if (creep.memory.isStatic) {
    if (!creep.memory.task == 'staticHarvest') {
      creep.memory.task = 'staticHarvest';
      creep.say('staticy!');
    }

    let source = creep.memory.source;
    if (!source) {
      source = helpers.getTarget(creep, 'source', { nearest: true });
    }

    let container = creep.memory.container;
    if (!container) {
      container = helpers.getTarget(creep, 'energyHolder', { nearest: true, types: [STRUCTURE_CONTAINER] });
    }

    if (!source) {
      log.info(`staticHarvest: no source available`);
      flag = false;
    } else if (!container) {
      log.info(`staticHarvest: no container available`);
      flag = false;
    } else {
      creep.memory.source = source;
      creep.memory.container = container;
      let sourceTarget =  Game.getObjectById(source);
      let containerTarget =  Game.getObjectById(container);

      // harvest
      flag = actions.harvest(creep, sourceTarget, 'staticHarvest');

      // transfer
      flag = actions.transfer(creep, containerTarget, 'staticHarvest');

      // if source is out of energy, do a renew if needed
      if (sourceTarget.energy == 0 && creep.ticksToLive < 600) {
        creep.memory.task = 'renew';
        creep.memory.target = null;
        flag = true;
      }
    }
  } else {
    let target = creep.memory.staticTarget;
    if (!target) {
      target = helpers.getTarget(creep, 'staticHarvestLocation');
    }

    if (target) {
      creep.memory.staticTarget = target;

      let staticTarget = Game.flags[target];
      flag = actions.moveTo(creep, staticTarget, 'staticHarvest');
      if (creep.pos.getRangeTo(staticTarget) == 0) {
        creep.memory.isStatic = true;
      }
    } else {
      log.info(`staticHarvest: no static harvest locations available`);
      flag = false;
    }
  }

  return flag;
}

function transferStorage(creep) {
  return transfer(creep, true);
}

function transfer(creep, storageTarget) {
  let flag = true;

  let currentLoad = _.sum(creep.carry);
  if (_.sum(creep.carry) == 0) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let target;

    if (creep.memory.task == 'transfer' && creep.memory.target) {
      target = creep.memory.target;
      let tempTarget = Game.getObjectById(target);

      // if the current target is now full, we can look for a new target
      // this will ignore storages as they don't have an energyCapcity property
      if (tempTarget.energyCapactity && (creep.carry.energy + structure.energy) >= structure.energyCapacity) {
        target = null;
      }
    }

    if (!target && storageTarget) {
      target = helpers.getTarget(creep, 'storage');
    }

    if (!target) {
      target = helpers.getTarget(creep, 'energyHolder');
    }

    // if there is no target at this point, no valid target was found
    if (!target) {
      log.info('transfer: could not find an energy holder');
      creep.memory.target = null;
      flag = false;
    } else {
      creep.memory.target = target;
      if (creep.memory.task != 'transfer') {
        creep.memory.task = 'transfer';
        creep.say('giving');
      }

      target = Game.getObjectById(target);

      let transferType;
      if (target.structureType == STRUCTURE_STORAGE) {
        if (creep.carry[RESOURCE_ENERGY]) {
          transferType = RESOURCE_ENERGY;
        } else {
          for (let carryType in creep.carry) {
            if (carryType != RESOURCE_ENERGY) {
              transferType = carryType;
            }
          }
        }
      } else {
        transferType = RESOURCE_ENERGY;
      }

      flag = actions.transfer(creep, target, 'transfer', transferType);

      // stay here and keep depositing if the creep is still carrying anything
      if (!_.sum(creep.carry) == 0 && target.structureType) {
        creep.memory.task = 'transfer';
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
        flag = actions.moveTo(creep, creep.room.controller, 'upgrade');
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

function withdraw(creep) {
  let flag = true;

  if (_.sum(creep.carry) >= creep.carryCapacity) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let target;

    if (creep.memory.task == 'withdraw' && creep.memory.target) {
      target = creep.memory.target;
      let tempTarget = Game.getObjectById(target);

      // if the current target is now empty, we can look for a new target
      if (
        tempTarget.energy > 0 ||
        (tempTarget.store && tempTarget.store.energy > 0)
      ) {
        target = null;
      }
    }

    if (!target) {
      target = helpers.getTarget(creep, 'energyStore');
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
      if (creep.memory.task != 'withdraw') {
        creep.memory.task = 'withdraw';
        creep.say('taking');
      }


      target = Game.getObjectById(target);

      flag = actions.withdraw(creep, target, 'withdraw');
    }
  }

  return flag;
}

module.exports = {
  build: build,
  claim: claim,
  fillup: fillup,
  fix: fix,
  getWorkEnergy: getWorkEnergy,
  guard:  guard,
  harvest: harvest,
  motivate: motivate,
  patrol: patrol,
  pickup: pickup,
  rebirth: rebirth,
  recycle: recycle,
  renew: renew,
  staticHarvest: staticHarvest,
  transfer: transfer,
  transferStorage: transferStorage,
  withdraw: withdraw,
  upgrade:  upgrade
};
