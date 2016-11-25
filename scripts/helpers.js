'use strict';

let log = require('logger');
let strings = require('strings');

function calculateCreepCost(parts) {
  let cost = 0;

  for (let part of parts) {
    if (BODYPART_COST[part]) {
      cost += BODYPART_COST[part];
    }
  }

  return cost;
}

function findPositionNearSpawn(creep) {
  let target;

  let spawn = getTarget(creep, 'spawn');

  if (spawn) {
    let i = 2;
    while (!creep.pos.findPathTo(spawn.pos.x + i, spawn.pos.y + i) && i < 11) {
      i++;
    }
    target = new RoomPosition(spawn.pos.x + i, spawn.pos.y + i, spawn.pos.roomName);
  }

  return target;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// returns an id of a target so that it can be stored in memory
// or returns null if no target can be found
function getTarget(creep, type, opts = {}) {
  let target = null;

  switch (type) {
    case 'buildable':
      let buildable = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
      if (buildable) {
        target = buildable.id;
      }
      break;

    case 'controllerLink':
      let controllerLink = Game.rooms[creep.memory.room].controller.pos.findClosestByRange(
        FIND_STRUCTURES, {
          filter: (s) => {
            return (
              s.structureType === STRUCTURE_LINK &&
              Game.rooms[creep.memory.room].controller.pos.getRangeTo(s) <= 3
            );
          }
        }
      );

      if (controllerLink) {
        target = controllerLink.id;
      }
      break;

    case 'droppedEnergy':
      let droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_ENERGY);
      if (droppedEnergy) {
        target = droppedEnergy.id;
      }
      break;

    // an energyHolder is a structure for creeps to transfer energy to
    case 'energyHolder':
      let energyHolder = creep.pos.findClosestByRange(
        FIND_STRUCTURES,
        {
          filter: (structure) => {
            if (opts.types) {
              return opts.types.includes(structure.structureType);
            } else {
              return (
                structure.structureType !== STRUCTURE_LINK &&
                structure.energyCapacity > 0 &&
                structure.energy < structure.energyCapacity
              );
            }
          }
        }
      );

      if (energyHolder) {
        target = energyHolder.id;
      }

      if (!target && !opts.types) {
        target = getTarget(creep, 'storage');
      }

      break;

    // an energyStore is a structure where a creep can withdraw energy from
    case 'energyStore':
      let energyStore;
      if (opts.filter) {
        let energyStores = Game.rooms[creep.memory.room].find(
          FIND_STRUCTURES,
          {
            filter: opts.filter
          }
        );
        if (energyStores.length) {
          energyStore = energyStores[0];
        }
      } else {
        energyStore = creep.pos.findClosestByRange(
          FIND_STRUCTURES,
          {
            filter: (store) => {
              return (
                [
                  STRUCTURE_EXTENSION,
                  STRUCTURE_LINK,
                  STRUCTURE_SPAWN,
                  STRUCTURE_STORAGE
                ].includes(store.structureType) &&
                (
                  store.energy >= 50 ||
                  (store.store && store.store[RESOURCE_ENERGY] >= 50)
                )
              );
            }
          }
        );
      }

      if (energyStore) {
        target = energyStore.id;
      }

      break;

    // any structure that has less than it's maximum hit points
    case 'fixable':
      let fixable = creep.pos.findClosestByRange(
        FIND_STRUCTURES,
        {
          filter: (structure) => {
            let maxHits = opts.maxHits || {};
            if (maxHits[structure.structureType]) {
              return structure.hits < maxHits[structure.structureType];
            } else {
              return structure.hits < structure.hitsMax;
            }
          }
        }
      );

      if (fixable) {
        target = fixable.id;
      }

      break;

    // special flag indicating a place for guards to stand
    case 'guardPost':
      let guardPosts = Game.rooms[creep.memory.room].find(FIND_FLAGS, {
        filter: (post) => {
          return /^GuardPost/.test(post.name);
        }
      });

      let guards = Game.rooms[creep.memory.room].find(FIND_MY_CREEPS, {
        filter: (guard) => {
          return guard.memory.role === 'guard';
        }
      });

      let guardedPosts = _.map(guards, (guard) => {
        return guard.memory.post;
      });

      for (let post of guardPosts) {
        if (!guardedPosts.includes(post.name)) {
          target = post.name;
          break;
        }
      }

      break;

    case 'link':

      break;

    // of opts.nearest is true will just find the nearest source
    // otherwise will evenly distribute creeps across sources in the room
    case 'source':
        let sources = Game.rooms[creep.memory.room].find(FIND_SOURCES, {
          filter: (source) => {
            return source.energy > 0;
          }
        });

        if (sources.length > 0) {

          if (opts.nearest) {
            target = _.min(sources, (i) => {
              return creep.pos.getRangeTo(i);
            });
            target = target.id;
          } else {
              let sourceIndex = 0;

              // ensure that creeps evenly distribute themselves to sources
              // TODO: make a source queue manager to assign sources to creeps
              if (sources.length > 1) {
                let targetedSources = {};
                for (let i = 0; i < sources.length; i++) {
                  targetedSources[sources[i].id] = {
                    count: 0,
                    index: i
                  };
                }

                for (let creepName in Game.creeps) {
                  if (Game.creeps[creepName]) {
                    let creep = Game.creeps[creepName];

                    if (_.map(sources, 'id').includes(creep.memory.target)) {
                      targetedSources[creep.memory.target].count += 1;
                    }
                  }
                }

                let targetSource = _.min(_.map(sources, 'id'), (sourceId) => {
                  return targetedSources[sourceId].count;
                });

                sourceIndex = targetedSources[targetSource].index;
              }

              target = sources[sourceIndex];
              target = target.id;
            }
          }
      break;

    case 'spawn':
      let spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);

      if (spawn) {
        target = spawn.id;
      }

      if (!target) {
        target = Game.spawns.Spawn1.id;
      }

      break;

    case 'storage':
      let storage;
      if (opts.filter) {
        let storages = Game.rooms[creep.memory.room].find(
          FIND_STRUCTURES,
          {
            filter: opts.filter
          }
        );
        if (storages.length) {
          storage = storages[0];
        }
      } else {
        storage = creep.pos.findClosestByRange(
          FIND_STRUCTURES,
          {
            filter: (storage) => {
              return (
                storage.structureType === STRUCTURE_STORAGE &&
                _.sum(storage.store) < storage.storeCapacity
              );
            }
          }
        );
      }

      if (storage) {
        target = storage.id;
      }

      break;

    // special flag indicating a place for staticHarvesters to stand
    case 'staticHarvestLocation':
      let staticHarvestLocations = Game.rooms[creep.memory.room].find(FIND_FLAGS, {
        filter: (location) => {
          return /^StaticHarvest/.test(location.name);
        }
      });

      let staticHarvesters = Game.rooms[creep.memory.room].find(FIND_MY_CREEPS, {
        filter: (found) => {
          return found.memory.role === 'staticHarvester';
        }
      });

      let alreadyTaken = _.map(staticHarvesters, (harvester) => {
        return harvester.memory.staticTarget;
      });

      for (let location of staticHarvestLocations) {
        if (!alreadyTaken.includes(location.name)) {
          target = location.name;
          break;
        }
      }

      break;
    default:
  }

  if (target) {
    log.info(`setting target to '${target}'`);
  }
  return target;
}

function moveAwayFromSource(creep, sourceId) {
  let source = Game.getObjectById(sourceId);

  let xdir = creep.pos.x - source.pos.x;
  let ydir = creep.pos.y - source.pos.y;

  if (creep.pos.findPathTo(creep.pos.x + xdir, creep.pos.y + ydir)) {
    creep.moveTo(creep.pos.x + xdir, creep.pos.y + ydir);
  } else if (creep.pos.findPathTo(creep.pos.x + ydir, creep.pos.y + xdir)) {
    creep.moveTo(creep.pos.x + ydir, creep.pos.y + xdir);
  }

  log.info(`moving away from source`);
}

function generateName(role = 'harvester') {
  let title = strings.titles[role] || _.upperFirst(role);

  let currentNames = Object.keys(Game.creeps);
  let name = `${title}_${strings.names[getRandomInt(0, strings.names.length - 1)]}`;
  while (currentNames.includes(name)) {
    name = `${title}_${strings.names[getRandomInt(0, strings.names.length - 1)]}`;
  }

  return name;
}

module.exports = {
  calculateCreepCost: calculateCreepCost,
  generateName: generateName,
  getRandomInt: getRandomInt,
  getTarget: getTarget,
  moveAwayFromSource: moveAwayFromSource
};
