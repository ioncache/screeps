'use strict';

let log = require('logger');
let strings = require('strings');

function setLogger(logger) {
  log = logger;
}

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
function getTarget(creep, type, config = {}) {
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
      if (droppedEnergy.length > 0) {
        target = droppedEnergy[0];
        target = target.id;
      }
      break;
    case 'energyStore':
      let energyStores = creep.room.find(
        FIND_STRUCTURES,
        {
          filter: (store) => {
            return (
              [
                STRUCTURE_EXTENSION,
                STRUCTURE_SPAWN,
                STRUCTURE_STORAGE
              ].includes(store.structureType) &&
              store.energy > 1
            );
          }
        }
      );

      if (energyStores.length) {
        energyStores.sort((a, b) => {
          return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
        });

        target = energyStores[0].id;
      }

      break;
    case 'fixable':
      let fixables = creep.room.find(
        FIND_STRUCTURES,
        {
          filter: (structure) => {
            config.maxHits = config.maxHits || {};
            if (config.maxHits[structure.structureType]) {
              return structure.hits < config.maxHits[structure.structureType];
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
      if (creep.carry.energy < creep.carryCapacity) {
          let sources = creep.room.find(FIND_SOURCES);

          if (sources.length > 0) {
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
            log.info(`setting target to source '${target}'`);
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
      let structures = creep.room.find(
        FIND_STRUCTURES,
        {
          filter: (structure) => {
            return (
              structure.energyCapacity > 0 &&
              structure.energy < structure.energyCapacity
            );
          }
        }
      );

      structures.sort((a, b) => {
        return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
      });

      for (let potentialTarget of structures) {
        if (potentialTarget.energy < potentialTarget.energyCapacity) {
          target = potentialTarget;
          log.info(`setting target to structure '${target}'`);
          target = target.id;
          break;
        }
      }
      break;
    default:
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
  let title = strings.titles[role] || strings.titles.harvester;

  let currentNames = Object.keys(Game.creeps);
  let name = `${title}_${strings.names[getRandomInt(0, strings.names.length - 1)]}`;
  while (currentNames.includes(name)) {
    name = `prefixes[role]_${strings.names[getRandomInt(0, strings.names.length - 1)]}`;
  }

  return name;
}

module.exports = {
  generateName: generateName,
  getRandomInt: getRandomInt,
  getTarget: getTarget,
  moveAwayFromSource: moveAwayFromSource,
  setLogger: setLogger
};
