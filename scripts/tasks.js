'use strict';

/*
Methods will return true if the creep should perform no other tasks this tick

Methods will return false if either the creep should not do this task or if
the task allows for other actions to be taken afterwards

TODO: this should be optimized instead ot handle the correct action
      dependencies found from the creep action pipeline
      http://support.screeps.com/hc/en-us/articles/203137792-Simultaneous-execution-of-creep-actions
      using that set of task dependencies the creeps could be be far more
      efficient in doing multiple tasks a turn
*/

let actions = require('taskActions');
let config = require('config');
let helpers = require('helpers');
let log = require('logger');
let strings = require('strings');

function build(creep) {
  let flag = true;

  let constructionSites = Game.rooms[creep.memory.homeRoom].find(FIND_CONSTRUCTION_SITES);
  if (constructionSites.length === 0)  {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else if (
    (creep.memory.task !== 'build' &&
    creep.carry.energy < 50) ||
    creep.carry.energy === 0
  ) { // don't start building until we have a useful amount
    creep.memory.target = null;
    creep.memory.task = 'getWorkEnergy';
    flag = true;
  } else if (
    Game.rooms[creep.memory.homeRoom].energy < 50 * Game.rooms[creep.memory.homeRoom].find(FIND_SOURCES).length
  ) { // always leave a minimum of energy in the room
    log.info('build: not much energy in room, waiting to build');
    // creep.memory.target = null;
    // creep.memory.task = null;
    flag = false;
  } else {
    let target;

    if (creep.memory.task === 'build' && creep.memory.target) {
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
      if (creep.memory.task !== 'build') {
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
          // reset task now if creep is out of energy after build
          if (creep.carry.energy === 0) {
            creep.memory.target = null;
            creep.memory.task = null;
          } else if (target.structureType === STRUCTURE_RAMPART) {
            // TODO:
            // do an inital repair of ramparts just to give them some life
            // as they start with very little and decay quickly
            console.log('-> target was a rampart');
            // let items = Game.rooms[creep.memory.homeRoom].lookAt(target.pos.x, target.pos.y);
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
      creep.reserveController(Game.rooms[creep.memory.homeRoom].controller);
      if (Game.rooms[creep.memory.homeRoom].controller.owner === 'ioncache') {
        log.info(`claim: I already own the controller in this room`);
        Game.flags[creep.memory.target].remove();
        creep.memory.target = null;
        creep.memory.task = null;
        flag = false;
      } else if (Object.keys(Game.rooms).length < Game.gcl.level) { // TODO: fix, object.keys is wrong
        log.info(`claim: attempting to claim ${creep.memory.target}`);
        let claimResult = creep.claimController(Game.rooms[creep.memory.homeRoom].controller);
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
            flag = actions.moveTo(creep, Game.rooms[creep.memory.homeRoom].controller, 'claim');
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
      } else if (
        !Game.rooms[creep.memory.homeRoom].controller.reservation ||
        Game.rooms[creep.memory.homeRoom].controller.username === config.masterOwner
      ) {
        log.info(`claim: reserving new controller`);
        let reserveController = creep.reserveController(Game.rooms[creep.memory.homeRoom].controller);
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

function fillupMasterStorage(creep) {
  return fillup(creep, true, 'fillupMasterStorage');
}

function fillup(creep, waitUntilFull = false, task) {
  let flag;

  if (creep.carry.energy === creep.carryCapacity) {
    creep.memory.container = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let container = creep.memory.container;
    if (!container) {
      let containers = Game.rooms[creep.memory.homeRoom].find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.room.name === creep.memory.homeRoom &&
            structure.structureType === STRUCTURE_CONTAINER &&
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
      if (!waitUntilFull) {
        creep.memory.task = null;
        flag = false;
      } else {
        flag = true;
      }
    } else {
      creep.memory.task = task || 'fillup';
      creep.memory.target = container;

      container = Game.getObjectById(creep.memory.target);

      flag = actions.withdraw(creep, container, 'fillup', RESOURCE_ENERGY, waitUntilFull);
      creep.memory.container = null;
    }
  }

  return flag;
}

function fix(creep) {
  let flag = true;

  if (creep.carry.energy === 0) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let target;

    if (creep.memory.task === 'fix' && creep.memory.target) {
      target = creep.memory.target;
      if (target) {
        let tempTarget = Game.getObjectById(target);

        if (
          (config.maxHits[tempTarget.structureType] &&
          tempTarget.hits > config.maxHits[tempTarget.structureType](creep.room)) ||
          tempTarget.hits >= tempTarget.hitsMax
        ) {
          log.info('fix: resetting target as it does not need fixing');
          target = null;
        }
      }
    }

    if (!target) {
      target = helpers.getTarget(creep, 'fixable', { maxHits: config.maxHits });
    }

    // if there is no target at this point, no valid target was found
    if (!target) {
      creep.memory.target = null;
      flag = false;
    } else {
      creep.memory.target = target;
      if (creep.memory.task !== 'fix') {
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
          if (creep.carry.energy === 0) {
            creep.memory.target = null;
            creep.memory.task = null;
          } else if ( // if stucture is at max desired health, remove target
            config.maxHits[target.structureType] &&
            target.hits > config.maxHits[target.structureType](creep.room)
          ) {
            creep.memory.target = null;
            creep.memory.task = null;
          } else if (target.hits === target.hitsMax) { // if strucre full health, remove target
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
    return Game.creeps[name].memory.role === 'staticHarvester';
  });

  let harvesters = Object.keys(Game.creeps).filter((name) => {
    return ['harvester', 'basicHarvester'].includes(Game.creeps[name].memory.role);
  });

  let sources = Game.rooms[creep.memory.homeRoom].find(FIND_SOURCES);

  let energySource = helpers.getTarget(creep, 'energyStore');

  // TODO: bleh fix this so it makes sense on a per room basis
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
    if (creep.memory.task !== 'guard') {
      creep.memory.task = 'guard';
      creep.say('guarding');
    }

    let guardPosts = Game.rooms[creep.memory.homeRoom].find(FIND_FLAGS, {
      filter: (post) => {
        return post.name === creep.memory.post;
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

      flag = false;
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

    if (creep.memory.task === 'harvest' && creep.memory.target) {
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
      if (creep.memory.task !== 'harvest') {
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
      let source = Game.getObjectById(creep.memory.nearSource);
      if (creep.pos.getRangeTo(source) < 2) {
        helpers.moveAwayFromSource(creep, creep.memory.nearSource);
      } else {
        creep.memory.nearSource = null;
      }
      flag = true;
    } else {
      flag = false;
    }
  }

  return flag;
}

function mine(creep) {
  let flag;

  if (!creep.memory.extractionSite) {
    let currentlyTargetedExtractionSites = Object.keys(Game.creeps)
    .filter((creepName) => {
      return Game.creeps[creepName].memory.role === 'miner';
    }).map((creepName) => {
      return Game.creeps[creepName].memory.extractionSite;
    });
    let extractionSite = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: (s) => {
        return (
          s.structureType === STRUCTURE_EXTRACTOR &&
          !currentlyTargetedExtractionSites.includes(s.id)
        );
      }
    });

    if (!extractionSite) {
      log.info('mine: no valid extraction site available');
      creep.memory.container = null;
      creep.memory.extractionSite = null;
      creep.memory.mineral = null;
      creep.memory.task = null;
      flag = false;
    } else {
      creep.memory.task = 'mine';
      creep.memory.extractionSite = extractionSite.id;
      flag = mine(creep);
    }
  } else {
    let extractionSite = Game.getObjectById(creep.memory.extractionSite);

    if (!extractionSite) {
      log.info('mine: selected site no longer exists');
      creep.memory.container = null;
      creep.memory.extractionSite = null;
      creep.memory.mineral = null;
      creep.memory.task = null;
      flag = false;
    } else {
      let container = Game.getObjectById(creep.memory.container);
      if (!container) {
        container = extractionSite.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: (s) => {
            return (
              s.structureType === STRUCTURE_CONTAINER &&
              extractionSite.pos.inRangeTo(s, 2)
            );
          }
        });
      }

      if (!container) {
        log.info('mine: no valid containers near extraction site');
        creep.memory.container = null;
        creep.memory.extractionSite = null;
        creep.memory.mineral = null;
        creep.memory.task = null;
        flag = false;
      } else {
        creep.memory.container = container.id;
      }

      if (!creep.pos.isNearTo(extractionSite)) {
        flag = actions.moveTo(creep, extractionSite, 'mine');
      } else if (extractionSite.cooldown === 0) {
        let mineral = Game.getObjectById(creep.memory.mineral);
        if (!mineral) {
          mineral = creep.pos.findClosestByRange(FIND_MINERALS);
        }

        if (mineral) {
          creep.memory.mineral = mineral.id;
          if (mineral.ticksToRegeneration) {
            flag = false;
          } else {
            flag = actions.harvest(creep, mineral, 'mine');
          }
        } else {
          flag = false;
        }
      } else {
        flag = false;
      }

      if (Object.keys(creep.carry).length > 1) {
        let resourceTypes = Object.keys(creep.carry)
        .filter((i) => {
          return i !== RESOURCE_ENERGY;
        });

        if (resourceTypes) {
          flag = actions.transfer(creep, container, 'mine', resourceTypes[0]);
        }
      }
    }
  }

  return flag;
}

function motivate(creep) {
  creep.say(strings.motivations[helpers.getRandomInt(0, strings.motivations.length - 1)], true);

  return false;
}

// mainly used when another move is desired directly after a previous move
function moveTo(creep) {
  let flag = actions.moveTo(creep, creep.memory.target, 'moveTo');
  if (flag) {
    creep.memory.target = null;
    creep.memory.task = null;
  }

  return flag;
}

function parking(creep) {
  let flag;

  let parking =  creep.pos.findClosestByRange(FIND_FLAGS, {
    filter: (flag) => {
      return (
        flag.room.name === creep.memory.homeRoom &&
        /^ParkingArea/.test(flag.name)
      );
    }
  });

  if (
    parking &&
    creep.pos.getRangeTo(parking) > 2
  ) {
    actions.moveTo(creep, parking, 'parking');
    creep.memory.task = 'parking';
    creep.memory.parkingMeter = 10;
    flag = true;
  } else {
    creep.memory.parkingMeter -= 1;
    if (creep.memory.parkingMeter) {
      renew(creep, 'parking');
    } else {
      creep.memory.task = null;
    }
  }

  return flag;
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
      if (creep.memory.task !== 'pickup') {
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
  let spawns = Game.rooms[creep.memory.homeRoom].find(FIND_MY_SPAWNS);
  if (spawns) {
    spawn = spawns[0];
  } else {
    spawns = Object.keys(Game.spawns);
    if (spawns) {
      spawn = Game.spawns[spawns[0]];
    }
  }

  if (!creep.pos.isNearTo(spawn)) {
    flag = actions.moveTo(creep, spawn, 'recycle');
  } else {
    if (creep.carry.energy) {
      flag = actions.transfer(creep, spawn, 'recycle');
    }

    if (!flag) {
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
  return true;
}

function renew(creep, nextTask) {
  let flag;

  if (creep.memory.task === 'renew' || creep.ticksToLive < 300) {
    if (creep.memory.task !== 'renew') {
      creep.memory.task = 'renew';
      creep.say('renewing');
    }

    let spawn = Game.getObjectById(creep.memory.target);

    if (!spawn || spawn.structureType !== 'spawn') {
      spawn = helpers.getTarget(creep, 'spawn');
      creep.memory.target = spawn;
      spawn = Game.getObjectById(creep.memory.target);
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
          creep.memory.task = nextTask || null;
          flag = false;
          break;
        case ERR_NOT_ENOUGH_ENERGY:
          log.info(`renew: spawn out of energy`);
          if (creep.ticksToLive > 500) { // move on to other things
            creep.memory.target = null;
            creep.memory.task = nextTask || null;
            flag = false;
          } else { // stick it out and wait for energy
            // transfer any held energy so we can renew
            if (creep.carry.energy > 0) {
              let result = creep.transfer(spawn, RESOURCE_ENERGY);
            } else {
              creep.memory.task = 'harvest'; // go harvest for energy to renew with
              creep.memory.target = helpers.getTarget(creep, 'source');
            }
            flag = true;
          }
          break;
        case OK:
          log.info(`renew: renewing`);
          if (creep.ticksToLive > 750) { // move on to other things
            creep.memory.target = null;
            creep.memory.task = nextTask || null;
            flag = true;
          }
          flag = true;
        default:
          flag = true;
      }
    }
  } else {
    creep.memory.target = nextTask || null;
    creep.memory.task = 0;
    flag = false;
  }

  return flag;
}

function staticHarvest(creep) {
  let flag;

  if (creep.memory.isStatic) {
    if (!creep.memory.task === 'staticHarvest') {
      creep.memory.task = 'staticHarvest';
      creep.say('staticy!');
    }

    let source = creep.memory.source;
    if (!source) {
      source = helpers.getTarget(creep, 'source', { nearest: true });
    }

    let container = creep.memory.container;
    if (!container) {
      container = helpers.getTarget(
        creep,
        'energyHolder',
        {
          filter: (i) => {
            return (
              i.room.name === creep.memory.homeRoom &&
              [STRUCTURE_CONTAINER].includes(i.structureType)
            );
          },
          nearest: true
        }
      );
    }

    if (!source) {
      log.info(`staticHarvest: no source available`);
      flag = false;
    } else if (!container) {
      log.info(`staticHarvest: no container available`);
      flag = false;
    } else {
      creep.memory.container = container;
      creep.memory.source = source;
      let containerTarget = Game.getObjectById(container);
      let sourceTarget = Game.getObjectById(source);
      let staticTarget = Game.flags[creep.memory.staticTarget];

      let link = creep.memory.link;
      if (!link && container) {
        link = creep.pos.findClosestByRange(
          FIND_STRUCTURES, {
            filter: (s) => {
              return (
                s.room.name === creep.memory.homeRoom &&
                s.structureType === STRUCTURE_LINK &&
                creep.pos.getRangeTo(s) === 1 &&
                containerTarget.pos.getRangeTo(s) <= 2
              );
            }
          }
        );

        if (link) {
          link = link.id;
        }
      }

      creep.memory.link = link;
      let linkTarget = Game.getObjectById(link);

      if (staticTarget && !creep.pos.isNearTo(staticTarget)) {
        flag = actions.moveTo(creep, staticTarget, 'staticHarvest');
      } else if (!creep.pos.isNearTo(sourceTarget)) {
        flag = actions.moveTo(creep, sourceTarget, 'staticHarvest');
      } else {
        // harvest
        flag = actions.harvest(creep, sourceTarget, 'staticHarvest');

        // transfer
        if (
          linkTarget &&
          Game.rooms[creep.memory.homeRoom].energyAvailable >= 500 &&
          linkTarget.energyCapacity - linkTarget.energy >= creep.carry.energy
        ) { // use link when there is prolific energy
          flag = actions.transfer(creep, linkTarget, 'staticHarvest');
        } else {
          flag = actions.transfer(creep, containerTarget, 'staticHarvest');
        }
      }

      // if source is out of energy, do a renew if needed
      if (sourceTarget.energy === 0 && creep.ticksToLive < 600) {
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
      if (creep.pos.getRangeTo(staticTarget) === 0) {
        creep.memory.isStatic = true;
      }
    } else {
      log.info(`staticHarvest: no static harvest locations available`);
      flag = false;
    }
  }

  return flag;
}

function transferMasterStorage(creep) {
  let target;
  if (
    Game.spawns[config.masterSpawn] &&
    Game.spawns[config.masterSpawn].room.storage
  ) {
    target = Game.spawns[config.masterSpawn].room.storage.id;
  }

  if (target) {
    return transfer(creep, target);
  }

  return false;
}

function transferStorage(creep) {
  let target = helpers.getTarget(creep, 'storage');
  if (target) {
    return transfer(creep, target);
  }

  return false;
}

function transferTower(creep) {
  let towers = helpers. Game.rooms[creep.memory.homeRoom].find(
    FIND_STRUCTURES,
    {
      filter: (s) => {
        return (
          s.room.name === creep.memory.homeRoom &&
          s.structureType === STRUCTURE_TOWER &&
          s.energy < s.energyCapacity
        );
      }
    }
  );

  if (towers.length > 0) {
    towers.sort((a, b) => {
      return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
    });
    return transfer(creep, towers[0].id);
  }

  return false;
}

function transferUpgrade(creep) {
  let target;

  // first try finding a container near the controller to transfer to
  target = helpers.getTarget(creep, 'controllerContainer');
  if (target) {
    return transfer(creep, target);
  }

  // then try finding a link near the controller to transfer to
  target = helpers.getTarget(creep, 'controllerLink');
  if (target) {
    return transfer(creep, target);
  }

  // finally try finding a storage near the controller to transfer to
  target = helpers.getTarget(creep, 'controllerStorage');
  if (target) {
    return transfer(creep, target);
  }

  return false;
}

function transfer(creep, transferTarget) {
  let flag = true;

  if (creep.carry.energy === 0) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let target;

    if (creep.memory.task === 'transfer' && creep.memory.target) {
      target = creep.memory.target;
      let tempTarget = Game.getObjectById(target);

      // if the current target is now full, we can look for a new target
      if (
        (
          tempTarget.energyCapactity &&
          (creep.carry.energy + tempTarget.energy) >= tempTarget.energyCapacity
        ) ||
        (
          tempTarget.store &&
          (creep.carry.energy + _.sum(tempTarget.store)) >= tempTarget.storeCapacity
        )
      ) {
        target = null;
      }
    }

    if (!target && transferTarget) {
      target = transferTarget;
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
      if (creep.memory.task !== 'transfer') {
        creep.memory.task = 'transfer';
        creep.say('giving');
      }

      target = Game.getObjectById(target);

      let transferType;
      if (target.structureType === STRUCTURE_STORAGE) {
        if (creep.carry[RESOURCE_ENERGY]) {
          transferType = RESOURCE_ENERGY;
        } else {
          for (let carryType in creep.carry) {
            if (carryType !== RESOURCE_ENERGY) {
              transferType = carryType;
            }
          }
        }
      } else {
        transferType = RESOURCE_ENERGY;
      }

      flag = actions.transfer(creep, target, 'transfer', transferType);

      // stay here and keep depositing if the creep is still carrying anything
      if (!_.sum(creep.carry) === 0 && target.structureType) {
        creep.memory.task = 'transfer';
      }
    }
  }

  return flag;
}

// transfer things other than energy
function transferResources(creep) {
  let flag;

  if (
    Object.keys(creep.carry).length > 1
  ) {
    let target = Game.rooms[creep.memory.homeRoom].storage;

    if (!target) {
      flag = false;
    } else {
      if (creep.memory.task !== 'transferResources') {
        creep.memory.task = 'transferResources';
      }

      for (let type in creep.carry) {
        if (type === 'energy') {
          continue;
        }

        flag = actions.transfer(creep, target, 'transferResource', type);
        if (flag) {
          break;
        }
      }
    }
  } else {
    creep.memory.task = null;
    flag = false;
  }

  return flag;
}

function upgrade(creep) {
  let flag = true;

  if (
    creep.carry.energy === 0 ||
    ( // ensure creep has a useful amount of energy before heading off to upgrade
      creep.memory.task === 'upgrade' &&
      creep.memory.target &&
      creep.energy < 50 &&
      !creep.pos.isNearTo(Game.getObjectById(creep.memory.target))
    )
  ) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    if (creep.memory.task !== 'upgrade') {
      creep.memory.task = 'upgrade';
      creep.say('upgrading');
    }

    let result = creep.upgradeController(Game.rooms[creep.memory.homeRoom].controller);

    switch (result) {
      case ERR_INVALID_TARGET:
        // for some reason current target is no longer valid
        // reset target for next tick, but keep task as task should still be valid
        log.info(`upgrade: target no longer valid`);
        creep.memory.target = null;
        flag = false;
        break;
      case ERR_NOT_IN_RANGE:
        flag = actions.moveTo(creep, Game.rooms[creep.memory.homeRoom].controller, 'upgrade');
        break;
      case OK:
        log.info(`upgrade: controller is being enhanced`);
        // reset task now if creep is out of energy after upgrade
        if (creep.carry.energy === 0) {
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

function withdrawUpgrade(creep) {
  let target;

  // then try finding a link near the controller to withdraw from
  target = helpers.getTarget(creep, 'controllerLink');
  if (target) {
    return withdraw(creep, target);
  }

  // first try finding a container near the controller to withdraw from
  target = helpers.getTarget(creep, 'controllerContainer');
  if (target) {
    return withdraw(creep, target);
  }

  // finally try finding a storage near the controller to withdraw from
  target = helpers.getTarget(creep, 'controllerStorage');
  if (target) {
    return withdraw(creep, target);
  }

  return false;
}

function withdrawResources(creep) {
  let flag;

  if (_.sum(creep.carry) >= creep.carryCapacity) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let resourceContainer = Game.getObjectById(creep.memory.target);

    if (
      resourceContainer &&
      Object.keys(resourceContainer.store.length) <= 1
    ) {
      resourceContainer = null;
    }

    if (!resourceContainer) {
      let controllerLink = helpers.getTarget(creep, 'controllerLink');
      let resourceContainers = Game.rooms[creep.memory.homeRoom].find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            [
              STRUCTURE_CONTAINER
            ].includes(structure.structureType) &&
            (
              structure.id !== controllerLink &&
              Object.keys(structure.store).length > 1
            )
          );
        }
      });

      if (resourceContainers.length > 0) {
        resourceContainers.sort((a, b) => {
          return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
        });
        resourceContainer = resourceContainers[0];
      }
    }

    if (resourceContainer) {
      if (creep.memory.task !== 'transferResources') {
        creep.memory.task = 'transferResources';
      }
      creep.memory.target = resourceContainer.id;

      if (!creep.pos.isNearTo(resourceContainer)) {
        flag = actions.moveTo(creep, resourceContainer, 'transferResources');
      } else {
        for (let type in resourceContainer.store) {
          if (type === 'energy') {
            continue;
          }

          flag = actions.withdraw(creep, resourceContainer, 'transferResource', type);
        }

        if (_.sum(creep.carry) >= creep.carryCapacity) {
          creep.memory.target = null;
          creep.memory.task = null;
          flag = true;
        }
      }
    } else {
      creep.memory.target = null;
      creep.memory.task = null;
      flag = false;
    }
  }

  return flag;
}

function withdraw(creep, withdrawTarget) {
  let flag = true;

  if (_.sum(creep.carry) >= creep.carryCapacity) {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  } else {
    let target;

    if (creep.memory.task === 'withdraw' && creep.memory.target) {
      target = creep.memory.target;
      let tempTarget = Game.getObjectById(target);

      // if the current target is now empty, we can look for a new target
      if (
        tempTarget.energy < 2 ||
        (tempTarget.store && tempTarget.store.energy < 2)
      ) {
        target = null;
      }
    }

    if (!target) {
      if (withdrawTarget) {
        target = withdrawTarget;
      } else {
        target = helpers.getTarget(creep, 'energyStore');

        if (!target) {
        target = helpers.getTarget(creep, 'storage');
        }
      }
    }

    // if there is no target at this point, no valid target was found
    if (!target) {
      creep.memory.target = null;
      flag = false;
    } else {
      creep.memory.target = target;
      if (creep.memory.task !== 'withdraw') {
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
  fillupMasterStorage: fillupMasterStorage,
  fix: fix,
  getWorkEnergy: getWorkEnergy,
  guard: guard,
  harvest: harvest,
  mine: mine,
  motivate: motivate,
  parking: parking,
  patrol: patrol,
  pickup: pickup,
  rebirth: rebirth,
  recycle: recycle,
  renew: renew,
  staticHarvest: staticHarvest,
  transfer: transfer,
  transferMasterStorage: transferMasterStorage,
  transferResources: transferResources,
  transferStorage: transferStorage,
  transferUpgrade: transferUpgrade,
  withdraw: withdraw,
  withdrawResources: withdrawResources,
  withdrawUpgrade: withdrawUpgrade,
  upgrade: upgrade
};
