'use strict';

let helpers = require('helpers');
let log = require('logger');

let banker = require('class.creep.banker');
let builder = require('class.creep.builder');
let courier = require('class.creep.courier');
let fixer = require('class.creep.fixer');
let guard = require('class.creep.guard');
let harvester = require('class.creep.harvester');
let pioneer = require('class.creep.pioneer');
let seriousBuilder = require('class.creep.seriousBuilder');
let staticHarvester = require('class.creep.staticHarvester');
let upgrader = require('class.creep.upgrader');

let creepConfig = {
  banker: {
    class: banker,
    min: 0,
    priority: 1.875
  },
  builder: {
    class: builder,
    min: 3,
    priority: 3
  },
  builderBasic: {
    class: builder,
    min: 0,
    parts: [WORK, CARRY, MOVE],
    priority: 3
  },
  courier: {
    class: courier,
    min: 0,
    priority: 1.75
  },
  fixer: {
    class: fixer,
    min: 2,
    priority: 4
  },
  fixerBasic: {
    class: fixer,
    min: 0,
    parts: [WORK, CARRY, MOVE],
    priority: 4
  },
  guard: {
    class: guard,
    min: 0,
    priority: 6
  },
  harvester: {
    class: harvester,
    defaultMin: 8,
    min: 8,
    priority: 1
  },
  harvesterBasic: {
    class: harvester,
    min: 0,
    parts: [WORK, CARRY, MOVE],
    priority: 1
  },
  pioneer: {
    class: pioneer,
    min: 0,
    priority: 50
  },
  staticHarvester: {
    class: staticHarvester,
    min: 0,
    priority: 1.5
  },
  upgrader: {
    class: upgrader,
    min: 4,
    priority: 2
  },
  upgraderBasic: {
    class: upgrader,
    min: 0,
    parts: [WORK, CARRY, MOVE],
    priority: 2
  }
}

let creepList = {};

module.exports.loop = function () {

  log.log('********************');
  log.log('***** NEW TICK *****');
  log.log('********************\n\n');

  for (let name in Memory.creeps) {
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      delete creepList[name];
      log.log('Clearing non-existing creep memory:', name);
    }
  }

  // keep local creep list in sync
  for (let creepName in Game.creeps) {
    let creep = Game.creeps[creepName];
    if (!creepList[creep.name]) {
      let creepClass = creepConfig[creep.memory.role].class;
      let newCreep = new creepClass(creep.memory.role);
      newCreep.name = creepName;
      creepList[creep.name] = newCreep;
    }
  }

  let guardCount = 0;
  let staticHarvesterCount = 0;
  // TODO: fix up logic to properly support multiple rooms
  for (let name in Game.rooms) {
    log.log(`Room "${name}" has ${Game.rooms[name].energyAvailable} energy`);

    let containers = Game.rooms[name].find(FIND_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType == STRUCTURE_CONTAINER;
      }
    });

    // determine how many static harvesters there should be
    let staticHarvestLocations = Game.rooms[name].find(FIND_FLAGS, {
      filter: (flag) => {
        return /^StaticHarvest/.test(flag.name);
      }
    });

    staticHarvesterCount += _.min([staticHarvestLocations.length, containers.length]);
    creepConfig.staticHarvester.min = staticHarvesterCount;
    creepConfig.harvester.min = creepConfig.harvester.defaultMin - (3 * staticHarvesterCount);
    // always keep 1 around
    creepConfig.harvester.min = creepConfig.harvester.min || 1;

    // determine the correct number of guards to spawn based on guard posts
    let guardPosts = Game.rooms[name].find(FIND_FLAGS, {
      filter: (post) => {
        return /^GuardPost/.test(post.name);
      }
    });
    guardCount += guardPosts.length;

    // TODO: move out tower logic elsewhere probably
    let towers = Game.rooms[name].find(FIND_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType == STRUCTURE_TOWER;
      }
    });

    for (let tower of towers) {
      let closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if (closestHostile) {
        tower.attack(closestHostile);
      } else {
        let woundedCreep =  tower.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (creep) => {
                return creep.hits < creep.hitsMax;
            }
        });

        if (woundedCreep) {
          tower.heal(woundedCreep);
        } else {
          let maxHits = {
            constructedWall: 5000,
            rampart: 10000
          };
          let closestDamagedStructure = tower.pos.findClosestByRange(
            FIND_STRUCTURES,
            {
              filter: (structure) => {
                if (maxHits[structure.structureType]) {
                  return structure.hits < maxHits[structure.structureType];
                } else {
                  return structure.hits < structure.hitsMax;
                }
              }
            }
          );

          if (closestDamagedStructure) {
            tower.repair(closestDamagedStructure);
          }
        }
      }
    }

    let controllerLink = Game.rooms[name].controller.pos.findClosestByRange(
      FIND_STRUCTURES, {
        filter: (s) => {
          return (
            s.structureType == STRUCTURE_LINK &&
            Game.rooms[name].controller.pos.getRangeTo(s) <= 3
          );
        }
      }
    );

    if (
      controllerLink &&
      controllerLink.energy < controllerLink.energyCapacity
    ) {
      let links = Game.rooms[name].find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.id != controllerLink.id &&
            structure.structureType == STRUCTURE_LINK
          );
        }
      });

      for (let link of links) {
        if (
          // use 100 as there is a 3% energy loss per transfer
          // and 3% of 100 is a whole number
          link.energy >= 100 &&
          link.cooldown == 0 &&
          link.energy <= controllerLink.energyCapacity - controllerLink.energy
        ) {
          link.transferEnergy(controllerLink);
        }
      }
    }
  }
  // // only begin spawning guards if current population is high enough
  // if (
  //   creepConfig.fixer.currentCount >= Math.ceil(creepConfig.fixer.min / 2) &&
  //   creepConfig.builder.currentCount >= Math.ceil(creepConfig.builder.min / 2) &&
  //   (
  //     creepConfig.harvester.currentCount >= Math.ceil(creepConfig.harvester.min / 2) ||
  //     creepConfig.staticHarvester.currentCount > 0
  //   ) &&
  //   creepConfig.upgrader.currentCount >= Math.ceil(creepConfig.upgrader.min / 2)
  // ) {
  //   console.log('resetting guard count for some reason', creepConfig.staticHarvester.currentCount)
  //   creepConfig.guard.min = guardCount;
  // } else {
  //   creepConfig.guard.min = 0;
  // }

  let towerCount = 0;

  for (let name in Game.rooms) {
    let towers = Game.rooms[name].find(FIND_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType == STRUCTURE_TOWER;
      }
    });

    towerCount += towers.length;
  }

  if (towerCount > 0)  {
    creepConfig.fixer.min = 0;
    creepConfig.builder.class = seriousBuilder;

    let fixers = _.filter(Game.creeps, (creep) => { return creep.memory.role == 'fixer'; });
    for (let fixer of fixers) {
      fixer.memory.task = 'recycle';
    }
  }

  let roles = Object.keys(creepConfig).sort((a, b) => {
    return creepConfig[a].priority - creepConfig[b].priority
  });

  for (let role of roles) {
    let creeps = _.filter(Game.creeps, (creep) => { return creep.memory.role == role; });
    log.log(`Current '${role}' count: ${creeps.length} / ${creepConfig[role].min}`);
    creepConfig[role].currentCount = creeps.length;
  }

  // recycle old harvesters once staic harvesters come online
  if (
    creepConfig.harvester.currentCount > creepConfig.harvester.min &&
    creepConfig.staticHarvester.currentCount > 0
  ) {
    let recycleAmount = creepConfig.harvester.currentCount - creepConfig.harvester.min;
    let currentlyRecycling = Object.keys(Game.creeps).filter((creepName) => {
      let creep = Game.creeps[creepName];
      return creep.memory.role == 'harvester' && creep.memory.task == 'recycle';
    });

    let notRecycling = Object.keys(Game.creeps).filter((creepName) => {
      let creep = Game.creeps[creepName];
      return creep.memory.role == 'harvester' &&  creep.memory.task != 'recycle';
    });

    recycleAmount -= currentlyRecycling.length;

    for (let i = 0; i < recycleAmount; i++) {
      console.log('will recycle', notRecycling[i]);
      let creep = Game.creeps[notRecycling[i]];
      creep.memory.task = 'recycle';
    }
  }

  for (let role of roles) {
    let creeps = _.filter(Game.creeps, (creep) => { return creep.memory.role == role; });

    if (creeps.length < creepConfig[role].min) {
      // if all creeps of a type are dead, make some simple
      // ones to get things moving again
      let basicCreeps = _.filter(Game.creeps, (creep) => { return creep.memory.role == `${role}Basic`; });
      if (
        ['builder', 'fixer', 'harvester', 'upgrader'].includes(role) &&
        creeps.length == 0 &&
        basicCreeps.length == 0
      )  {
        role = `${role}Basic`;
      }

      let spawn = Game.spawns['Spawn1'];
      let creepClass = creepConfig[role].class;
      let newCreep = new creepClass(role);
      let parts = creepConfig[role].parts || newCreep.parts;
      let cost = helpers.calculateCreepCost(parts);
      let roomEnergy = spawn.room.energyAvailable;
      let desiredEnergy = Math.ceil(cost * 1.25);

      let skipSpawn = false;
      if (spawn.spawning) {
        log.log(`spawn: spawn is busy, please try again`);
        skipSpawn = true;
      } else if (desiredEnergy <= roomEnergy) {
        let newName = spawn.createCreep(parts, helpers.generateName(role), { role: role });

        switch (newName) {
          case ERR_NOT_ENOUGH_ENERGY:
            log.log(`spawn: not enough energy to spawn '${role}'`);
            skipSpawn = true;
            break;
          case ERR_BUSY:
            skipSpawn = true;
            break;
          case ERR_INVALID_ARGS:
            log.log(`spawn: invalid args creating creep of role ${role}`);
            skipSpawn = true;
            break;
          case OK:
            newCreep.name = newName;
            creepList[newName] = newCreep;
            skipSpawn = true;
            log.log(`spwn: a new '${role}' is born: ${newName}`);
          default:
            log.log(`spawn: unknown response from spawn: ${newName}`);
        }
      } else {
        log.log(`spawn: not enough energy for '${role}': current: ${spawn.room.energyAvailable} -- cost: ${cost} -- desired: ${desiredEnergy}`);
        skipSpawn = true;
      }

      if (skipSpawn) {
        break;
      }
    }
  }

  // up courier and banker count if staticHarvesters exist
  // TODO fix up per room logic
  if (creepConfig.staticHarvester.currentCount > 0) {
    let storages = Object.keys(Game.structures).filter((structureName) => {
      return Game.structures[structureName].structureType == STRUCTURE_STORAGE;
    });
    if (storages.length) {
      creepConfig.banker.min = creepConfig.staticHarvester.currentCount;
      creepConfig.courier.min = creepConfig.staticHarvester.currentCount * 2;
    } else {
      creepConfig.courier.min = creepConfig.staticHarvester.currentCount * 3;
    }
  }

  log.log(`Total creeps: ${Object.keys(Game.creeps).length}`);

  log.info('\n***** Creep Actions *****\n\n');

  for (let name in Game.creeps) {
    let creep = Game.creeps[name];

    if (!creep.spawning && creepList[name]) {
      // try {
        creepList[name].activate();
      // }
      // catch (err) {
      //   console.log(err);
      //   log.error(name, err);
      // }
    }
  }

  log.log('\n\n');
}
