// Fixes Windows path-casing split: when Node.js module cache has two entries
// for the same physical file under different-cased paths (C:\Projects vs
// C:\projects), hooks are called on one instance while the renderer sets up
// the other, causing "Cannot read properties of null (reading 'useContext')".
//
// This hook normalises every resolved filename before it enters the module
// cache so the two paths collapse into one cache entry.
"use strict";
const Module = require("module");
const WRONG = /^C:\\Projects\\cms-app/i;
const RIGHT = "C:\\projects\\cms-app";

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  let resolved = origResolve.call(this, request, parent, isMain, options);
  if (WRONG.test(resolved)) {
    resolved = RIGHT + resolved.slice(RIGHT.length); // keep the rest
  }
  return resolved;
};
