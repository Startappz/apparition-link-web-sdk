/***
 * This file provides the main Apparition function.
 */
"use strict";
goog.provide("Apparition");
goog.require("goog.json"); // jshint unused:false

goog.require("utils");
goog.require("resources");
goog.require("Server");
goog.require("banner");
goog.require("task_queue");
goog.require("storage");
goog.require("session");
goog.require("config");
goog.require("safejson");
goog.require("apparition_view");
goog.require("journeys_utils");

/*globals Ti, ApparitionStorage, require */

var default_apparition;

/**
 * Enum for what parameters are in a wrapped Apparition method
 * @enum {number}
 */
var callback_params = {
  NO_CALLBACK: 0,
  CALLBACK_ERR: 1,
  CALLBACK_ERR_DATA: 2,
};

/**
 * Enum for the initialization state of the Apparition Object
 * @enum {number}
 */
var init_states = {
  NO_INIT: 0,
  INIT_PENDING: 1,
  INIT_FAILED: 2,
  INIT_SUCCEEDED: 3,
};

/**
 * Enum for the initialization state of the Apparition Object
 * @enum {number}
 */
var init_state_fail_codes = {
  NO_FAILURE: 0,
  UNKNOWN_CAUSE: 1,
  OPEN_FAILED: 2,
  BFP_NOT_FOUND: 3,
  HAS_APP_FAILED: 4,
};

/***
 * @param {number} parameters
 * @param {function(...?): undefined} func
 * @param {boolean=} init
 */
var wrap = function (parameters, func, init) {
  var r = function () {
    var self = this;
    var args;
    var callback;
    var lastArg = arguments[arguments.length - 1];
    if (
      parameters === callback_params.NO_CALLBACK ||
      typeof lastArg !== "function"
    ) {
      callback = function (err) {
        return;
      };
      args = Array.prototype.slice.call(arguments);
    } else {
      args =
        Array.prototype.slice.call(arguments, 0, arguments.length - 1) || [];
      callback = lastArg;
    }
    self._queue(function (next) {
      /***
       * @type {function(?Error,?): undefined}
       */
      var done = function (err, data) {
        try {
          if (err && parameters === callback_params.NO_CALLBACK) {
            throw err;
          } else if (parameters === callback_params.CALLBACK_ERR) {
            callback(err);
          } else if (parameters === callback_params.CALLBACK_ERR_DATA) {
            callback(err, data);
          }
        } finally {
          // ...but we always want to call next
          next();
        }
      };
      if (!init) {
        if (self.init_state === init_states.INIT_PENDING) {
          return done(
            new Error(utils.message(utils.messages.initPending)),
            null,
          );
        } else if (self.init_state === init_states.INIT_FAILED) {
          return done(
            new Error(
              utils.message(
                utils.messages.initFailed,
                self.init_state_fail_code,
                self.init_state_fail_details,
              ),
            ),
            null,
          );
        } else if (
          self.init_state === init_states.NO_INIT ||
          !self.init_state
        ) {
          return done(new Error(utils.message(utils.messages.nonInit)), null);
        }
      }
      args.unshift(done);
      func.apply(self, args);
    });
  };
  return r;
};

/***
 * @class Apparition
 * @constructor
 */
Apparition = function () {
  if (!(this instanceof Apparition)) {
    if (!default_apparition) {
      default_apparition = new Apparition();
    }
    return default_apparition;
  }
  this._queue = task_queue();

  var storageMethods = ["session", "cookie", "pojo"];

  this._storage = /** @type {storage} */ (
    new storage.ApparitionStorage(storageMethods)
  ); // jshint ignore:line

  this._server = new Server();

  var sdk = "web";

  /** @type {Array<utils.listener>} */
  this._listeners = [];

  this.sdk = sdk + config.version;
  this.requestMetadata = {};

  this.init_state = init_states.NO_INIT;
  this.init_state_fail_code = init_state_fail_codes.NO_FAILURE;
  this.init_state_fail_details = null;
};

/***
 * @param {utils.resource} resource
 * @param {Object.<string, *>} obj
 * @param {function(?Error,?)=} callback
 */
Apparition.prototype._api = function (resource, obj, callback) {
  if (this.app_id) {
    obj["app_id"] = this.app_id;
  }
  if (this.apparition_key) {
    obj["apparition_key"] = this.apparition_key;
  }
  if (
    ((resource.params && resource.params["session_id"]) ||
      (resource.queryPart && resource.queryPart["session_id"])) &&
    this.session_id
  ) {
    obj["session_id"] = this.session_id;
  }
  if (
    ((resource.params && resource.params["identity_id"]) ||
      (resource.queryPart && resource.queryPart["identity_id"])) &&
    this.identity_id
  ) {
    obj["identity_id"] = this.identity_id;
  }

  if (resource.endpoint.indexOf("/v1/") < 0) {
    if (
      ((resource.params && resource.params["developer_identity"]) ||
        (resource.queryPart && resource.queryPart["developer_identity"])) &&
      this.identity
    ) {
      obj["developer_identity"] = this.identity;
    }
  } else {
    if (
      ((resource.params && resource.params["identity"]) ||
        (resource.queryPart && resource.queryPart["identity"])) &&
      this.identity
    ) {
      obj["identity"] = this.identity;
    }
  }

  if (
    ((resource.params && resource.params["link_click_id"]) ||
      (resource.queryPart && resource.queryPart["link_click_id"])) &&
    this.link_click_id
  ) {
    obj["link_click_id"] = this.link_click_id;
  }
  if (
    ((resource.params && resource.params["sdk"]) ||
      (resource.queryPart && resource.queryPart["sdk"])) &&
    this.sdk
  ) {
    obj["sdk"] = this.sdk;
  }

  if (
    ((resource.params && resource.params["browser_fingerprint_id"]) ||
      (resource.queryPart && resource.queryPart["browser_fingerprint_id"])) &&
    this.browser_fingerprint_id
  ) {
    obj["browser_fingerprint_id"] = this.browser_fingerprint_id;
  }
  // Adds tracking_disabled to every post request when enabled
  if (utils.userPreferences.trackingDisabled) {
    obj["tracking_disabled"] = utils.userPreferences.trackingDisabled;
  }
  if (this.requestMetadata) {
    for (var metadata_key in this.requestMetadata) {
      if (this.requestMetadata.hasOwnProperty(metadata_key)) {
        if (!obj["apparition_requestMetadata"]) {
          obj["apparition_requestMetadata"] = {};
        }
        obj["apparition_requestMetadata"][metadata_key] =
          this.requestMetadata[metadata_key];
      }
    }
  }
  if (utils.shouldAddDMAParams(resource.endpoint)) {
    var dmaData = this._storage.get("apparition_dma_data", true);
    obj["apparition_dma_data"] = dmaData ? safejson.parse(dmaData) : null;
  }
  if (resource.endpoint !== "/_r") {
    resource.destination = config.api_endpoint;
  }
  return this._server.request(
    resource,
    obj,
    this._storage,
    function (err, data) {
      callback(err, data);
    },
  );
};

/***
 * @function Apparition._referringLink
 */
Apparition.prototype._referringLink = function (forJourneys) {
  var sessionData = session.get(this._storage);
  var referringLink = sessionData && sessionData["referring_link"];
  if (referringLink) {
    return referringLink;
  } else {
    if (utils.userPreferences.enableExtendedJourneysAssist && forJourneys) {
      var localStorageData = session.get(this._storage, true);
      var referring_Link =
        localStorageData && localStorageData["referring_link"];
      var referringLinkExpiry =
        localStorageData && localStorageData["referringLinkExpiry"];
      if (referring_Link && referringLinkExpiry) {
        var now = new Date();
        // compare the expiry time of the item with the current time
        if (now.getTime() > referringLinkExpiry) {
          session.patch(
            this._storage,
            { referringLinkExpiry: null },
            true,
            true,
          );
        } else {
          return referring_Link;
        }
      }
    }
  }

  var clickId = this._storage.get("click_id");
  if (clickId) {
    return config.link_service_endpoint + "/c/" + clickId;
  }

  return null;
};

/***
 * @function Apparition._publishEvent
 * @param {string} event
 * @param {Object} data - _optional_ - data to pass into listener callback.
 */
Apparition.prototype._publishEvent = function (event, data) {
  for (var i = 0; i < this._listeners.length; i++) {
    if (!this._listeners[i].event || this._listeners[i].event === event) {
      this._listeners[i].listener(event, data);
    }
  }
};

/**
 * @function Apparition.init
 * @param {string} apparition_key - _required_ - Your Apparition [live key](@TODO)
 * @param {Object=} options - _optional_ - { }.
 * @param {function(?Error, utils.sessionData=)=} callback - _optional_ - callback to read the
 * session data.
 *
 * Adding the Apparition script to your page automatically creates a window.apparition
 * object with all the external methods described below. All calls made to
 * Apparition methods are stored in a queue, so even if the SDK is not fully
 * instantiated, calls made to it will be queued in the order they were
 * originally called.
 * If the session was opened from a referring link, `data()` will also return the referring link
 * click as `referring_link`, which gives you the ability to continue the click flow.
 *
 * The init function on the Apparition object initiates the Apparition session and
 * creates a new user session, if it doesn't already exist, in
 * `sessionStorage`.
 *
 * **Useful Tip**: The init function returns a data object where you can read
 * the link the user was referred by.
 *
 * Properties available in the options object:
 *
 * | Key | Value
 * | --- | ---
 * | apparition_match_id | *optional* - `string`. The current user's browser-fingerprint-id. The value of this parameter should be the same as the value of ?_apparition_match_id (automatically appended by Apparition after a link click). _Only necessary if ?_apparition_match_id is lost due to multiple redirects in your flow_.
 * | apparition_view_id | *optional* - `string`. If you would like to test how Journeys render on your page before activating them, you can set the value of this parameter to the id of the view you are testing. _Only necessary when testing a view related to a Journey_.
 * | no_journeys | *optional* - `boolean`. When true, prevents Journeys from appearing on current page.
 * | disable_entry_animation | *optional* - `boolean`. When true, prevents a Journeys entry animation.
 * | disable_exit_animation | *optional* - `boolean`. When true, prevents a Journeys exit animation.
 * | retries | *optional* - `integer`. Value specifying the number of times that a Apparition API call can be re-attempted. Default 2.
 * | retry_delay | *optional* - `integer `. Amount of time in milliseconds to wait before re-attempting a timed-out request to the Apparition API. Default 200 ms.
 * | timeout | *optional* - `integer`. Duration in milliseconds that the system should wait for a response before considering any Apparition API call to have timed out. Default 5000 ms.
 * | metadata | *optional* - `object`. Key-value pairs used to target Journeys users via the "is viewing a page with metadata key" filter.
 * | nonce | *optional* - `string`. A nonce value that will be added to apparition-journey-cta injected script. Used to allow that script from a Content Security Policy.
 * | tracking_disabled | *optional* - `boolean`. true disables tracking
 *
 * ##### Usage
 * ```js
 * apparition.init(
 *     apparition_key,
 *     options,
 *     callback (err, data),
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *      "Error message",
 *      {
 *           data_parsed:        { },                          // If the user was referred from a link, and the link has associated data, the data is passed in here.
 *           referring_identity: '12345',                      // If the user was referred from a link, and the link was created by a user with an identity, that identity is here.
 *           has_app:            true,                         // Does the user have the app installed already?
 *           identity:           'ApparitionUser',                 // Unique string that identifies the user
 *           ~referring_link:     '@TODO' // The referring link click, if available.
 *      }
 * );
 * ```
 *
 * **Note:** `Apparition.init` must be called prior to calling any other Apparition functions.
 * ___
 */
/*** +TOC_HEADING &Apparition Session& ^ALL ***/
/*** +TOC_ITEM #initapparition_key-options-callback &.init()& ^ALL ***/
Apparition.prototype["init"] = wrap(
  callback_params.CALLBACK_ERR_DATA,
  function (done, apparition_key, options) {
    if (utils.navigationTimingAPIEnabled) {
      utils.instrumentation["init-began-at"] = utils.timeSinceNavigationStart();
    }

    var self = this;

    self.init_state = init_states.INIT_PENDING;

    if (utils.isKey(apparition_key)) {
      self.apparition_key = apparition_key;
    } else {
      self.app_id = apparition_key;
    }

    options =
      options && utils.validateParameterType(options, "object") ? options : {};
    self.init_options = options;

    utils.retries =
      options && options["retries"] && Number.isInteger(options["retries"])
        ? options["retries"]
        : utils.retries;
    utils.retry_delay =
      options &&
      options["retry_delay"] &&
      Number.isInteger(options["retry_delay"])
        ? options["retry_delay"]
        : utils.retry_delay;
    utils.timeout =
      options && options["timeout"] && Number.isInteger(options["timeout"])
        ? options["timeout"]
        : utils.timeout;
    utils.nonce = options && options["nonce"] ? options["nonce"] : utils.nonce;
    utils.debug =
      options && options["enableLogging"]
        ? options["enableLogging"]
        : utils.debug;

    utils.userPreferences.trackingDisabled =
      options &&
      options["tracking_disabled"] &&
      options["tracking_disabled"] === true
        ? true
        : false;
    utils.userPreferences.enableExtendedJourneysAssist =
      options && options["enableExtendedJourneysAssist"]
        ? options["enableExtendedJourneysAssist"]
        : utils.userPreferences.enableExtendedJourneysAssist;
    utils.extendedJourneysAssistExpiryTime =
      options &&
      options["extendedJourneysAssistExpiryTime"] &&
      Number.isInteger(options["extendedJourneysAssistExpiryTime"])
        ? options["extendedJourneysAssistExpiryTime"]
        : utils.extendedJourneysAssistExpiryTime;
    utils.userPreferences.allowErrorsInCallback = false;
    utils.getClientHints();

    if (utils.userPreferences.trackingDisabled) {
      utils.cleanApplicationAndSessionStorage(self);
    }

    // initialize identity_id from storage
    // note the previous line scrubs this if tracking disabled.
    var localData = session.get(self._storage, true);
    self.identity_id = localData && localData["identity_id"];

    var setApparitionValues = function (data) {
      if (data["link_click_id"]) {
        self.link_click_id = data["link_click_id"].toString();
      }
      if (data["session_link_click_id"]) {
        self.session_link_click_id = data["session_link_click_id"].toString();
      }
      if (data["session_id"]) {
        self.session_id = data["session_id"].toString();
      }
      if (data["identity_id"]) {
        self.identity_id = data["identity_id"].toString();
      }
      if (data["identity"]) {
        self.identity = data["identity"].toString();
      }
      if (data["link"]) {
        self.sessionLink = data["link"];
      }
      if (data["referring_link"]) {
        data["referring_link"] = utils.processReferringLink(
          data["referring_link"],
        );
      }
      if (!data["click_id"] && data["referring_link"]) {
        data["click_id"] = utils.getClickIdAndSearchStringFromLink(
          data["referring_link"],
        );
      }

      self.browser_fingerprint_id = data["browser_fingerprint_id"];

      return data;
    };

    var sessionData = session.get(self._storage);

    var apparitionMatchIdFromOptions =
      options &&
      typeof options["apparition_match_id"] !== "undefined" &&
      options["apparition_match_id"] !== null
        ? options["apparition_match_id"]
        : null;
    var link_identifier =
      apparitionMatchIdFromOptions ||
      utils.getParamValue("_apparition_match_id") ||
      utils.hashValue("r");
    var freshInstall = !self.identity_id; // initialized from local storage above
    self._apparitionViewEnabled = !!self._storage.get(
      "apparition_view_enabled",
    );

    var fetchLatestBrowserFingerPrintID = function (cb) {
      var params_r = {
        sdk: config.version,
        apparition_key: self.apparition_key,
      };
      var currentSessionData = session.get(self._storage) || {};
      var permData = session.get(self._storage, true) || {};
      if (permData["browser_fingerprint_id"]) {
        params_r["_t"] = permData["browser_fingerprint_id"];
      }

      if (!utils.isSafari11OrGreater() && !utils.isIOSWKWebView()) {
        self._api(
          resources._r,
          params_r,
          function (err, browser_fingerprint_id) {
            if (err) {
              self.init_state_fail_code = init_state_fail_codes.BFP_NOT_FOUND;
              self.init_state_fail_details = err.message;
            }
            if (browser_fingerprint_id) {
              currentSessionData["browser_fingerprint_id"] =
                browser_fingerprint_id;
            }
          },
        );
      }
      if (cb) {
        cb(null, currentSessionData);
      }
    };

    var restoreIdentityOnInstall = function (data) {
      if (freshInstall) {
        data["identity"] = self.identity;
      }
      return data;
    };

    var finishInit = function (err, data) {
      if (data) {
        data = setApparitionValues(data);

        if (!utils.userPreferences.trackingDisabled) {
          data = restoreIdentityOnInstall(data);
          session.set(self._storage, data, freshInstall);
        }

        self.init_state = init_states.INIT_SUCCEEDED;
        data["data_parsed"] =
          data["data"] && data["data"].length !== 0
            ? safejson.parse(data["data"])
            : {};
      }
      if (err) {
        self.init_state = init_states.INIT_FAILED;
        if (!self.init_state_fail_code) {
          self.init_state_fail_code = init_state_fail_codes.UNKNOWN_CAUSE;
          self.init_state_fail_details = err.message;
        }

        return done(err, data && utils.whiteListSessionData(data));
      }

      try {
        done(err, data && utils.whiteListSessionData(data));
      } catch (e) {
        // pass
      } finally {
        self["renderFinalize"]();
      }

      var additionalMetadata = utils.getAdditionalMetadata();
      var metadata = utils.validateParameterType(options["metadata"], "object")
        ? options["metadata"]
        : null;
      if (metadata) {
        var hostedDeeplinkDataWithMergedMetadata =
          utils.mergeHostedDeeplinkData(
            additionalMetadata["hosted_deeplink_data"],
            metadata,
          );
        if (
          hostedDeeplinkDataWithMergedMetadata &&
          Object.keys(hostedDeeplinkDataWithMergedMetadata).length > 0
        ) {
          additionalMetadata["hosted_deeplink_data"] =
            hostedDeeplinkDataWithMergedMetadata;
        }
      }
      var requestData = apparition_view._getPageviewRequestData(
        journeys_utils._getPageviewMetadata(options, additionalMetadata),
        options,
        self,
        false,
      );
      self["renderQueue"](function () {
        self._api(
          resources.pageview,
          requestData,
          function (err, pageviewResponse) {
            if (!err && typeof pageviewResponse === "object") {
              var journeyInTestMode = requestData["apparition_view_id"]
                ? true
                : false;
              if (
                apparition_view.shouldDisplayJourney(
                  pageviewResponse,
                  options,
                  journeyInTestMode,
                )
              ) {
                apparition_view.displayJourney(
                  pageviewResponse["template"],
                  requestData,
                  requestData["apparition_view_id"] ||
                    pageviewResponse["event_data"]["apparition_view_data"][
                      "id"
                    ],
                  pageviewResponse["event_data"]["apparition_view_data"],
                  journeyInTestMode,
                  pageviewResponse["journey_link_data"],
                );
              } else {
                if (
                  pageviewResponse["auto_apparitionify"] ||
                  (!apparitionMatchIdFromOptions &&
                    utils.getParamValue("apparitionify_url") &&
                    self._referringLink())
                ) {
                  var linkOptions = {
                    make_new_link: false,
                    open_app: true,
                    auto_apparitionify: true,
                  };
                  this["apparition"]["deepview"]({}, linkOptions);
                }
                journeys_utils.apparition._publishEvent("willNotShowJourney");
              }
            }
            if (utils.userPreferences.trackingDisabled) {
              utils.userPreferences.allowErrorsInCallback = true;
            }
          },
        );
      });
    };
    var attachVisibilityEvent = function () {
      var hidden;
      var changeEvent;
      if (typeof document.hidden !== "undefined") {
        hidden = "hidden";
        changeEvent = "visibilitychange";
      } else if (typeof document.mozHidden !== "undefined") {
        hidden = "mozHidden";
        changeEvent = "mozvisibilitychange";
      } else if (typeof document.msHidden !== "undefined") {
        hidden = "msHidden";
        changeEvent = "msvisibilitychange";
      } else if (typeof document.webkitHidden !== "undefined") {
        hidden = "webkitHidden";
        changeEvent = "webkitvisibilitychange";
      }
      if (changeEvent) {
        // Ensures that we add a change-event-listener exactly once in-case re-initialization occurs through apparition.trackingDisabled(false)
        if (!self.changeEventListenerAdded) {
          self.changeEventListenerAdded = true;
          document.addEventListener(
            changeEvent,
            function () {
              if (!document[hidden]) {
                fetchLatestBrowserFingerPrintID(null);
                if (typeof self._deepviewRequestForReplay === "function") {
                  self._deepviewRequestForReplay();
                }
              }
            },
            false,
          );
        }
      }
    };
    if (
      sessionData &&
      sessionData["session_id"] &&
      !link_identifier &&
      !utils.getParamValue("apparitionify_url")
    ) {
      // resets data in session storage to prevent previous link click data from being returned to Apparition.init()
      session.update(self._storage, { data: "" });
      session.update(self._storage, { referring_link: "" });
      attachVisibilityEvent();
      fetchLatestBrowserFingerPrintID(finishInit);
      return;
    }

    var params_r = { sdk: config.version, apparition_key: self.apparition_key };
    var permData = session.get(self._storage, true) || {};

    if (permData["browser_fingerprint_id"]) {
      params_r["_t"] = permData["browser_fingerprint_id"];
    }

    if (permData["identity"]) {
      self.identity = permData["identity"];
    }

    // Execute the /v1/open right away or after _open_delay_ms.
    var open_delay = parseInt(utils.getParamValue("[?&]_open_delay_ms"), 10);

    if (!utils.isSafari11OrGreater() && !utils.isIOSWKWebView()) {
      self._api(resources._r, params_r, function (err, browser_fingerprint_id) {
        if (err) {
          self.init_state_fail_code = init_state_fail_codes.BFP_NOT_FOUND;
          self.init_state_fail_details = err.message;
          return finishInit(err, null);
        }
        utils.delay(function () {
          self._api(
            resources.open,
            {
              link_identifier: link_identifier,
              browser_fingerprint_id: link_identifier || browser_fingerprint_id,
              identity: permData["identity"] ? permData["identity"] : null,
              alternative_browser_fingerprint_id:
                permData["browser_fingerprint_id"],
              options: options,
              initial_referrer: utils.getInitialReferrer(self._referringLink()),
              current_url: utils.getCurrentUrl(),
              screen_height: utils.getScreenHeight(),
              screen_width: utils.getScreenWidth(),
              model: utils.userAgentData ? utils.userAgentData.model : null,
              os_version: utils.userAgentData
                ? utils.userAgentData.platformVersion
                : null,
            },
            function (err, data) {
              if (err) {
                self.init_state_fail_code = init_state_fail_codes.OPEN_FAILED;
                self.init_state_fail_details = err.message;
              }
              if (!err && typeof data === "object") {
                if (data["apparition_view_enabled"]) {
                  self._apparitionViewEnabled =
                    !!data["apparition_view_enabled"];
                  self._storage.set(
                    "apparition_view_enabled",
                    self._apparitionViewEnabled,
                  );
                }
                if (link_identifier) {
                  data["click_id"] = link_identifier;
                }
              }
              attachVisibilityEvent();
              finishInit(err, data);
            },
          );
        }, open_delay);
      });
    } else {
      utils.delay(function () {
        self._api(
          resources.open,
          {
            link_identifier: link_identifier,
            browser_fingerprint_id:
              link_identifier || permData["browser_fingerprint_id"],
            identity: permData["identity"] ? permData["identity"] : null,
            alternative_browser_fingerprint_id:
              permData["browser_fingerprint_id"],
            options: options,
            initial_referrer: utils.getInitialReferrer(self._referringLink()),
            current_url: utils.getCurrentUrl(),
            screen_height: utils.getScreenHeight(),
            screen_width: utils.getScreenWidth(),
            model: utils.userAgentData ? utils.userAgentData.model : null,
            os_version: utils.userAgentData
              ? utils.userAgentData.platformVersion
              : null,
          },
          function (err, data) {
            if (err) {
              self.init_state_fail_code = init_state_fail_codes.OPEN_FAILED;
              self.init_state_fail_details = err.message;
            }
            if (!err && typeof data === "object") {
              if (data["apparition_view_enabled"]) {
                self._apparitionViewEnabled = !!data["apparition_view_enabled"];
                self._storage.set(
                  "apparition_view_enabled",
                  self._apparitionViewEnabled,
                );
              }
              if (link_identifier) {
                data["click_id"] = link_identifier;
              }
            }
            attachVisibilityEvent();
            finishInit(err, data);
          },
        );
      }, open_delay);
    }
  },
  true,
);

/**
 * currently private method, which may be opened to the public in the future
 */
Apparition.prototype["renderQueue"] = wrap(
  callback_params.NO_CALLBACK,
  function (done, render) {
    var self = this;
    if (self._renderFinalized) {
      render();
    } else {
      self._renderQueue = self._renderQueue || [];
      self._renderQueue.push(render);
    }
    done(null, null);
  },
);

/**
 * currently private method, which may be opened to the public in the future
 */
Apparition.prototype["renderFinalize"] = wrap(
  callback_params.CALLBACK_ERR_DATA,
  function (done) {
    var self = this;
    if (self._renderQueue && self._renderQueue.length > 0) {
      self._renderQueue.forEach(function (callback) {
        callback.call(this);
      });
      delete self._renderQueue;
    }
    self._renderFinalized = true;
    done(null, null);
  },
);

Apparition.prototype["setAPIResponseCallback"] = wrap(
  callback_params.NO_CALLBACK,
  function (done, callback) {
    this._server.onAPIResponse = callback;
    done();
  },
  /* allowed before init */ true,
);

/***
 * @function Apparition.setAPIUrl
 * @param {String} url - url
 * Sets a custom base URL for all calls to the Apparition API
 */
Apparition.prototype["setAPIUrl"] = function (url) {
  if (!utils.isValidURL(url)) {
    console.error("setAPIUrl: Invalid URL format. Default URL will be set.");
    return;
  }

  config.api_endpoint = url;
};

/***
 * @function Apparition.getAPIUrl
 * returns the base URL for all calls to the Apparition API
 */
Apparition.prototype["getAPIUrl"] = function () {
  return config.api_endpoint;
};

/**
 * @function Apparition.data
 * @param {function(?Error, utils.sessionData=)=} callback - _optional_ - callback to read the
 * session data.
 *
 * Returns the same session information and any referring data, as
 * `Apparition.init`, but does not require the `app_id`. This is meant to be called
 * after `Apparition.init` has been called if you need the session information at a
 * later point.
 * If the Apparition session has already been initialized, the callback will return
 * immediately, otherwise, it will return once Apparition has been initialized.
 * ___
 */
/*** +TOC_ITEM #datacallback &.data()& ^ALL ***/
Apparition.prototype["data"] = wrap(
  callback_params.CALLBACK_ERR_DATA,
  function (done) {
    var data = utils.whiteListSessionData(session.get(this._storage));
    data["referring_link"] = this._referringLink();
    data["data_parsed"] =
      data["data"] && data["data"].length !== 0
        ? safejson.parse(data["data"])
        : {};
    done(null, data);
  },
);

/**
 * @function Apparition.first
 * @param {function(?Error, utils.sessionData=)=} callback - _optional_ - callback to read the
 * session data.
 *
 * Returns the same session information and any referring data, as
 * `Apparition.init` did when the app was first installed. This is meant to be called
 * after `Apparition.init` has been called if you need the first session information at a
 * later point.
 * If the Apparition session has already been initialized, the callback will return
 * immediately, otherwise, it will return once Apparition has been initialized.
 *
 * ___
 *
 */
/*** +TOC_ITEM #firstcallback &.first()& ^ALL ***/
Apparition.prototype["first"] = wrap(
  callback_params.CALLBACK_ERR_DATA,
  function (done) {
    done(null, utils.whiteListSessionData(session.get(this._storage, true)));
  },
);

/**
 * @function Apparition.setIdentity
 * @param {string} identity - _required_ - a string uniquely identifying the user - often a user ID
 * or email address.
 * @param {function(?Error, Object=)=} callback - _optional_ - callback that returns the user's
 * Apparition identity id and unique link.
 *
 * **[Formerly `identify()`](CHANGELOG.md)**
 *
 * Sets the identity of a user and returns the data. To use this function, pass
 * a unique string that identifies the user - this could be an email address,
 * UUID, Facebook ID, etc.
 *
 * ##### Usage
 * ```js
 * Apparition.setIdentity(
 *     identity,
 *     callback (err, data)
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *      "Error message",
 *      {
 *           identity_id:             '12345', // Server-generated ID of the user identity, stored in `sessionStorage`.
 *           link:                    'url',   // New link to use (replaces old stored link), stored in `sessionStorage`.
 *           referring_data_parsed:    { },      // Returns the initial referring data for this identity, if exists, as a parsed object.
 *           referring_identity:      '12345'  // Returns the initial referring identity for this identity, if exists.
 *      }
 * );
 * ```
 * ___
 */
/*** +TOC_ITEM #setidentityidentity-callback &.setIdentity()& ^ALL ***/
Apparition.prototype["setIdentity"] = wrap(
  callback_params.CALLBACK_ERR_DATA,
  function (done, identity) {
    var self = this;
    if (identity) {
      var data = {
        identity_id: self.identity_id,
        session_id: self.session_id,
        link: self.sessionLink,
        developer_identity: identity,
      };
      self.identity = identity;
      // store the identity
      session.patch(self._storage, { identity: identity }, true);
      done(null, data);
    } else {
      done(new Error(utils.message(utils.messages.missingIdentity)));
    }
  },
);

/**
 * @function Apparition.logout
 * @param {function(?Error)=} callback - _optional_
 *
 * Logs out the current session, replaces session IDs and identity IDs.
 *
 * ##### Usage
 * ```js
 * Apparition.logout(
 *     callback (err)
 * );
 * ```
 *
 * ##### Callback Format
 * ```js
 * callback(
 *      "Error message"
 * );
 * ```
 * ___
 *
 */
/*** +TOC_ITEM #logoutcallback &.logout()& ^ALL ***/
Apparition.prototype["logout"] = wrap(
  callback_params.CALLBACK_ERR,
  function (done) {
    var self = this;
    var data = {
      identity: null,
    };

    self.identity = null;
    // make sure to update both session and local. removeNull = true deletes, in particular,
    // identity instead of inserting null in storage.
    session.patch(
      self._storage,
      data,
      /* updateLocalStorage */ true,
      /* removeNull */ true,
    );

    done(null);
  },
);

Apparition.prototype["getBrowserFingerprintId"] = wrap(
  callback_params.CALLBACK_ERR_DATA,
  function (done) {
    var permData = session.get(this._storage, true) || {};
    done(null, permData["browser_fingerprint_id"] || null);
  },
);
