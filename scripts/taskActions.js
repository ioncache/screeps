'use strict';

let helpers = require('helpers');
let log = require('logger');
let strings = require('strings');

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
      flag = true;
      break;
    default:
      log.info(`${task}: unknown response during moving to '${target}' -- '${moveResult}'`);
      flag = true;
  }

  return flag;
}

function transfer(creep, target, task, type = RESOURCE_ENERGY) {
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

function withdraw(creep, target, task, type = RESOURCE_ENERGY) {
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
        creep.memory.target = null;
        creep.memory.task = null;
      } else if (
        target[type] === 0 ||
        (target.store && target.store[type] === 0)
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
  harvest: harvest,
  moveTo: moveTo,
  transfer: transfer,
  withdraw: withdraw
};
