'use strict';

module.exports = {
  creepConfigMaster: {
    advanced: {
      banker: {
        class: 'banker',
        min: 0,
        priority: 1.875
      },
      builder: {
        class: 'builder',
        min: 2,
        priority: 3
      },
      carter: {
        class: 'carter',
        min: 0,
        priority: 11
      },
      courier: {
        class: 'courier',
        min: 0,
        priority: 1.75
      },
      decoy: {
        class: 'decoy',
        min: 0,
        priority: 33
      },
      energizer: {
        class: 'energizer',
        min: 0,
        priority: 4
      },
      fixer: {
        class: 'fixer',
        min: 2,
        priority: 4
      },
      guard: {
        class: 'guard',
        min: 0,
        priority: 6
      },
      harvester: {
        class: 'harvester',
        defaultMin: 8,
        min: 8,
        priority: 1
      },
      keeperHunter: {
        class: 'keeperHunter',
        min: 0,
        priority: 30
      },
      miner: {
        class: 'miner',
        min: 0,
        priority: 10
      },
      pioneer: {
        class: 'pioneer',
        min: 0,
        priority: 50
      },
      raider: {
        class: 'raider',
        min: 0,
        priority: 30
      },
      remoteHarvester: {
        class: 'remoteHarvester',
        min: 0,
        priority: 15
      },
      staticHarvester: {
        class: 'staticHarvester',
        min: 0,
        priority: 1.5
      },
      supplier: {
        class: 'supplier',
        min: 0,
        priority: 1.875
      },
      thief: {
        class: 'thief',
        min: 0,
        priority: 30
      },
      trader: {
        class: 'trader',
        min: 0,
        priority: 50
      },
      upgrader: {
        class: 'upgrader',
        min: 3,
        priority: 2
      }
    },
    hydroRoom: {
      builder: {
        class: 'builder',
        min: 1,
        parts: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],
        priority: 5
      },
      courier: {
        class: 'courier',
        min: 1,
        parts: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE],
        priority: 2
      },
      energizer: {
        class: 'energizer',
        min: 0,
        priority: 4
      },
      harvester: {
        class: 'harvester',
        defaultMin: 0,
        min: 0,
        parts: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],
        priority: 3
      },
      keeperHunter: {
        class: 'keeperHunter',
        min: 0,
        priority: 30
      },
      longHauler: {
        class: 'longHauler',
        min: 2,
        priority: 4
      },
      staticHarvester: {
        class: 'staticHarvester',
        min: 0,
        priority: 1
      },
      upgrader: {
        class: 'upgrader',
        min: 1,
        parts: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],
        priority: 3
      }
    },
    basic: {
      builder: {
        class: 'builder',
        min: 1,
        parts: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],
        priority: 2
      },
      fixer: {
        class: 'fixer',
        min: 1,
        parts: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],
        priority: 4
      },
      harvester: {
        class: 'harvester',
        min: 1,
        parts: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],
        priority: 3
      },
      upgrader: {
        class: 'upgrader',
        min: 1,
        parts: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],
        priority: 1
      }
    }
  },
  roomHostileNotifyTimeout: 300000,
  roomLastRepairTimeout: 120000,
  masterSpawn: 'Spawn1',
  masterOwner: 'ioncache',
  // maxHits: {
  //   constructedWall: function(room) {
  //     return Math.pow(1000, 1 + room.controller.level / 15);
  //   },
  //   rampart: function(room) {
  //     return Math.pow(1000, 1 + room.controller.level / 10);
  //   }
  // },
  minHits: {
    constructedWall: function(room) {
      return room.controller.level * 2500;
    },
    rampart: function(room) {
      return room.controller.level * 2500;
    }
  },
  rampartToWallHitScale: {
    2: 1000,
    3: 300,
    4: 100,
    5: 30,
    6: 10,
    7: 3,
    8: 1
  }
};
