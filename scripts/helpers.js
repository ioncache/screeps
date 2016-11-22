'use strict';

let log = require('logger');
let strings = require('strings');

function findCoordNearSpawn(creep) {
  let target;

  let spawns = creep.room.find(
    FIND_STRUCTURES,
    {
      filter: (structure) => {
        return structure.structureType == STRUCTURE_SPAWN;
      }
    }
  );

  if (spawns.length) {
    let spawn = spawns[0];

    let i = 1;
    while (!creep.pos.findPathTo(spawn.pos.x + i, spawn.pos.y + i) && i < 10) {
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
      let buildables = creep.room.find(FIND_CONSTRUCTION_SITES);
      if (buildables.length) {
        target = _.min(buildables, (i) => {
          return creep.pos.getRangeTo(i);
        });
        target = target.id;
      }
      break;
    case 'droppedEnergy':
      let droppedEnergy = creep.room.find(FIND_DROPPED_ENERGY);
      if (droppedEnergy.length) {
        target = _.min(droppedEnergy, (i) => {
          return creep.pos.getRangeTo(i);
        });
        target = target.id;
      }
      break;
    case 'energyHolder':
      let energyHolders;

      energyHolders = creep.room.find(
        FIND_STRUCTURES,
        {
          filter: (structure) => {
            if (opts.types) {
              return opts.types.includes(structure.structureType);
            } else {
              return (
                structure.structureType == STRUCTURE_SPAWN &&
                structure.energy < structure.energyCapacity
              );
            }
          }
        }
      );

      if (energyHolders.length) {
        target = _.min(energyHolders, (i) => {
          return creep.pos.getRangeTo(i);
        });
        target = target.id;
      } else {
        energyHolders = creep.room.find(
          FIND_STRUCTURES,
          {
            filter: (structure) => {
              if (opts.types) {
                return opts.types.includes(structure.structureType);
              } else {
                return (
                  structure.energyCapacity > 0 &&
                  structure.energy < structure.energyCapacity
                );
              }
            }
          }
        );

        if (energyHolders.length) {
          target = _.min(energyHolders, (i) => {
            return creep.pos.getRangeTo(i);
          });
          target = target.id;
        }

        if (!target && !opts.types) {
          target = getTarget(creep, 'storage');
        }
      }

      break;
    case 'energyStore':
      let energyStores;
      if (opts.filter) {
        energyStores = creep.room.find(
          FIND_STRUCTURES,
          {
            filter: opts.filter
          }
        );
      } else {
        energyStores = creep.room.find(
          FIND_STRUCTURES,
          {
            filter: (store) => {
              return (
                [
                  STRUCTURE_CONTAINER,
                  STRUCTURE_EXTENSION,
                  STRUCTURE_SPAWN,
                  STRUCTURE_STORAGE
                ].includes(store.structureType) &&
                (
                  store.energy > 1 ||
                  ( store.store && store.store[RESOURCE_ENERGY] > 1 )
                )
              );
            }
          }
        );
      }

      if (energyStores.length) {
        target = _.min(energyStores, (i) => {
          return creep.pos.getRangeTo(i);
        });
        target = target.id;
      }

      break;
    case 'fixable':
      let fixables = creep.room.find(
        FIND_STRUCTURES,
        {
          filter: (structure) => {
            opts.maxHits = opts.maxHits || {};
            if (opts.maxHits[structure.structureType]) {
              return structure.hits < opts.maxHits[structure.structureType];
            } else {
              return structure.hits < structure.hitsMax;
            }
          }
        }
      );

      if (fixables.length) {
        target = _.min(fixables, (i) => {
          return creep.pos.getRangeTo(i);
        });
        target = target.id;
      }

      break;
    case 'guardPost':
      let guardPosts = creep.room.find(FIND_FLAGS, {
        filter: (post) => {
          return /^GuardPost/.test(post.name);
        }
      });

      let guards = creep.room.find(FIND_MY_CREEPS, {
        filter: (guard) => {
          return guard.memory.role == 'guard';
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
    case 'source':
        let sources = creep.room.find(FIND_SOURCES);

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
                  }
                }

                for (let creepName in Game.creeps) {
                  let creep = Game.creeps[creepName];

                  if (_.map(sources, 'id').includes(creep.memory.target)) {
                    targetedSources[creep.memory.target].count += 1;
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
      let spawns = creep.room.find(FIND_MY_SPAWNS);

      spawns.sort((a, b) => {
        return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
      });

      if (spawns.length) {
        target = spawns[0].id;
      }

      if (!target) {
        target = Game.spawns.Spawn1.id;
      }

      break;
    case 'storage':
      let storages;
      if (opts.filter) {
        storages = creep.room.find(
          FIND_STRUCTURES,
          {
            filter: opts.filter
          }
        );
      } else {
        storages = creep.room.find(
          FIND_STRUCTURES,
          {
            filter: (storage) => {
              return (
                storage.structureType == STRUCTURE_STORAGE &&
                storage.storeCapacity > 0 &&
                _.sum(storage.store) < storage.storeCapacity
              );
            }
          }
        );
      }

      if (storages.length) {
        target = _.min(storages, (i) => {
          return creep.pos.getRangeTo(i);
        });
        target = target.id;
      }

      break;
    case 'staticHarvestLocation':
      let staticHarvestLocations = creep.room.find(FIND_FLAGS, {
        filter: (location) => {
          return /^StaticHarvest/.test(location.name);
        }
      });

      let staticHarvesters = creep.room.find(FIND_MY_CREEPS, {
        filter: (found) => {
          return found.memory.role == 'staticHarvester';
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
  let title = strings.titles[role] || 'NoNameDude';

  let currentNames = Object.keys(Game.creeps);
  let name = `${title}_${strings.names[getRandomInt(0, strings.names.length - 1)]}`;
  while (currentNames.includes(name)) {
    name = `${title}_${strings.names[getRandomInt(0, strings.names.length - 1)]}`;
  }

  return name;
}

module.exports = {
  generateName: generateName,
  getRandomInt: getRandomInt,
  getTarget: getTarget,
  moveAwayFromSource: moveAwayFromSource
};
