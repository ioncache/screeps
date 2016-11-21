'use strict';

let started = false;
let logId = null;

const DEBUG = true;

function log(message) {
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
  started = false;
  if (DEBUG) {
    console.log(`***** Finish Logging ${logId}: ${message} *****\n\n`);
  }
}

function info(message) {
  log(`${message}`);
}

function error(message) {
  log(`ERROR: ${message}`);
}

function warn(message) {
  log(`WARN: ${message}`);
}

module.exports = {
    error: error,
    finish: finish,
    info: info,
    warn: warn,
    start: start
};
