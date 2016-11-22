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
let staticHarvester = require('class.creep.staticHarvester');
let upgrader = require('class.creep.upgrader');

let creepConfig = {
  banker: {
    class: banker,
    min: 0,
    priority: 7
  },
  builder: {
    class: builder,
    min: 4,
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
    priority: 16
  },
  fixer: {
    class: fixer,
    min: 4,
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
    min: 6,
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
  scout: {
    class:  function() {},
    min: 0,
    priority: 50
  },
  staticHarvester: {
    class: staticHarvester,
    min: 0,
    priority: 15
  },
  upgrader: {
    class: upgrader,
    min: 5,
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
        let closestDamagedStructure = tower.pos.findClosestByRange(
          FIND_STRUCTURES,
          {
            filter: (structure) => structure.hits < structure.hitsMax
          }
        );

        if (closestDamagedStructure) {
          tower.repair(closestDamagedStructure);
        }
      }
    }
  }

  creepConfig.staticHarvester.min = staticHarvesterCount;

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

  let roles = Object.keys(creepConfig).sort((a, b) => {
    return creepConfig[a].priority - creepConfig[b].priority
  });

  for (let role of roles) {
    let creeps = _.filter(Game.creeps, (creep) => { return creep.memory.role == role; });
    log.log(`Current '${role}' count: ${creeps.length} / ${creepConfig[role].min}`);
    creepConfig[role].currentCount = creeps.length;

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

      let creepClass = creepConfig[role].class;
      let newCreep = new creepClass(role);
      let parts = creepConfig[role].parts || newCreep.parts;
      let newName = Game.spawns['Spawn1'].createCreep(parts, helpers.generateName(role), { role: role });

      switch (newName) {
        case ERR_NOT_ENOUGH_ENERGY:
          log.log(`Not enough energy to spawn '${role}'`);
          break;
        case ERR_BUSY:
          break;
        case ERR_INVALID_ARGS:
          log.log(`Invalid args creating creep of role ${role}`);
          break;
        default:
          newCreep.name = newName;
          creepList[newName] = newCreep;
          log.log(`Spawning new '${role}': ${newName}`);
      }
    }
  }

  // up courier count if staticHarvesters exist
  if (creepConfig.staticHarvester.currentCount > 0) {
    creepConfig.courier.min = creepConfig.staticHarvester.currentCount * 3;
  }

  log.log(`Total creeps: ${Object.keys(Game.creeps).length}`);

  log.log('\n***** Creep Actions *****\n\n');

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
