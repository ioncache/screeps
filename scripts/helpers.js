'use strict';

let config = require('config');
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

// Attack effectiveness	600 hits at range ≤5 to 150 hits at range ≥20
// Heal effectiveness	400 hits at range ≤5 to 100 hits at range ≥20
// Repair effectiveness	800 hits at range ≤5 to 200 hits at range ≥20
function calculateTowerEffectiveness(action, range) {
  let actions = {
    attack: {
      max: 600,
      min: 150
    },
    heal: {
      max: 400,
      min: 100
    },
    repair: {
      max: 800,
      min: 200
    }
  };

  if (!actions[action]) {
    return -1;
  } else {
    let actionValues = actions[action];
    if (range <= 5) {
      return actionValues.max;
    } else if (range >= 20) {
      return actionValues.min;
    } else {
      let step = (actionValues.max - actionValues.min) / 15;
      return actionValues.max - ((range - 5) * step);
    }
  }
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

// TODO: generate a random or incremental # as name if all names are currently taken for the role requested
function generateName(role = 'harvester') {
  let title = strings.titles[role] || role;

  let currentNames = Object.keys(Game.creeps);
  let name = `${title}_${strings.names[getRandomInt(0, strings.names.length - 1)]}`;
  while (currentNames.includes(name)) {
    name = `${title}_${strings.names[getRandomInt(0, strings.names.length - 1)]}`;
  }

  return name;
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// returns an id of a target so that it can be stored in memory
// or returns null if no target can be found
function getTarget(creep, type, opts = {}) {
  let target = null;

  let targetRoom = opts.room || creep.memory.homeRoom;

  switch (type) {
    case 'buildable':
      let buildables = Game.rooms[creep.memory.homeRoom].find(FIND_MY_CONSTRUCTION_SITES, {
        filter: (i) => {
          return i.room.name === creep.memory.homeRoom;
        }
      });

      if (buildables .length > 0) {
        buildables.sort((a, b) => {
          return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
        });
        target = buildables[0].id;
      }
      break;

    case 'controllerContainer':
      target = getTarget(creep, 'controllerStructure', {
        distance: 3,
        types: [STRUCTURE_CONTAINER]
      });
      break;

    case 'controllerLink':
      target = getTarget(creep, 'controllerStructure', {
        distance: 3,
        types: [STRUCTURE_LINK]
      });
      break;

    case 'controllerStorage':
      target = getTarget(creep, 'controllerStructure', {
        distance: 3,
        types: [STRUCTURE_STORAGE]
      });

    case 'controllerStructure':
      let maxDistanceFromController = opts.distance || 3;
      let controllerStructure = Game.rooms[creep.memory.homeRoom].controller.pos.findClosestByRange(
        FIND_STRUCTURES, {
          filter: (s) => {
            if (opts.types) {
              return (
                opts.types.includes(s.structureType) &&
                Game.rooms[creep.memory.homeRoom].controller.pos.getRangeTo(s) <= maxDistanceFromController &&
                (
                  (s.energy && s.energy > 0) ||
                  (s.store && s.store[RESOURCE_ENERGY] > 0)
                )
              );
            } else {
              return (
                Game.rooms[creep.memory.homeRoom].controller.pos.getRangeTo(s) <= maxDistanceFromController &&
                (
                  (s.energy && s.energy > 0) ||
                  (s.store && s.store[RESOURCE_ENERGY] > 0)
                )
              );
            }
          }
        }
      );

      if (controllerStructure) {
        target = controllerStructure.id;
      }
      break;

    case 'droppedResource':
      // priortize resources over energy
      let droppedResource = Game.rooms[targetRoom].find(
        FIND_DROPPED_RESOURCES,
        {
          filter: (i) => {
            return i.room.name === targetRoom;
          }
        }
      );

      if (droppedResource.length > 0) {
        droppedResource.sort((a, b) => {
          return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
        });
        target = droppedResource[0].id;
      } else {
        droppedResource = Game.rooms[targetRoom].find(
          FIND_DROPPED_ENERGY,
          {
            filter: (i) => {
              return i.room.name === targetRoom;
            }
          }
        );

        if (droppedResource.length > 0) {
          droppedResource.sort((a, b) => {
            return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
          });
          target = droppedResource[0].id;
        }
      }

      break;

    // an energyHolder is a structure for creeps to transfer energy to
    case 'energyHolder':
      let energyHolders;
      if (opts.filter) {
        energyHolders = Game.rooms[creep.memory.homeRoom].find(
          FIND_STRUCTURES,
          {
            filter: opts.filter
          }
        );
      } else {
        energyHolders = Game.rooms[creep.memory.homeRoom].find(
          FIND_STRUCTURES,
          {
            filter: (structure) => {
              if (opts.types) {
                return opts.types.includes(structure.structureType);
              } else {
                let excludeTypes = [
                  STRUCTURE_LINK,
                  STRUCTURE_TOWER // energizers will handle towers
                ];

                return (
                  structure.room.name === creep.memory.homeRoom &&
                  !excludeTypes.includes(structure.structureType) &&
                  structure.energyCapacity > 0 &&
                  structure.energy < structure.energyCapacity
                );
              }
            }
          }
        );
      }

      if (energyHolders.length > 0) {
        energyHolders.sort((a, b) => {
          return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
        });
        target = energyHolders[0].id;
      }

      if (!target && !opts.types) {
        target = getTarget(creep, 'storage');
      }

      break;

    // an energyStore is a structure where a creep can withdraw energy from
    case 'energyStore':
      let energyStores;
      if (opts.filter) {
        energyStores = Game.rooms[creep.memory.homeRoom].find(
          FIND_STRUCTURES,
          {
            filter: opts.filter
          }
        );
        if (energyStores.length > 0) {
          target = energyStores[0].id;
        }
      } else {
        energyStores = Game.rooms[creep.memory.homeRoom].find(
          FIND_STRUCTURES,
          {
            filter: (store) => {
              return (
                store.room.name === creep.memory.homeRoom &&
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

        if (energyStores.length > 0) {
          energyStores.sort((a, b) => {
            return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
          });
          target = energyStores[0].id;
        }
      }

      break;

    // any structure that has less than it's maximum hit points
    case 'fixable':
      let fixables = Game.rooms[creep.memory.homeRoom].find(
        FIND_STRUCTURES,
        {
          filter: (structure) => {
            let minHits = opts.minHits || {};
            if (minHits[structure.structureType]) {
              return (
                structure.room.name === creep.memory.homeRoom &&
                structure.hits < minHits[structure.structureType](creep.room)
              );
            } else {
              return (
                structure.room.name === creep.memory.homeRoom &&
                structure.hits < structure.hitsMax
              );
            }
          }
        }
      );

      if (fixables.length > 0) {
        fixables.sort((a, b) => {
          return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
        });
        target = fixables[0].id;
      }
      break;

    // special flag indicating a place for guards to stand
    case 'guardPost':
      let guardPosts = Game.rooms[creep.memory.homeRoom].find(FIND_FLAGS, {
        filter: (post) => {
          return /^GuardPost/.test(post.name);
        }
      });

      let guards = Game.rooms[creep.memory.homeRoom].find(FIND_MY_CREEPS, {
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

    // special flag indicating a place for remoteHarvesters to stand
    case 'remoteHarvestLocation':
      let remoteHarvestLocations = Object.keys(Game.flags).filter((flagName) => {
        return /^RemoteHarvest/.test(flagName);
      });

      let remoteHarvesters = Object.keys(Game.creeps).filter((creepName) => {
        return Game.creeps[creepName].memory.role === 'remoteHarvester';
      });

      let remoteAlreadyTaken = _.map(remoteHarvesters, (creepName) => {
        return Game.creeps[creepName].memory.remoteTarget;
      });

      for (let location of remoteHarvestLocations) {
        if (!remoteAlreadyTaken.includes(location)) {
          target = location;
          break;
        }
      }

      break;

    // of opts.nearest is true will just find the nearest source
    // otherwise will evenly distribute creeps across sources in the room
    case 'source':
        let sources = Game.rooms[creep.memory.homeRoom].find(FIND_SOURCES, {
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
        target = Game.spawns[config.masterSpawn].id;
      }

      break;

    // special flag indicating a place for staticHarvesters to stand
    case 'staticHarvestLocation':
      let staticHarvestLocations = Game.rooms[creep.memory.homeRoom].find(FIND_FLAGS, {
        filter: (location) => {
          return /^StaticHarvest/.test(location.name);
        }
      });

      let staticHarvesters = Game.rooms[creep.memory.homeRoom].find(FIND_MY_CREEPS, {
        filter: (found) => {
          return found.memory.role === 'staticHarvester';
        }
      });

      let staticAlreadyTaken = _.map(staticHarvesters, (harvester) => {
        return harvester.memory.staticTarget;
      });

      for (let location of staticHarvestLocations) {
        if (!staticAlreadyTaken.includes(location.name)) {
          target = location.name;
          break;
        }
      }

      break;

    case 'storage':
      let storage;
      if (opts.filter) {
        let storages = Game.rooms[creep.memory.homeRoom].find(
          FIND_STRUCTURES,
          {
            filter: opts.filter
          }
        );
        if (storages.length) {
          storage = storages[0];
        }
      } else {
        // TODO: check if is full (unlikely anytime soon with 1M capacity)
        storage = Game.rooms[creep.memory.homeRoom].storage;
      }

      if (storage) {
        target = storage.id;
      }

      break;

    default:
  }

  if (target) {
    log.info(`setting target to '${target}'`);
  }
  return target;
}

function moveTowardsParking(creep) {
  let parking =  creep.pos.findClosestByRange(FIND_FLAGS, {
    filter: (flag) => {
      return (
        flag.room.name === creep.memory.homeRoom &&
        /^ParkingArea/.test(flag.name)
      );
    }
  });

  if (parking) {
    creep.moveTo(parking);
  }

  log.info(`moving away from source`);
}

function romanize(num) {
    if (!+num) {
      return false;
    }

    let digits = String(+num).split("");
    let key = ["","C","CC","CCC","CD","D","DC","DCC","DCCC","CM",
               "","X","XX","XXX","XL","L","LX","LXX","LXXX","XC",
               "","I","II","III","IV","V","VI","VII","VIII","IX"];
    let roman = "";
    let i = 3;

    while (i--) {
      roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    }

    return Array(+digits.join("") + 1).join("M") + roman;
}

module.exports = {
  calculateCreepCost: calculateCreepCost,
  calculateTowerEffectiveness: calculateTowerEffectiveness,
  generateName: generateName,
  getRandomInt: getRandomInt,
  getTarget: getTarget,
  moveTowardsParking: moveTowardsParking
};
