'use strict';

let helpers = require('helpers');
let log = require('logger');
let strings = require('strings');

function attack(creep, target, task, attackType = 'attack') {
  let flag;

  let result = creep[attackType](target);

  switch (result) {
    case ERR_INVALID_TARGET:
      // for some reason current target is no longer valid
      // reset target for next tick, but keep task as task should still be valid
      log.info(`${task}: attack target no longer valid`);
      flag = false;
      break;

    case ERR_NO_BODYPART:
      log.info(`${task}: don't be silly, this creep has no body parts for '${attackType}'`);
      flag = false;
      break;

    case ERR_NOT_IN_RANGE:
      log.info(`${task}: target not in range`);
      flag = moveTo(creep, target, task);
      break;

    case OK:
      log.info(`${task}: attacking`);
      flag = true;
      break;

    default:
      log.info(`${task}: unknown response during attack'${result}'`);
      flag = true;
  }

  return flag;
}

function rangedAttack(creep, target, task) {
  return attack(creep, target, task, 'rangedAttack');
}

function harvest(creep, target, task) {
  let flag;

  let result = creep.harvest(target);

  switch (result) {
    case ERR_INVALID_TARGET:
      // for some reason current target is no longer valid
      // reset target for next tick, but keep task as task should still be valid
      log.info(`${task}: harvest target no longer valid`);
      creep.memory.target = null;
      flag = false;
      break;

    case ERR_NO_BODYPART:
      log.info(`${task}: don't be silly, this creep has no WORK body parts for harvesting`);
      creep.memory.target = null;
      creep.memory.task = null;
      flag = false;
      break;

    case ERR_NOT_ENOUGH_RESOURCES:
      log.info(`${task}: harvest source out of resources`);
      flag = false;
      break;

    case ERR_NOT_IN_RANGE:
      log.info(`${task}: target not in range`);
      flag = moveTo(creep, target, task);
      break;

    case OK:
      log.info(`${task}: harvesting`);
      // store the current source so that we can move away from it once
      // harvesting is complete, this is so we don't block the source
      // from other creeps
      creep.memory.nearSource = target.id;
      flag = true;
      break;

    default:
      log.info(`${task}: unknown response during harvest'${result}'`);
      flag = true;
  }

  return flag;
}

// TODO: maybe always return false from moveTo as it appears that a moveTo
//       can be done on a turn in any combination of other tasks
function moveTo(creep, target, task, opts = {}) {
  let flag;

  log.info(`${task}: moving to '${target}'`);
  let moveResult = creep.moveTo(target, opts);
  switch (moveResult) {
    case ERR_NO_PATH:
      log.info(`${task}: cannot find path to '${target}', resetting target`);
      creep.memory.target = null;
      flag = false;
      break;
    case ERR_TIRED:
      log.info(`${task}: creep is tired during move, will tray again later`);
      flag = true;
      break;
    case OK:
      for (let i of creep.pos.look()) {
        if (
          i.type === 'structure' &&
          i.structure.structureType === STRUCTURE_ROAD
        ) {
          if (creep.room.memory.roads[i.structure.id] === undefined) {
            creep.room.memory.roads[i.structure.id] = {};
          }
          creep.room.memory.roads[i.structure.id].lastWalkedOn =
            Game.rooms[creep.memory.homeRoom].memory.currentTimestamp;
        }
      }
      flag = true;
      break;
    default:
      log.info(`${task}: unknown response during moving to '${target}' -- '${moveResult}'`);
      flag = true;
  }

  return flag;
}

function transfer(creep, target, task, type = RESOURCE_ENERGY, okCb) {
  let flag;

  let result = creep.transfer(target, type);

  switch (result) {
    case ERR_FULL:
      log.info(`${task}: trasnfer structure full of ${type}`);
      creep.memory.target = null;
      flag = false;
      break;
    case ERR_INVALID_TARGET:
      // for some reason current target is no longer valid
      // reset target for next tick, but keep task as task should still be valid
      log.info(`${task}: transfer target no longer valid`);
      creep.memory.target = null;
      flag = false;
      break;
    case ERR_NOT_IN_RANGE:
      // storages and spawns can be bottlenecks
      // lower reusepath when transfering to them to help optimize paths as
      // creeps move to and away from these structures
      if ([STRUCTURE_STORAGE, STRUCTURE_SPAWN].includes(target.structureType)) {
        flag = moveTo(creep, target, task, { reusePath: 3 });
      } else {
        flag = moveTo(creep, target, task);
      }
      break;
    case OK:
      log.info(`${task}: transferring to structure`);
      if (typeof okCb === 'function') {
        okCb();
      }
      // reset task now if creep is out of energy after transfer
      if (creep.carry[type] === 0) {
        creep.memory.target = null;
        creep.memory.task = null;
      }
      flag = true;
      break;
    default:
      log.info(`${task}: unknown response during transfer'${result}'`);
      creep.memory.target = null;
      creep.memory.task = null;
      flag = true;
  }

  return flag;
}

function withdraw(creep, target, task, type = RESOURCE_ENERGY, initialTargetOnly = false) {
  let flag;

  let result = creep.withdraw(target, type);

  switch (result) {
    case ERR_FULL:
      log.info(`${task}: creep full of ${type}`);
      creep.memory.target = null;
      flag = false;
      break;
    case ERR_INVALID_TARGET:
      // for some reason current target is no longer valid
      // reset target for next tick, but keep task as task should still be valid
      log.info(`${task}: withdraw target no longer valid`);
      creep.memory.target = null;
      flag = false;
      break;
    case ERR_NOT_ENOUGH_RESOURCES:
      log.info(`${task}: store is out of resource ${type}`);
      creep.memory.target = null;
      flag = false;
      break;
    case ERR_NOT_IN_RANGE:
      flag = moveTo(creep, target, task);
      break;
    case OK:
      log.info(`${task}: withdrawing`);
      // reset task now if creep is full after withdraw
      if (_.sum(creep.carry) >= creep.carryCapacity) {
        log.info(`${task}: creep full, resetting task and target`);
        creep.memory.target = null;
        creep.memory.task = null;
      } else if (
        !initialTargetOnly &&
        (
          (target.store && target.store[type] === 0) ||
          target[type] === 0
        )
      ) { // reset if if current target is out of energy
        creep.memory.target = helpers.getTarget(creep, 'energyStore');
        if (!creep.memory.target) {
          creep.memory.target = helpers.getTarget(creep, 'storage');
        }
      }
      flag = true;
      break;
    default:
      log.info(`${task}: unknown response during withdraw '${result}'`);
      creep.memory.target = null;
      creep.memory.task = null;
      flag = true;
  }

  return flag;
}

module.exports = {
  attack: attack,
  harvest: harvest,
  moveTo: moveTo,
  transfer: transfer,
  withdraw: withdraw
};
