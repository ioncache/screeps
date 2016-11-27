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
  longHauler: require('class.creep.longHauler'),
  pioneer: require('class.creep.pioneer'),
  supplier: require('class.creep.supplier'),
  staticHarvester: require('class.creep.staticHarvester'),
  upgrader: require('class.creep.upgrader')
};

class RoomManager {
  constructor(roomName) {
    this.active = false;
    this.creepList = {};
    this.roomName = roomName;
    this.room = Game.rooms[this.roomName];

    if (
      this.room.memory &&
      this.room.memory.roomType &&
      config.creepConfigMaster[this.room.memory.roomType]
    ) {
      this.creepConfig = _.cloneDeep(config.creepConfigMaster[this.room.memory.roomType]);
      this.active = true;
    }
  }

  manage() {
    this.room = Game.rooms[this.roomName];

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
          let creepClass = classes[
            this.creepConfig[creep.memory.role].class ||
            creep.memory.role
          ];
          let newCreep = new creepClass(creep.memory.role);
          newCreep.name = creep.name;
          this.creepList[creep.name] = newCreep;
        }
      }

      // determine current energy
      this.currentEnergy();

      // determine current population
      this.findCurrentPopulation();

      // manage current desired population
      // - number of guards
      // - number of static harvesters
      //   number of couriers
      //   number of bankers/suppliers
      // - types of builders
      // - number of fixers based on towers
      this.managePopulation();

      // spawn new creeps
      this.spawnCreeps();

      // activate towers
      this.activateTowers();

      // activate links
      this.activateLinks();

      // be nice and print out the current population after all spawning
      // and management has occurred
      this.displayPopulation();

      // recycle creeps who are superfluous to the population
      this.recycleCreeps();

      // activate creeps
      this.activateCreeps();

      log.log('\n\n');
    }
  }

  activateCreeps() {
    log.info('\n***** Creep Actions *****\n\n');

    for (let creepName in this.creepList) {
      if (this.creepList[creepName]) {
        let creepObject = this.creepList[creepName];
        if (!Game.creeps[creepName].spawning) {
          // try {
            creepObject.activate();
          // }
          // catch (err) {
          //   console.log(err);
          //   log.error(creepName, err);
          // }
        }
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
          link.cooldown === 0
        ) {
          let amount = _.min([
            link.energy,
            Math.floor((controllerLink.energyCapacity - controllerLink.energy) / 100) * 100
          ]);
          link.transferEnergy(controllerLink, amount);
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

  displayPopulation() {
    let roles = Object.keys(this.creepConfig).sort((a, b) => {
      return a.localeCompare(b);
    });

    for (let role of roles) {
      let creeps = _.filter(Game.creeps, (creep) => {
        return creep.memory.homeRoom === this.room.name && creep.memory.role === role;
      });
      log.log(`Current '${role}' count: ${creeps.length} / ${this.creepConfig[role].min}`);
    }

    let totalCreeps = _.sum(Object.keys(this.creepConfig), (i) => {
      return this.creepConfig[i].currentCount;
    });

    log.log(`Total creeps: ${totalCreeps}`);
  }

  findCurrentPopulation() {
    let roles = Object.keys(this.creepConfig).sort((a, b) => {
      return a.localeCompare(b);
    });

    for (let role of roles) {
      let creeps = _.filter(Game.creeps, (creep) => {
        return creep.memory.homeRoom === this.room.name && creep.memory.role === role;
      });
      this.creepConfig[role].currentCount = creeps.length;
    }
  }

  managePopulation() {
    // manage # of fixers based on towers
    if (this.creepConfig.fixer) {
      let towers = this.room.find(FIND_MY_STRUCTURES, {
        filter: (structure) => {
          return (
            structure.room.name === this.room.name &&
            structure.structureType === STRUCTURE_TOWER
          );
        }
      });

      if (towers.length > 0)  {
        this.creepConfig.fixer.min = 0;
        let fixers = _.filter(Game.creeps, (creep) => {
          return (
            this.room.name === creep.memory.homeRoom &&
            creep.memory.role === 'fixer'
          );
        });
        for (let fixer of fixers) {
          fixer.memory.task = 'recycle';
        }
      }
    }

    if (this.creepConfig.guard) {
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
          this.creepConfig.staticHarvester &&
          (this.creepConfig.harvester.currentCount >= Math.ceil(this.creepConfig.harvester.min / 2) ||
          this.creepConfig.staticHarvester.currentCount > 0)
        ) &&
        this.creepConfig.upgrader.currentCount >= Math.ceil(this.creepConfig.upgrader.min / 2)
      ) {
        log.log('resetting guard count for some reason', this.creepConfig.staticHarvester.currentCount);
        this.creepConfig.guard.min = guardPosts.length;
      } else {
        this.creepConfig.guard.min = 0;
      }
    }

    // manage static harvester populaation based on StaticHarvestFlags present
    let staticHarvestLocations = this.room.find(FIND_FLAGS, {
      filter: (flag) => {
        return /^StaticHarvest/.test(flag.name);
      }
    });

    if (this.creepConfig.staticHarvester) {
      // manage regular harvester population based on # of static harvesters
      this.creepConfig.staticHarvester.min = staticHarvestLocations.length;
      if (this.creepConfig.harvester) {
        this.creepConfig.harvester.min =
          _.max([this.creepConfig.harvester.defaultMin - (3 * staticHarvestLocations.length), 0]);

        // usually keep 1 harvester around
        if (this.creepConfig.harvester.defaultMin !== 0) {
          this.creepConfig.harvester.min = this.creepConfig.harvester.min || 1;
        }
      }

      // recycle old harvesters once staic harvesters come online
      if (
        this.creepConfig.harvester &&
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
          if (notRecycling[i]) {
            log.log('recycling harvester', notRecycling[i].name);
            notRecycling[i].memory.task = 'recycle';
          }
        }
      }

      // manager courier and banker/supplier population based on current static harvesters
      if (
        this.creepConfig.courier &&
        this.creepConfig.staticHarvester.currentCount > 0
      ) {
        let bankerOrSupplier = false;

        if (
          this.creepConfig.banker &&
          this.room.storage
        ) {
          this.creepConfig.banker.min = this.creepConfig.staticHarvester.currentCount;
          bankerOrSupplier = true;
        } else if (
          this.creepConfig.supplier
        ) {
          this.creepConfig.supplier.min = this.creepConfig.staticHarvester.currentCount;
          bankerOrSupplier = true;
        }

        if (this.creepConfig.courier.min === 0) {
          if (bankerOrSupplier) {
            this.creepConfig.courier.min = this.creepConfig.staticHarvester.currentCount * 2;
          } else {
            this.creepConfig.courier.min = this.creepConfig.staticHarvester.currentCount * 3;
          }
        }
      }
    }
  }

  recycleCreeps() {
    // TODO
  }

  // TODO: don't request new creeps from master spawn if this room is under attack
  //       and this room isn't the master spawn room
  //       also, possibly auto-spawn defenders when under attack
  spawnCreeps() {
    // sort the rols by priority so we only attempt to spawn higher priorty ones
    let roles = Object.keys(this.creepConfig).sort((a, b) => {
      return this.creepConfig[a].priority - this.creepConfig[b].priority;
    });

    for (let role of roles) {
      let creeps = _.filter(Game.creeps, (creep) => {
        return creep.memory.homeRoom === this.room.name && creep.memory.role === role;
      });

      if (creeps.length < this.creepConfig[role].min) {
        let skipSpawn = false;  // flag to break out of spawn loop
        let creepClass = classes[this.creepConfig[role].class];
        let newCreep = new creepClass(role);
        let parts = this.creepConfig[role].parts || newCreep.parts;
        let cost = helpers.calculateCreepCost(parts);
        let desiredEnergy = Math.ceil(cost * 1.25);

        let spawn;
        let spawns = this.room.find(FIND_MY_SPAWNS);
        if (
          spawns.length > 0 &&
          spawns[0].energyCapacityAvailable >= cost * 1.25
        ) {
          spawn = spawns[0]; // TODO: handle multiple spawns in same room
        } else {
          log.log('spawn: no room spawns or room does not have enough energy capacity, using master spawm');
          spawn = Game.spawns[config.masterSpawn];
        }

        if (spawn) {
          if (spawn.spawning) {
            log.log(`spawn: spawn is busy, please try again`);
            skipSpawn = true;
          } else if (desiredEnergy <= spawn.room.energyAvailable) {
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
        } else {
          skipSpawn = true;
        }

        if (skipSpawn) {
          break;
        }
      }
    }
  }
}

module.exports = RoomManager;
