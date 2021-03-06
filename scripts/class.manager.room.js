'use strict';

let config = require('config');
let helpers = require('helpers');
let log = require('logger');

let classes = {
  banker: require('class.creep.banker'),
  builder: require('class.creep.builder'),
  carter: require('class.creep.carter'),
  courier: require('class.creep.courier'),
  decoy: require('class.creep.decoy'),
  energizer: require('class.creep.energizer'),
  fixer: require('class.creep.fixer'),
  guard: require('class.creep.guard'),
  harvester: require('class.creep.harvester'),
  keeperHunter: require('class.creep.keeperHunter'),
  longHauler: require('class.creep.longHauler'),
  miner: require('class.creep.miner'),
  pioneer: require('class.creep.pioneer'),
  raider: require('class.creep.raider'),
  remoteHarvester: require('class.creep.remoteHarvester'),
  staticHarvester: require('class.creep.staticHarvester'),
  supplier: require('class.creep.supplier'),
  thief: require('class.creep.thief'),
  trader: require('class.creep.trader'),
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
      !this.room.memory.lastRepairTimestamp
    ) {
      this.room.memory.lastRepairTimestamp = 1;
    }

    if (
      this.room.memory &&
      this.room.memory.roads === undefined
    ) {
      this.room.memory.roads = {};
    }

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
    this.room.memory.currentTimestamp = new Date().getTime();

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
      // - number of energizers
      // - number of builders
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
          // in case there is an error in an individual creep's
          // logic, catch error and move on to next creep
          try {
            creepObject.activate();
          } catch (err) {
            log.log(`##### CATCH ERROR #####`);
            log.log('Creep: ', creepName);
            log.log(err);
          }
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
      filter: (s) => s.structureType === STRUCTURE_TOWER
    });

    towers.sort((a, b) => b.energy - a.energy);

    // TODO: still find all hostile creeps, priortize dangerous ones
    //       pick off others later, or slowly over time, or only if they
    //       block access to spawn, tower, source, etc.

    // only find hostile creeps that have dangerous bits in them
    let dangerousParts = [
      ATTACK,
      //CARRY, // because they can steal from containers and take any dropped resources
      CLAIM,
      // HEAL,
      RANGED_ATTACK,
      WORK
    ];

    let allHostileCreeps = this.room.find(FIND_HOSTILE_CREEPS, {
      filter: (c) => c.body.some((p) => dangerousParts.includes(p.type))
    });

    if (
      allHostileCreeps.length > 0 &&
      (
        !this.room.memory.lastHostileTimestamp ||
        this.room.memory.currentTimestamp - this.room.memory.lastHostileTimestamp > config.roomHostileNotifyTimeout
      )
    ) {
      let message = `Room ${this.room.name} is getting attacked by ${allHostileCreeps.length} `;
      message += `creep${allHostileCreeps.length > 1 ? 's' : ''} at ${new Date(this.room.memory.currentTimestamp)}`;
      Game.notify(message);
      this.room.memory.lastHostileTimestamp = this.room.memory.currentTimestamp;
    }

    let possibleHostileTargets = [];
    let didExtraRepair = false;

    // TODO: determine targets by range, to get more out of tower spend
    //       Attack effectiveness	600 hits at range ≤5 to 150 hits at range ≥20
    //       Heal effectiveness	400 hits at range ≤5 to 100 hits at range ≥20
    //       Repair effectiveness	800 hits at range ≤5 to 200 hits at range ≥20
    for (let tower of towers) {
      // only target hostile creeps within a certain range of a tower
      // to make tower damage more efficient
      let hostileCreeps = allHostileCreeps.filter((c) => {
        return tower.pos.getRangeTo(c) <= 15;
      });

      if (hostileCreeps.length > 0) {
        let hostileTarget = null;

        // let hostileHealers = hostileCreeps.filter((c) => {
        //   return c.body.filter((p) => {
        //     return p.type === HEAL;
        //   }).length > 0;
        // });
        //
        // // prioritize healers as they are a pain in the neck
        // if (hostileHealers.length > 0) {
        //   hostileHealers.sort((a, b) => {
        //     return tower.pos.getRangeTo(a) - tower.pos.getRangeTo(b);
        //   });
        //
        //   hostileTarget = hostileHealers[0];
        // } else {
          hostileCreeps.sort((a, b) => {
            return tower.pos.getRangeTo(a) - tower.pos.getRangeTo(b);
          });

          hostileTarget = hostileCreeps[0];
        // }

        if (hostileTarget) {
          possibleHostileTargets.push(hostileTarget);
        }
      } else if (!allHostileCreeps.length) { // skip this section if there are any hostiles whether in range or not
        let woundedCreep =  tower.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: (creep) => {
                return creep.hits < creep.hitsMax;
            }
        });

        if (woundedCreep) {
          tower.heal(woundedCreep);
        } else if (tower.energy > tower.energyCapacity * 0.75) { // always keep energy for shooting
          let allDamagedStructures = tower.room.find(
            FIND_STRUCTURES,
            {
              filter: (s) => {
                if (config.minHits[s.structureType]) {
                  return s.hits < config.minHits[s.structureType](tower.room);
                } else {
                  // skip repairing roads that haven't been walked on in a long time
                  if (
                    s.structureType === STRUCTURE_ROAD &&
                    (
                      this.room.memory.roads[s.id] === undefined ||
                      this.room.memory.currentTimestamp - this.room.memory.roads[s.id].lastWalkedOn > 86400000
                    )
                  ) {
                    // once a road has not been walked on in a long time, delete it
                    // from the road memory, so that when it decays, there isn't an
                    // oprhan road still in the memory store
                    // if a creep walks on the road before it decays, the road will
                    // get added back into memory with a new lastWalkedOn timestamp
                    if (this.room.memory.roads[s.id] !== undefined) {
                      delete this.room.memory.roads[s.id];
                    }
                    return false;
                  }
                  return (s.hitsMax - s.hits) >= helpers.calculateTowerEffectiveness('repair', tower.pos.getRangeTo(s));
                }
              }
            }
          );

          // repair farthest first as unoccupied builders can fix local things
          // NOTE: builders no longer fix when there are towers, so may want to change this
          allDamagedStructures.sort((a, b) => {
            return tower.pos.getRangeTo(b) - tower.pos.getRangeTo(a);
          });

          if (allDamagedStructures.length > 0) {
            let repairTarget = allDamagedStructures[0];
            tower.repair(repairTarget);
          } else if (
            this.room.memory.currentTimestamp - this.room.memory.lastRepairTimestamp >= config.roomLastRepairTimeout
          ) {
            let belowMaxStructures = tower.room.find(FIND_STRUCTURES,{
              filter: (s) => {
                // only do extra repairs on structures that have a min hit setting
                return (
                  config.minHits[s.structureType] &&
                  s.hits < s.hitsMax
                );
              }
            });

            if (belowMaxStructures.length > 0) {
              let belowMaxStructure = _.min(belowMaxStructures, (s) => s.hits);
              tower.repair(belowMaxStructure);
              didExtraRepair = true;
            }
          }
        }
      }
    }

    // only set lastRepairTimestamp after all towers have been processed
    // that way each can do the more than minHit repair in a turn
    if (didExtraRepair) {
      this.room.memory.lastRepairTimestamp = this.room.memory.currentTimestamp;
    }

    if (possibleHostileTargets.length > 0) {
      let averageRanges = [];

      for (let target of possibleHostileTargets) {
        let averageRange = 0;

        for (let tower of towers) {
          averageRange += tower.pos.getRangeTo(target);
        }

        averageRanges.push(Math.floor(averageRange / towers.length));
      }

      let minRange = _.min(averageRanges);
      let targetIndex = _.findIndex(averageRanges, (r) => r === minRange);

      for (let tower of towers) {
        tower.attack(possibleHostileTargets[targetIndex]);
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

    // make 1 miner per valid extraction site
    if (this.creepConfig.miner) {
      let extractionSites = this.room.find(FIND_STRUCTURES, {
        filter: (s) => {
          return s.structureType === STRUCTURE_EXTRACTOR;
        }
      });

      // filter extract sites by checking the mineral they are on
      // and if there are ticksToRegeneration currently
      extractionSites = extractionSites.filter((s) => {
        let look = this.room.lookAt(s);
        let isRegenerating = false;
        for (let i of look) {
          if (
            i.mineral &&
            i.mineral.ticksToRegeneration > 100
          ) {
            isRegenerating = true;
            break;
          }
        }
        return !isRegenerating;
      });

      this.creepConfig.miner.min = extractionSites.length;

      // make 1 carter for each miner
      if (this.creepConfig.carter) {
        this.creepConfig.carter.min = this.creepConfig.miner.min;
      }

      // cull some current miners/carters if there are too many
      if (this.creepConfig.miner.currentCount > this.creepConfig.miner.min) {
        let miners = this.room.find(FIND_MY_CREEPS, { filter: (c) => c.memory.role === 'miner' });
        miners[0].memory.task = 'recycle';
      }

      if (
        this.creepConfig.carter &&
        this.creepConfig.carter.currentCount > this.creepConfig.carter.min
      ) {
        let carters = this.room.find(FIND_MY_CREEPS, { filter: (c) => c.memory.role === 'carter' });
        carters[0].memory.task = 'recycle';
      }
    }

    if (this.creepConfig.guard) {
      let guardPosts = this.room.find(FIND_FLAGS, {
        filter: (post) => {
          return /^GuardPost/.test(post.name);
        }
      });

      this.creepConfig.guard.min = guardPosts.length;
    }

    if (this.creepConfig.staticHarvester) {
      // manage static harvester populaation based on StaticHarvestFlags present
      let staticHarvestLocations = this.room.find(FIND_FLAGS, {
        filter: (flag) => {
          return /^StaticHarvest/.test(flag.name);
        }
      });

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

      // manage courier and banker/supplier population based on current static harvesters
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

    // 1 energizer per tower, or just 1 for small rooms
    if (this.creepConfig.energizer) {
      let towers = this.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return structure.structureType === STRUCTURE_TOWER;
        }
      });

      let sources = this.room.find(FIND_SOURCES);

      if (sources.length === 1) {
        this.creepConfig.energizer.min = 1;
      } else {
        this.creepConfig.energizer.min = Math.ceil(towers.length / 2);
      }
    }

    if (this.creepConfig.remoteHarvester) {
      let remoteHarvestLocations = Object.keys(Game.flags).filter((flagName) => {
        return /^RemoteHarvest/.test(flagName);
      });
      let removed = [];

      // remove any remote harvest flags if the room they reside in
      // currently owned by anyone other than script owner
      for (let remoteHarvestLocationName of remoteHarvestLocations) {
        let remoteHarvestLocation = Game.flags[remoteHarvestLocationName];

        if (
          remoteHarvestLocation &&
          remoteHarvestLocation.room &&
          remoteHarvestLocation.room.controller.owned &&
          remoteHarvestLocation.room.controller.owned !== config.masterOwner
        ) {
          removed.push(remoteHarvestLocationName);
          remoteHarvestLocation.remove();
        }
      }

      // remove any no longer existing flags from remote location list
      remoteHarvestLocations = remoteHarvestLocations.filter((f) => !removed.includes(f));

      if (remoteHarvestLocations.length > 0) {
        // room.find command more cpu intensive than Object.keys.filter
        // so only check if room is master room when there are actual
        // remote harvest locations
        let roomSpawns = this.room.find(FIND_MY_SPAWNS);
        let roomSpawnNames = _.map(roomSpawns, (s) => s.name);

        // for now only spawn remote harvesters from master spawn
        if (
          roomSpawnNames.includes(config.masterSpawn) &&
          this.creepConfig.remoteHarvester.min !== remoteHarvestLocations.length
        ) {
          // check to see if room can even make a remoteHarvester
          let tempRemoteHarvester = new classes.remoteHarvester();

          if (
            helpers.calculateCreepCost(tempRemoteHarvester.parts) * 1.25 <=
            this.room.energyCapacityAvailable
          ) {
            this.creepConfig.remoteHarvester.min = remoteHarvestLocations.length;
          }
        }
      } else {
        this.creepConfig.remoteHarvester.min = 0;
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
