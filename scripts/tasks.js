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
      if (
        creep.room.controller.owner &&
        creep.room.controller.owner.username !== config.masterOwner
      ) {
        flag = actions.attack(creep, creep.room.controller, 'claim', 'attackController');
      } else {
        creep.reserveController(creep.room.controller);
        if (creep.room.controller.owner.username === config.masterOwner) {
          log.info(`claim: I already own the controller in this room`);
          Game.flags[creep.memory.target].remove();
          creep.memory.target = null;
          creep.memory.task = null;
          flag = false;
        } else if (Object.keys(Game.rooms).length < Game.gcl.level) { // TODO: fix, object.keys is wrong
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
        } else if (
          !creep.room.controller.reservation ||
          creep.room.controller.owner.username === config.masterOwner
        ) {
          log.info(`claim: reserving new controller`);
          let reserveController = creep.reserveController(creep.room.controller);
          flag = true;
        } else {
          log.info(`claim: current gcl not high enough to claim new room`);
          flag = true;
        }
      }
    }
  }  else {
    creep.memory.target = null;
    creep.memory.task = null;
    flag = false;
  }

  return flag;
}

function clearRoom(creep) {
  let flag;

  let healBodyParts = creep.body.filter((p) => {
    return p.type === HEAL && p.hits > 0;
  });

  if (
    creep.hits < creep.hitsMax &&
    healBodyParts.length > 0
  ) {
    creep.heal(creep);
  }

  let attackBodyParts = creep.body.filter((p) => {
    return [ATTACK, RANGED_ATTACK].includes(p.type) && p.hits > 0;
  });

  // run away to home room to heal if needed
  if (
    creep.hits < creep.hitsMax &&
    attackBodyParts.lentgh === 0
  ) {
    flag = actions.moveTo(creep, Game.rooms[creep.memory.homeRoom].controller, 'raid');
  } else {
    // TODO: determine raid targets automatically
    // inital target selection:
    // 1. make a flag, eg, 'RaidTarget_01'
    // 2. save target to creep memory, eg, Game.creeps[creepName].memory.raidTarget = 'RaidTarget_01';
    let raidTarget = Game.flags[creep.memory.raidTarget];

    // determine if creep is in raid target room or not
    if (
      raidTarget &&
      raidTarget.room &&
      raidTarget.room.name === creep.room.name
    ) {
      let destroyTarget;

      if (creep.memory.destroyTarget !== 'none') {
        destroyTarget = Game.flags[creep.memory.destroyTarget];

        if (!destroyTarget) {
          destroyTarget = creep.pos.findClosestByRange(FIND_FLAGS, {
            filter: (f) => /^DestroyTarget/.test(f.name)
          });
        }

        if (!destroyTarget) {
          creep.memory.destroyTarget = 'none';
        }
      }

      let destroyObject;
      if (destroyTarget) {
        let look = destroyTarget.pos.look();

        for (let i of look) {
          if (
            i.structure &&
            [STRUCTURE_RAMPART, STRUCTURE_WALL].includes(i.structure.structureType)
          ) {
            destroyObject = i.structure;
            break;
          }
        }
      }

      // TODO: maybe not go back and destroy object if it's already
      //       been destroyed and rebuilt
      if (destroyObject) {
        flag = actions.attack(creep, destroyObject, 'raid');
      } else {
        // attack things!

        // 1. find towers
        let towers = creep.room.find(FIND_HOSTILE_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_TOWER });

        if (towers.length > 0) {
          towers.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
          flag = actions.attack(creep, towers[0], 'raid');
        } else {
          let allHostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS);

          if (allHostileCreeps.length > 0) {
            let atackParts = [
              ATTACK,
              RANGED_ATTACK
            ];
            // 2. find creeps with attack
            let attackCreeps = allHostileCreeps.filter((c) => c.body.some((p) => atackParts.includes(p.type)));

            if (attackCreeps.length > 0) {
              attackCreeps.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
              flag = actions.attack(creep, attackCreeps[0], 'raid');
            } else {
              // 3. find creeps with heal
              let healCreeps = allHostileCreeps.filter((c) => c.body.includes(HEAL));

              if (healCreeps.length > 0) {
                healCreeps.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
                flag = actions.attack(creep, healCreeps[0], 'raid');
              } else {
                // 4. find other creeps
                allHostileCreeps.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
                flag = actions.attack(creep, allHostileCreeps[0], 'raid');
              }
            }
          } else {
            // 5. destroy spawns
            let spawns = creep.room.find(FIND_HOSTILE_STRUCTURES, {
              filter: (s) => s.structureType === STRUCTURE_SPAWN
            });

            if (spawns.length > 0) {
              flag = actions.attack(creep, spawns[0], 'raid');
            } else {
              // 6. move near controller and wait
              if (
                creep.room.controller &&
                creep.pos.getRangeTo(creep.room.controller) > 2
              ) {
                flag = actions.moveTo(creep, creep.room.controller, 'raid');
              }
            }
          }
        }
      }
    } else if (raidTarget) {
      flag = actions.moveTo(creep, raidTarget, 'raid');
    } else { // do nothing if there is no current raid target set
      flag = false;
    }
  }

  return flag;
}

function decoy(creep) {
  let flag;

  let hasHealed = false;

  let healBodyParts = creep.body.filter((p) => {
    return p.type === HEAL && p.hits > 0;
  });

  let moveBodyParts = creep.body.filter((p) => {
    return p.type === MOVE && p.hits > 0;
  });

  if (
    creep.hits < creep.hitsMax &&
    healBodyParts.length > 0
  ) {
    creep.heal(creep);
    hasHealed = true;
  }

  // run away to home room to heal if needed
  if (
    creep.hits < creep.hitsMax &&
    moveBodyParts.lentgh <= 2
  ) {
    flag = actions.moveTo(creep, Game.rooms[creep.memory.homeRoom].controller, 'decoy');
  } else {
    let decoyTarget = Game.flags[creep.memory.decoyTarget];

    // determine if creep is in raid target room or not
    if (
      decoyTarget &&
      decoyTarget.room &&
      creep.pos.getRangeTo(decoyTarget) === 0
      // decoyTarget.room.name === creep.room.name
    ) {
      // TODO:
      // 1. heal any friendly creeps in range if needed
      // 2. follow friendly troops around

      // for now just hang out and sbsorb hits
      flag = true;
    } else if (decoyTarget) {
      flag = actions.moveTo(creep, decoyTarget, 'decoy');
    } else { // do nothing if there is no current raid target set
      flag = false;
    }
  }

  return flag;
}

function fillupMasterStorage(creep) {
  return fillup(creep, true, 'fillupMasterStorage');
}

function fillup(creep, waitUntilFull = false, task) {
  let flag;

  if (creep.carry.energy >= creep.carryCapacity) {
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

  if (
    creep.carry.energy === 0 ||
    // don't do fix task if there are towers, they do it better
    creep.room.find(FIND_MY_STRUCTURES, { filter: (s) => s.structureType === STRUCTURE_TOWER }).length > 0
  ) {
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
          (config.minHits[tempTarget.structureType] &&
          tempTarget.hits > config.minHits[tempTarget.structureType](creep.room)) ||
          tempTarget.hits >= tempTarget.hitsMax
        ) {
          log.info('fix: resetting target as it does not need fixing');
          target = null;
        }
      }
    }

    if (!target) {
      target = helpers.getTarget(creep, 'fixable', { minHits: config.minHits });
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
            config.minHits[target.structureType] &&
            target.hits > config.minHits[target.structureType](creep.room)
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

    let guardPosts = Game.rooms[creep.memory.homeRoom].find(FIND_FLAGS, {
      filter: (post) => {
        return post.name === creep.memory.post;
      }
    });

    if (Game.flags[post]) {
      if (creep.pos.getRangeTo(Game.flags[post]) > 0) {
        flag = actions.moveTo(creep, Game.flags[post], 'guard');
      } else {
        let closestHostileCreep = creep.room.findClosestByRange(FIND_HOSTILE_CREEPS, {
          filter: (c) => creep.pos.getRangeTo(c) <= 3
        });

        if (closestHostileCreep) {
          log.info(`guard: defending against ${closestHostileCreep}`);
          flag = actions.rangedAttack(creep, closestHostileCreep, 'guard');
        } else {
          log.info(`guard: guarding ${post}`);
          if (helpers.getRandomInt(1, 100) > 90) {
            creep.say(strings.guardChat[helpers.getRandomInt(0, strings.guardChat.length - 1)], true);
          }
          flag = true;
        }
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
        helpers.moveTowardsParking(creep);
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

function hunt(creep) {
  let flag;

  if (
    creep.hits < creep.hitsMax &&
    !creep.memory.isEngaged
  ) {
    creep.heal(creep);
    return false;
  }

  let attackBodyParts = creep.body.filter((p) => {
    return p.type === ATTACK && p.hits > 0;
  });

  let keeperTarget = Game.flags[creep.memory.keeperTarget];

  if (
    keeperTarget &&
    keeperTarget.room &&
    keeperTarget.room.name === creep.room.name
  ) {
    let target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {
      filter: (c) => c.room.name === creep.room.name
    });

    if (target) {
      if (creep.pos.getRangeTo(target) > 1) {
        creep.memory.isEngaged = false;
        flag = actions.moveTo(creep, target, 'hunt');
      } else {
        creep.memory.isEngaged = true;
        flag = actions.attack(creep, target, 'hunt');
      }
    } else {
      creep.memory.isEngaged = false;
      let lairs = creep.room.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_KEEPER_LAIR
      });
      lairs.sort((a, b) => a.ticksToSpawn - b.ticksToSpawn);
      if (creep.pos.getRangeTo(lairs[0]) > 1) {
        flag = actions.moveTo(creep, lairs[0], 'hunt');
      } else {
        flag = false;
      }
    }
  } else if (keeperTarget) {
    flag = actions.moveTo(creep, keeperTarget, 'hunt');
  } else { // do nothing if there is no current keeper target set
    creep.memory.isEngaged = false;
    flag = false;
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

function parking(creep, moveOnly = false) {
  let flag;

  let parking = creep.pos.findClosestByRange(FIND_FLAGS, {
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
    if (!moveOnly) {
      creep.memory.task = 'parking';
      creep.memory.parkingMeter = 10; // ticks to go park for
    }
    flag = true;
  } else if (parking) {
    if (!moveOnly) {
      creep.memory.parkingMeter -= 1;
      if (!creep.memory.parkingMeter) {
        creep.memory.task = null;
        flag = false;
      }
    }
  } else {
    creep.memory.task = null;
    flag = false;
  }

  return flag;
}

// TODO: implement
function patrol(creep) {
  log.info(`patrol: well I would, but patrolling isn't implemented yet`);

  return false;
}

// TODO: make a dropped item queue, so that multiple creeps don't always swarm
//       towards the same dropped item
function pickup(creep, targetObject) {
  let flag = true;

  let atackParts = [
    ATTACK,
    RANGED_ATTACK
  ];

  let dangerousHostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS, {
    filter: (c) => c.body.some((p) => atackParts.includes(p.type))
  });

  // don't do pickup task if there are attack type creeps around
  if (dangerousHostileCreeps.length > 0) {
    flag = false;
  } else if (creep.carry.energy < creep.carryCapacity) {
    // always get a new target, if for some reason there is other
    // droppedResource closer, might as well get that instead of original
    let target = targetObject || helpers.getTarget(creep, 'droppedResource');

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
// - travel time for this type of creep back to the spawn for renewal
//   would be too much, and just spawning a new one makes more sense
//
// this task will
// - calculate when rebirth task should kick off based on
//   - time to live of current creep
//   - distance to spawn
//   - number of turns to spawn creep
// - trigger spawning of new creep
// - set flag rebirthInProgress after triggering spawn so that
//   multiple spawns don't occur
// - give new creep a name to original but with added generation indicator
// - copy current creep's memory to new creep
// - set task of current creep to recycle -- maybe wait a bit so new creep gets
//   near to old creep before triggering recycle task
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

// TODO:
// - go to harvest spot
// - harvest until full
// - return to storage and drop off
// - go renew
// - repeat ad infinitum
function remoteHarvest(creep) {
  let flag;

  let currentCarry = _.sum(creep.carry);

  if (currentCarry >= creep.carryCapacity) {
    // go transfer all resources
    flag = transferMasterStorage(creep);
  } else {
    if (
      (currentCarry === 0 &&
      creep.ticksToLive < 1100) ||
      creep.memory.task === 'continueRenew'
    ) {
      // go renew
      creep.memory.task = 'renew';
      flag = renew(creep, 'remoteHarvest', 1500);
      if (creep.ticksToLive < 1490) {
        creep.memory.task = 'continueRenew';
      } else {
        creep.memory.task = null;
      }
    } else {
      // go remote harvest sucker

      if (!creep.memory.remoteHarvestTarget) {
        creep.memory.remoteHarvestTarget = helpers.getTarget(creep, 'remoteHarvestLocation');
      }

      // sadly there are no remote harvest locations
      // which shouldn't really be possible since there should be
      if (!creep.memory.remoteHarvestTarget) {
        flag = false;
      } else  {
        let remoteHarvestLocation = Game.flags[creep.memory.remoteHarvestTarget];

        if (creep.pos.getRangeTo(remoteHarvestLocation) !== 0) {
          flag = actions.moveTo(creep, remoteHarvestLocation, 'remoteHarvest');
        } else {
          let sourceTarget = Game.getObjectById(creep.memory.sourceTarget);
          if (!sourceTarget) {
            sourceTarget = creep.pos.findClosestByRange(FIND_SOURCES);
            creep.memory.sourceTarget = sourceTarget.id;
          }

          flag = actions.harvest(creep, sourceTarget, 'remoteHarvest');
        }
      }
    }
  }

  return flag;
}

// TODO: need to update renew task so that creeps can determine distance to
//       spawn and how long they need to get there before renewal
function renew(creep, nextTask, maxTicksToLive = 750) {
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
          helpers.moveTowardsParking(creep);
          flag = true;
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
              creep.transfer(spawn, RESOURCE_ENERGY);
            } else {
              creep.memory.task = 'harvest'; // go harvest for energy to renew with
              creep.memory.target = helpers.getTarget(creep, 'source');
            }
            flag = true;
          }
          break;
        case OK:
          log.info(`renew: renewing`);
          if (creep.ticksToLive >= maxTicksToLive) { // move on to other things
            creep.memory.target = null;
            creep.memory.task = nextTask || null;
            helpers.moveTowardsParking(creep);
            flag = true;
          }
          flag = true;
        default:
          flag = true;
      }
    }
  } else {
    creep.memory.target = nextTask || null;
    creep.memory.task = null;
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
          }
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

      if (staticTarget && creep.pos.getRangeTo(staticTarget) > 0) {
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

function steal(creep) {
  let flag;

  // just recycle the creep if it's getting close to death
  if (creep.ticksToLive <= 125) {
    creep.memory.task = 'recycle';
    flag = true;
  } else if (_.sum(creep.carry) >= creep.carryCapacity) {
    flag = false;
  } else {
    creep.memory.task = 'steal';
    let thieveryTarget = Game.flags[creep.memory.thieveryTarget];

    if (
      thieveryTarget &&
      thieveryTarget.room &&
      thieveryTarget.room.name === creep.room.name
    ) {
      // pickup any resources on the ground first since they expire
      let targetObject = helpers.getTarget(creep, 'droppedResource', { room: creep.room.name });

      if (targetObject) {
        flag = pickup(creep, targetObject);
        flag = true;
        creep.memory.task = 'steal';
      } else {
        // steal any resources from resource holders
        let containers = creep.room.find(
          FIND_STRUCTURES,
          {
            filter: (c) => {
              return (
                c.structureType === STRUCTURE_CONTAINER &&
                _.sum(c.store) > 0
              );
            }
          }
        );

        if (containers.length > 0) {
          containers.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));

          for (let i in containers[0].store) {
            if (containers[0].store.hasOwnProperty(i)) {
              flag = actions.withdraw(creep, containers[0], 'steal', i);
              if (flag) {
                break;
              }
            } else {
              flag = false;
            }
          }
        } else {
          flag = false;
        }
      }
    } else if (thieveryTarget) {
      flag = actions.moveTo(creep, thieveryTarget, 'steal');
    } else { // do nothing if there is no current thievery target set
      flag = false;
    }

    // don't move on to other tasks if creep has nothing on him
    if (!flag && _.sum(creep.carry) === 0) {
      flag = true;
    }
  }

  return flag;
}

function trade(creep) {
  let flag;

  let currentCarry = _.sum(creep.carry);
  // shouldn't really ever happen, but might as well catch the case
  // where no terminal exists
  if (!Game.rooms[creep.memory.homeRoom].terminal) {
    flag = false;
  } else if (
    creep.memory.tradeType &&
    (
      currentCarry >= creep.carryCapacity ||
      (
        currentCarry > 0 &&
        creep.memory.tradeAmount <= 0
      )
    )
  ) {
    // take current carry to the terminal

    flag = true;
  } else if (
    creep.memory.tradeType &&
    creep.memory.tradeAmount > 0
  ) {
    // fill up from the storage

    flag = true;
  } else {
    // nothing to do
    flag = false;
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
  let towers = Game.rooms[creep.memory.homeRoom].find(
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
    towers.sort((a, b) => creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b));
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
        // always transfer energy first
        if (creep.carry[RESOURCE_ENERGY]) {
          transferType = RESOURCE_ENERGY;
        } else {
          for (let carryType in creep.carry) {
            if (carryType !== RESOURCE_ENERGY) {
              transferType = carryType;
              // quit after finding first non energy resource type
              break;
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
    let storage = Game.getObjectById(target);
    if (
      creep.memory.role === 'energizer' ||
      // always leave a minimum amount of energy in storage to
      // account for emergencies -- energizers excluded
      storage.store[RESOURCE_ENERGY] >=
      (creep.room.controller.level * 5000 + 50)
    ) {
      return withdraw(creep, target);
    }
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
  clearRoom: clearRoom,
  decoy: decoy,
  fillup: fillup,
  fillupMasterStorage: fillupMasterStorage,
  fix: fix,
  getWorkEnergy: getWorkEnergy,
  guard: guard,
  harvest: harvest,
  hunt: hunt,
  mine: mine,
  motivate: motivate,
  parking: parking,
  patrol: patrol,
  pickup: pickup,
  rebirth: rebirth,
  recycle: recycle,
  remoteHarvest: remoteHarvest,
  renew: renew,
  staticHarvest: staticHarvest,
  steal: steal,
  trade: trade,
  transfer: transfer,
  transferMasterStorage: transferMasterStorage,
  transferResources: transferResources,
  transferStorage: transferStorage,
  transferTower: transferTower,
  transferUpgrade: transferUpgrade,
  withdraw: withdraw,
  withdrawResources: withdrawResources,
  withdrawUpgrade: withdrawUpgrade,
  upgrade: upgrade
};
