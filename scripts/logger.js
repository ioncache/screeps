'use strict';

let started = false;
let logId = null;

const DEBUG = false;

function base(message) {
  if (DEBUG) {
    console.log(started ? `  ${message}` : message);
  }
}

function start(id, message) {
  started = true;
  logId = id;
  if (DEBUG) {
    console.log(`***** Begin Logging ${logId}: ${message} *****`);
  }
}

function finish(message) {
  if (DEBUG) {
    console.log(`***** Finish Logging ${logId}: ${message} *****\n\n`);
  }
  started = false;
  logId = null;
}

function log(message) {
  console.log(message);
}

function info(message) {
  base(`${message}`);
}

function error(message) {
  base(`ERROR: ${message}`);
}

function warn(message) {
  base(`WARN: ${message}`);
}

module.exports = {
    error: error,
    finish: finish,
    info: info,
    log: log,
    warn: warn,
    start: start
};
