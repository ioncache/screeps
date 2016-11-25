'use strict';

let config = require('config');
let helpers = require('helpers');
let log = require('logger');

let classes = {
  banker: require('class.creep.banker'),
  builder: require('class.creep.builder'),
  courier: require('class.creep.courier'),
  fixer: require('class.creep.fixer'),
  guard: require('class.creep.guard'),
  harvester: require('class.creep.harvester'),
  pioneer: require('class.creep.pioneer'),
  seriousBuilder: require('class.creep.seriousBuilder'),
  staticHarvester: require('class.creep.staticHarvester'),
  upgrader: require('class.creep.upgrader')
};

class RoomManager {
  constructor(room = {}) {
    this.active = false;
    this.creepList = {};
    this.room = room;

    if (
      this.room.memory &&
      this.room.memory.level &&
      config.creepConfigMaster[this.room.memory.level]
    ) {
      this.creepConfig = _.cloneDeep(config.creepConfigMaster[this.room.memory.level]);
      this.active = true;
    }
  }

  manage() {
    if (this.active) {
      // keep local creep list in sync

      for (let name in this.creepList) {
        if (!Game.creeps[name]) {
          delete this.creepList[name];
          log.log('Clearing non-existing creep from room creep list:', name);
        }
      }

      let creeps = _.filter(Game.creeps, (creep) => {
        return creep.memory.homeRoom === this.room.name;
      });
      for (let creep of creeps) {
        if (!this.creepList[creep.name]) {
          let creepClass = classes[this.creepConfig[creep.memory.role].class];
          let newCreep = new creepClass(creep.memory.role);
          newCreep.name = creep.name;
          this.creepList[creep.name] = newCreep;
        }
      }

      // determine current energy
      this.currentEnergy();

      // determine current population
      this.currentPopulation();

      // manage current desired population
      // - number of guards
      // - number of static harvesters
      //   number of couriers
      //   number of bankers
      // - types of builders
      // - number of fixers based on towers
      this.managePopulation();

      // spawn new creeps
      this.spawnCreeps();

      // activate towers
      this.activateTowers();

      // activate links
      this.activateLinks();

      // activate creeps
      this.activateCreeps();
    }
  }

  activateCreeps() {
    log.info('\n***** Creep Actions *****\n\n');

    for (let creepName in this.creepList) {
      if (this.creepList[creepName]) {
        let creepObject = this.creepList[creepName];
        // if (!creepObject.creep.spawning) {
          // try {
            creepObject.activate();
          // }
          // catch (err) {
          //   console.log(err);
          //   log.error(name, err);
          // }
        // }
      }
    }
  }

  activateLinks() {
    let controllerLink = this.room.controller.pos.findClosestByRange(
      FIND_STRUCTURES, {
        filter: (s) => {
          return (
            s.structureType === STRUCTURE_LINK &&
            this.room.controller.pos.getRangeTo(s) <= 3
          );
        }
      }
    );

    if (
      controllerLink &&
      controllerLink.energy < controllerLink.energyCapacity
    ) {
      let links = this.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.id !== controllerLink.id &&
            structure.structureType === STRUCTURE_LINK
          );
        }
      });

      for (let link of links) {
        if (
          // use 100 as there is a 3% energy loss per transfer
          // and 3% of 100 is a whole number
          link.energy >= 100 &&
          link.cooldown === 0 &&
          link.energy <= controllerLink.energyCapacity - controllerLink.energy
        ) {
          link.transferEnergy(controllerLink);
        }
      }
    }
  }

  activateTowers() {
    let towers = this.room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return structure.structureType === STRUCTURE_TOWER;
      }
    });

    towers.sort((a, b) => {
      b.energy - a.energy;
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
        } else if (tower.energy > tower.energyCapacity * 0.75) { // always keep energy for shooting
          let furthestDamagedStructures = tower.room.find(
            FIND_STRUCTURES,
            {
              filter: (structure) => {
                if (config.maxHits[structure.structureType]) {
                  return structure.hits < config.maxHits[structure.structureType];
                } else {
                  return structure.hits < structure.hitsMax;
                }
              }
            }
          );

          furthestDamagedStructures.sort((a, b) =>{
            tower.pos.getRangeTo(b) - tower.pos.getRangeTo(a);
          });

          if (furthestDamagedStructures) {
            tower.repair(furthestDamagedStructures[0]);
          }
        }
      }
    }
  }

  currentEnergy() {
    // determine current energy
    log.log(`Room "${this.room.name}": energy ${this.room.energyAvailable} / ${this.room.energyCapacityAvailable}`);

    return this.room.energyAvailable;
  }

  currentPopulation() {
    let roles = Object.keys(this.creepConfig).sort((a, b) => {
      return a.localeCompare(b);
    });

    for (let role of roles) {
      let creeps = _.filter(Game.creeps, (creep) => {
        return creep.memory.homeRoom === this.room.name && creep.memory.role === role;
      });
      log.log(`Current '${role}' count: ${creeps.length} / ${this.creepConfig[role].min}`);
      this.creepConfig[role].currentCount = creeps.length;
    }

    let totalCreeps = _.sum(Object.keys(this.creepConfig), (i) => {
      return this.creepConfig[i].currentCount;
    });

    log.log(`Total creeps: ${totalCreeps}`);

    return totalCreeps;
  }

  managePopulation() {
    // manage # of fixers based on towers
    if (this.creepConfig.fixer) {
      let towers = this.room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => {
          return structure.structureType === STRUCTURE_TOWER;
        }
      });

      if (towers.length > 0)  {
        this.creepConfig.fixer.min = 0;
        let fixers = _.filter(Game.creeps, (creep) => {
          return creep.room.name === this.room.name && creep.memory.role === 'fixer';
        });
        for (let fixer of fixers) {
          fixer.memory.task = 'recycle';
        }
      }
    }

    // manage number of guards based on population levels
    let guardPosts = this.room.find(FIND_FLAGS, {
      filter: (post) => {
        return /^GuardPost/.test(post.name);
      }
    });
    if (
      guardPosts.length > 0 &&
      this.creepConfig.fixer.currentCount >= Math.ceil(this.creepConfig.fixer.min / 2) &&
      this.creepConfig.builder.currentCount >= Math.ceil(this.creepConfig.builder.min / 2) &&
      (
        this.creepConfig.harvester.currentCount >= Math.ceil(this.creepConfig.harvester.min / 2) ||
        this.creepConfig.staticHarvester.currentCount > 0
      ) &&
      this.creepConfig.upgrader.currentCount >= Math.ceil(this.creepConfig.upgrader.min / 2)
    ) {
      log.log('resetting guard count for some reason', this.creepConfig.staticHarvester.currentCount);
      this.creepConfig.guard.min = guardPosts.length;
    } else {
      this.creepConfig.guard.min = 0;
    }

    // manage static harvester populaation based on StaticHarvestFlags present
    let staticHarvestLocations = this.room.find(FIND_FLAGS, {
      filter: (flag) => {
        return /^StaticHarvest/.test(flag.name);
      }
    });

    // manage regular harvester population based on # of static harvesters
    this.creepConfig.staticHarvester.min = staticHarvestLocations.length;
    this.creepConfig.harvester.min = this.creepConfig.harvester.defaultMin - (3 * staticHarvestLocations.length);
    // always keep 1 harvester around
    this.creepConfig.harvester.min = this.creepConfig.harvester.min || 1;

    // recycle old harvesters once staic harvesters come online
    if (
      this.creepConfig.harvester.currentCount > this.creepConfig.harvester.min &&
      this.creepConfig.staticHarvester.currentCount > 0
    ) {
      let recycleAmount = this.creepConfig.harvester.currentCount - this.creepConfig.harvester.min;
      let currentlyRecycling = this.room.find(FIND_MY_CREEPS, {
        filter: (creep) => {
          return creep.memory.role === 'harvester' && creep.memory.task === 'recycle';
        }
      });

      let notRecycling = this.room.find(FIND_MY_CREEPS, {
        filter: (creep) => {
          return creep.memory.role === 'harvester' &&  creep.memory.task !== 'recycle';
        }
      });

      recycleAmount -= currentlyRecycling.length;

      for (let i = 0; i < recycleAmount; i++) {
        log.log('recycling harvester', notRecycling[i].name);
        notRecycling[i].memory.task = 'recycle';
      }
    }

    // manager courier and banker population based on current static harvesters
    if (this.creepConfig.staticHarvester.currentCount > 0) {
      if (this.room.storage) {
        this.creepConfig.banker.min = this.creepConfig.staticHarvester.currentCount;
        this.creepConfig.courier.min = this.creepConfig.staticHarvester.currentCount * 2;
      } else {
        this.creepConfig.courier.min = this.creepConfig.staticHarvester.currentCount * 3;
      }
    }
  }

  spawnCreeps() {
    let spawn;
    let spawns = this.room.find(FIND_MY_SPAWNS);
    if (spawns) {
      spawn = spawns[0]; // TODO: handle multiple spawns in same room
    } else {
      spawn = Game.spawns[config.masterSpawn];
    }

    if (spawn) {
      let roles = Object.keys(this.creepConfig).sort((a, b) => {
        return this.creepConfig[a].priority - this.creepConfig[b].priority;
      });

      for (let role of roles) {
        let creeps = _.filter(Game.creeps, (creep) => {
          return creep.memory.homeRoom === this.room.name && creep.memory.role === role;
        });

        if (creeps.length < this.creepConfig[role].min) {
          let creepClass = classes[this.creepConfig[role].class];
          let newCreep = new creepClass(role);
          let parts = this.creepConfig[role].parts || newCreep.parts;
          let cost = helpers.calculateCreepCost(parts);
          let roomEnergy = spawn.room.energyAvailable;
          let desiredEnergy = Math.ceil(cost * 1.25);

          let skipSpawn = false;
          if (spawn.spawning) {
            log.log(`spawn: spawn is busy, please try again`);
            skipSpawn = true;
          } else if (desiredEnergy <= roomEnergy) {
            let newName = spawn.createCreep(
              parts,
              helpers.generateName(role),
              {
                homeRoom: this.room.name,
                role: role
              }
            );

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
                this.creepList[newName] = newCreep;
                skipSpawn = true;
                log.log(`spwn: a new '${role}' is born: ${newName}`);
              default:
                log.log(`spawn: unknown response from spawn: ${newName}`);
            }
          } else {
            let message = `spawn: not enough energy for '${role}': current: ${spawn.room.energyAvailable}`;
            message = `${message} -- cost: ${cost} -- desired: ${desiredEnergy}`;
            log.log(message);
            skipSpawn = true;
          }

          if (skipSpawn) {
            break;
          }
        }
      }
    }
  }

}

module.exports = RoomManager;
