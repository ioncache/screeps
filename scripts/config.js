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
        min: 3,
        priority: 3
      },
      courier: {
        class: 'courier',
        min: 0,
        priority: 1.75
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
      pioneer: {
        class: 'pioneer',
        min: 0,
        priority: 50
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
      harvester: {
        class: 'harvester',
        defaultMin: 0,
        min: 0,
        parts: [WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE],
        priority: 3
      },
      longHauler: {
        class: 'longHauler',
        min: 1,
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
  masterSpawn: 'Spawn1',
  masterOwner: 'ioncache',
  maxHits: {
    constructedWall: 5000,
    rampart: 10000
  }
};
