/**
 * This file initialzes the main apparition instance, and re-runs any tasks that
 * were any tasks that were executed on the dummy apparition object before real
 * apparition was loaded.
 */
"use strict";
goog.provide("apparition_instance");

goog.require("Apparition");
goog.require("config"); // jshint unused:false

apparition_instance = new Apparition();

if (window["apparition"] && window["apparition"]["_q"]) {
  // console.log(window["apparition"]);
  // console.log(apparition_instance);
  var queue = window["apparition"]["_q"];
  for (var i = 0; i < queue.length; i++) {
    var task = queue[i];
    console.log(task);
    apparition_instance[task[0]].apply(apparition_instance, task[1]);
  }
}

// Provides a UMD-style module wrapper for the apparition instance, meaning
// that the SDK can be used in any CommonJS, RequireJS, and vanilla JS environment.

// AMD
if (typeof define === "function" && define.amd) {
  define("apparition", function () {
    return apparition_instance;
  });
}
// CommonJS-like environments that support module.exports
else if (typeof exports === "object") {
  module.exports = apparition_instance;
}

// Always make a global.
if (window) {
  window["apparition"] = apparition_instance;
}
