/**
 * A custom storage abstraction class that implements:
 * sessionStorage, localStorage, cookies, and a plain
 * old javascript object as a fallback
 */
"use strict";

goog.provide("storage");
/*jshint unused:false*/
goog.require("goog.json");
goog.require("utils");

/*globals Ti */

var COOKIE_MS = 365 * 24 * 60 * 60 * 1000;
var APPARITION_KEY_PREFIX = "APPARITION_WEBSDK_KEY";

/** @typedef {undefined|{get:function(string, boolean=), set:function(string, (string|boolean), boolean=),
 * remove:function(string), clear:function(), isEnabled:function()}} */

/**
 * @class ApparitionStorage
 * @constructor
 */
storage.ApparitionStorage = function (storageMethods) {
  for (var i = 0; i < storageMethods.length; i++) {
    var storageMethod = this[storageMethods[i]];
    storageMethod =
      typeof storageMethod === "function" ? storageMethod() : storageMethod;
    if (storageMethod.isEnabled()) {
      storageMethod._store = {};
      return storageMethod;
    }
  }
};

var prefix = function (key) {
  return key === "apparition_session" || key === "apparition_session_first"
    ? key
    : APPARITION_KEY_PREFIX + key;
};

var trimPrefix = function (key) {
  return key.replace(APPARITION_KEY_PREFIX, "");
};

var retrieveValue = function (value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return value;
};

var hasApparitionPrefix = function (key) {
  return key.indexOf(APPARITION_KEY_PREFIX) === 0;
};

var isApparitionCookie = function (key) {
  return (
    key === "apparition_session" ||
    key === "apparition_session_first" ||
    hasApparitionPrefix(key)
  );
};

var processCookie = function (row) {
  var cookie = row.trim();
  var firstEqualSign = cookie.indexOf("=");
  return {
    name: cookie.substring(0, firstEqualSign),
    value: retrieveValue(cookie.substring(firstEqualSign + 1, cookie.length)),
  };
};

var webStorage = function (perm) {
  var storageMethod;
  try {
    storageMethod = perm && localStorage ? localStorage : sessionStorage;
  } catch (err) {
    return {
      isEnabled: function () {
        return false;
      },
    };
  }
  return {
    getAll: function () {
      if (typeof storageMethod === "undefined") {
        return null;
      }

      var allKeyValues = null;
      for (var key in storageMethod) {
        if (key.indexOf(APPARITION_KEY_PREFIX) === 0) {
          if (allKeyValues === null) {
            allKeyValues = {};
          }
          allKeyValues[trimPrefix(key)] = retrieveValue(
            storageMethod.getItem(key),
          );
        }
      }
      return utils.decodeBFPs(allKeyValues);
    },
    get: function (key, perm_override) {
      // Make sure that browser_fingerprint_id gets decoded every time it is accessed.
      if (
        key === "browser_fingerprint_id" ||
        key === "alternative_browser_fingerprint_id"
      ) {
        return perm_override && localStorage
          ? utils.base64Decode(localStorage.getItem(prefix(key)))
          : utils.base64Decode(storageMethod.getItem(prefix(key)));
      }
      return retrieveValue(
        perm_override && localStorage
          ? localStorage.getItem(prefix(key))
          : storageMethod.getItem(prefix(key)),
      );
    },
    set: function (key, value, perm_override) {
      if (perm_override && localStorage) {
        localStorage.setItem(prefix(key), value);
      } else {
        storageMethod.setItem(prefix(key), value);
      }
    },
    remove: function (key, perm_override) {
      if (perm_override && localStorage) {
        localStorage.removeItem(prefix(key));
      } else {
        storageMethod.removeItem(prefix(key));
      }
    },
    clear: function () {
      Object.keys(storageMethod).forEach(function (item) {
        if (item.indexOf(APPARITION_KEY_PREFIX) === 0) {
          storageMethod.removeItem(item);
        }
      });
    },
    isEnabled: function () {
      try {
        storageMethod.setItem("test", "");
        storageMethod.removeItem("test");
        return true;
      } catch (err) {
        return false;
      }
    },
  };
};

/** @type {storage} */
storage.ApparitionStorage.prototype["local"] = function () {
  return webStorage(true);
};

/** @type {storage} */
storage.ApparitionStorage.prototype["session"] = function () {
  return webStorage(false);
};

var cookies = function () {
  var setCookie = function (key, value) {
    document.cookie = key + "=" + value + "; path=/";
  };
  var removeCookie = function (key, addPrefix) {
    var expires = "Thu, 01 Jan 1970 00:00:01 GMT";
    if (addPrefix) {
      key = prefix(key);
    }
    document.cookie = key + "=; expires=" + expires + "; path=/";
  };
  return {
    getAll: function () {
      var returnCookieObject = {};
      var cookieArray = document.cookie.split(";");
      for (var i = 0; i < cookieArray.length; i++) {
        var cookie = processCookie(cookieArray[i]);
        if (
          cookie &&
          cookie.hasOwnProperty("name") &&
          cookie.hasOwnProperty("value") &&
          isApparitionCookie(cookie["name"])
        ) {
          returnCookieObject[trimPrefix(cookie["name"])] = cookie["value"];
        }
      }
      return returnCookieObject;
    },
    get: function (key) {
      key = prefix(key);
      var cookieArray = document.cookie.split(";");
      for (var i = 0; i < cookieArray.length; i++) {
        var cookie = processCookie(cookieArray[i]);
        if (
          cookie &&
          cookie.hasOwnProperty("name") &&
          cookie.hasOwnProperty("value") &&
          cookie["name"] === key
        ) {
          return cookie["value"];
        }
      }
      return null;
    },
    set: function (key, value) {
      setCookie(prefix(key), value);
    },
    remove: function (key) {
      removeCookie(key, true);
    },
    clear: function () {
      var cookieArray = document.cookie.split(";");
      for (var i = 0; i < cookieArray.length; i++) {
        var cookie = processCookie(cookieArray[i]);
        if (
          cookie &&
          cookie.hasOwnProperty("name") &&
          isApparitionCookie(cookie["name"])
        ) {
          removeCookie(cookie["name"], false);
        }
      }
    },
    isEnabled: function () {
      return navigator.cookieEnabled;
    },
  };
};

storage.ApparitionStorage.prototype["cookie"] = function () {
  return cookies();
};

/** @type {storage} */
storage.ApparitionStorage.prototype["pojo"] = {
  getAll: function () {
    return this._store;
  },
  get: function (key) {
    return this._store[key] || null;
  },
  set: function (key, value) {
    this._store[key] = value;
  },
  remove: function (key) {
    delete this._store[key];
  },
  clear: function () {
    this._store = {};
  },
  isEnabled: function () {
    return true;
  },
};
