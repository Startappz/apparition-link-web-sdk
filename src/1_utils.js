/**
 * Just provides a couple of utilities.
 */
"use strict";

goog.provide("utils");
/*jshint unused:false*/
goog.require("goog.json");
goog.require("config");
goog.require("safejson");

/* jshint ignore:start */
/** @typedef {string} */
var message;
utils.debug = false;
utils.retries = 2; // Value specifying the number of times that a Apparition API call can be re-attempted.
utils.retry_delay = 200; // Amount of time in milliseconds to wait before re-attempting a timed-out request to the Apparition API.
utils.timeout = 5000; // Duration in milliseconds that the system should wait for a response before considering any Apparition API call to have timed out.
utils.nonce = ""; // Nonce value to allow for CSP whitelisting
utils.extendedJourneysAssistExpiryTime = 604800000; // TTL value in milliseconds for the Referring Link. Defaults to 7 days

// Properties and function related to calculating Apparition request roundtrip time
utils.instrumentation = {};
utils.userAgentData = null;
utils.navigationTimingAPIEnabled =
  typeof window !== "undefined" &&
  !!(
    window.performance &&
    window.performance.timing &&
    window.performance.timing.navigationStart
  );
utils.timeSinceNavigationStart = function () {
  // in milliseconds
  return (Date.now() - window.performance.timing.navigationStart).toString();
};
utils.currentRequestBrttTag = "";
utils.allowDMAParamURLMap = {
  "/v1/open": "",
  "/v1/pageview": "",
  "/v2/event/standard": "user_data",
  "/v2/event/custom": "user_data",
};
utils.calculateBrtt = function (startTime) {
  if (!startTime || typeof startTime !== "number") {
    return null;
  }
  return (Date.now() - startTime).toString();
};

utils.dismissEventToSourceMapping = {
  didClickJourneyClose: "Button(X)",
  didClickJourneyContinue: "Dismiss Journey text",
  didClickJourneyBackgroundDismiss: "Background Dismiss",
  didScrollJourneyBackgroundDismiss: "Background Dismiss",
};

utils.userPreferences = {
  trackingDisabled: false,
  enableExtendedJourneysAssist: false,
  whiteListedEndpointsWithData: {
    "/v1/open": { link_identifier: "\\d+" },
    "/v1/pageview": { event: "pageview" },
    "/v1/dismiss": { event: "dismiss" },
    "/v1/url": {},
  },
  allowErrorsInCallback: false,
  shouldBlockRequest: function (url, requestData) {
    // Used by 3_api.js to determine whether a request should be blocked
    var urlParser = document.createElement("a");
    urlParser.href = url;

    // INTENG-11512
    // To allow SMS when tracking disabled, we must allow GET <actual link>.
    // This precludes a filter on the path. Only apply the whitelist to
    // service endpoints.
    var whiteListDomains = [
      config.api_endpoint,
      config.app_service_endpoint,
      config.link_service_endpoint,
    ];
    var urlOrigin = urlParser.origin; // Property origin is defined on Anchor https://www.w3schools.com/jsref/prop_anchor_origin.asp
    // Excess of caution: Make sure no trailing slash in urlOrigin.
    if (urlOrigin.endsWith("/")) {
      urlOrigin = urlOrigin.substring(0, urlOrigin.length - 1);
    }
    if (!whiteListDomains.includes(urlOrigin)) {
      return false;
    }

    var urlPath = urlParser.pathname;

    // On Internet Explorer .pathname is returned without a leading '/' whereas on other browsers,
    // a leading slash is available eg. v1/open on IE vs. /v1/open in Chrome
    if (urlPath[0] != "/") {
      urlPath = "/" + urlPath;
    }

    var whiteListedEndpointWithData =
      utils.userPreferences.whiteListedEndpointsWithData[urlPath];

    if (!whiteListedEndpointWithData) {
      return true;
    } else if (Object.keys(whiteListedEndpointWithData).length > 0) {
      if (!requestData) {
        return true;
      }
      // Ensures that required request parameters are available in request data
      for (var key in whiteListedEndpointWithData) {
        var requiredParameterRegex = new RegExp(
          whiteListedEndpointWithData[key],
        );
        if (
          !requestData.hasOwnProperty(key) ||
          !requiredParameterRegex.test(requestData[key])
        ) {
          return true;
        }
      }
    }
    return false;
  },
};

utils.generateDynamicBNCLink = function (apparitionKey, data) {
  if (!apparitionKey && !data) {
    return;
  }
  var addKeyAndValueToUrl = function (fallbackUrl, tagName, tagData) {
    var first = fallbackUrl[fallbackUrl.length - 1] === "?";
    var modifiedFallbackURL = first
      ? fallbackUrl + tagName
      : fallbackUrl + "&" + tagName;
    modifiedFallbackURL += "=";
    return modifiedFallbackURL + encodeURIComponent(tagData);
  };

  var fallbackUrl = config.link_service_endpoint + "/a/" + apparitionKey + "?";
  var topLevelKeys = [
    "tags",
    "alias",
    "channel",
    "feature",
    "stage",
    "campaign",
    "type",
    "duration",
    "sdk",
    "source",
    "data",
  ];
  for (var i = 0; i < topLevelKeys.length; i++) {
    var key = topLevelKeys[i];
    var value = data[key];
    if (value) {
      if (key === "tags" && Array.isArray(value)) {
        for (var index = 0; index < value.length; index++) {
          fallbackUrl = addKeyAndValueToUrl(fallbackUrl, key, value[index]);
        }
      } else if (
        (typeof value === "string" && value.length > 0) ||
        typeof value === "number"
      ) {
        if (key === "data" && typeof value === "string") {
          value = utils.base64encode(value);
        }
        fallbackUrl = addKeyAndValueToUrl(fallbackUrl, key, value);
      }
    }
  }
  return fallbackUrl;
};

// Removes PII when a user disables tracking
utils.cleanApplicationAndSessionStorage = function (apparition) {
  if (apparition) {
    // clears PII from global Apparition object
    apparition.device_fingerprint_id = null;
    apparition.sessionLink = null;
    apparition.session_id = null;
    apparition.identity_id = null;
    apparition.identity = null;
    apparition.browser_fingerprint_id = null;

    if (apparition._deepviewCta) {
      delete apparition._deepviewCta;
    }
    if (apparition._deepviewRequestForReplay) {
      delete apparition._deepviewRequestForReplay;
    }
    apparition._storage.remove("apparition_view_enabled");
    var data = {};
    // Sets an empty object for apparition_session and apparition_session_first in local/sessionStorage
    session.set(apparition._storage, data, true);
  }
  // a user will need to explicitly opt out from _s cookie
};

/** @typedef {{data:?string, referring_identity:?string, identity:?string, has_app:?boolean}} */
utils.sessionData;

/** @typedef {string} */
utils._httpMethod;

/** @enum {utils._httpMethod} */
utils.httpMethod = {
  POST: "POST",
  GET: "GET",
};

/** @typedef {{
 * destination: string,
 * endpoint: string,
 * method: utils._httpMethod,
 * params: ?Object.<string, _validator>,
 * queryPart: ?Object.<string, _validator>,
 * jsonp: ?boolean
 * }} */
utils.resource;

/** @typedef {{listener: function(string, Object):null, event: string}} */
utils.listener;

/* jshint ignore:end */

/** @type {Object<string,message>} */
utils.messages = {
  missingParam: "API request $1 missing parameter $2",
  invalidType: "API request $1, parameter $2 is not $3",
  nonInit: "Apparition SDK not initialized",
  initPending:
    "Apparition SDK initialization pending" +
    " and a Apparition method was called outside of the queue order",
  initFailed:
    "Apparition SDK initialization failed, so further methods cannot be called",
  existingInit: "Apparition SDK already initialized",
  missingAppId: "Missing Apparition app ID",
  callApparitionInitFirst: "Apparition.init must be called first",
  timeout: "Request timed out",
  blockedByClient: "Request blocked by client, probably adblock",
  missingUrl: "Required argument: URL, is missing",
  trackingDisabled:
    "Requested operation cannot be completed since tracking is disabled",
  deepviewNotCalled:
    "Cannot call Deepview CTA, please call apparition.deepview() first",
  missingIdentity:
    "setIdentity - required argument identity should have a non-null value",
};

/**
 * List of valid banner themes
 * The first theme in the list becomes the default theme if one is not specified
 */
/** @type {Array<string>} */
utils.bannerThemes = ["light", "dark"];

/*
 * Getters for location.search and location.hash, so that we can stub this for testing
 */
utils.getLocationSearch = function () {
  return utils.isIframeAndFromSameOrigin()
    ? window.top.location.search
    : window.location.search;
};

utils.getLocationHash = function () {
  return utils.isIframeAndFromSameOrigin()
    ? window.top.location.hash
    : window.location.hash;
};

/**
 * @param {message} message
 * @param {Array.<*>=} params
 * @param {number=} failCode
 * @param {string=} failDetails
 * @return {string}
 */
utils.message = function (message, params, failCode, failDetails) {
  var msg = message.replace(/\$(\d)/g, function (_, place) {
    return params[parseInt(place, 10) - 1];
  });
  if (failCode) {
    msg += "\n Failure Code:" + failCode;
  }
  if (failDetails) {
    msg += "\n Failure Details:" + failDetails;
  }
  if (utils.debug && console) {
    console.log(msg);
  }
  return msg;
};

/**
 * @param {Object} data
 * @return {utils.sessionData}
 */
utils.whiteListSessionData = function (data) {
  return {
    data: data["data"] || "",
    data_parsed: data["data_parsed"] || {},
    has_app: utils.getBooleanOrNull(data["has_app"]),
    identity: data["identity"] || null,
    developer_identity: data["identity"] || null,
    referring_identity: data["referring_identity"] || null,
    referring_link: data["referring_link"] || null,
  };
};

/**
 * @param {Object} sessionData
 * @return {Object} retData
 */
utils.whiteListJourneysLanguageData = function (sessionData) {
  var re = /^\$journeys_\S+$/;
  var data = sessionData["data"];
  var retData = {};

  if (!data) {
    return {};
  }

  switch (typeof data) {
    case "string":
      try {
        data = safejson.parse(data);
      } catch (e) {
        data = {};
      }
      break;
    case "object":
      // do nothing:
      break;
    default:
      data = {};
      break;
  }

  Object.keys(data).forEach(function (key) {
    var found = re.test(key);
    if (found) {
      retData[key] = data[key];
    }
  });

  return retData;
};

/**
 * Abstract away the window.location for better testing
 */
utils.getWindowLocation = function () {
  return utils.isIframe() ? document.referrer : String(window.location);
};

/**
 * Find debugging parameters
 */
utils.getParameterByName = function (name) {
  var url;
  var re;
  var match;
  name = name.replace(/[\[\]]/g, "\\$&");
  url = utils.getWindowLocation();
  re = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
  match = re.exec(url);
  if (!match || !match[2]) {
    return "";
  }
  return decodeURIComponent(match[2].replace(/\+/g, " "));
};

utils.cleanLinkData = function (linkData) {
  linkData["source"] = "web-sdk";
  var data = linkData["data"];

  switch (typeof data) {
    case "string":
      try {
        data = safejson.parse(data);
      } catch (e) {
        data = { _bncNoEval: true };
      }
      break;
    case "object":
      // do nothing:
      break;
    default:
      data = {};
      break;
  }

  var hasOGRedirectOrFallback =
    data["$og_redirect"] || data["$fallback_url"] || data["$desktop_url"];

  if (!data["$canonical_url"]) {
    data["$canonical_url"] = utils.getWindowLocation();
  }
  if (!data["$og_title"]) {
    data["$og_title"] = hasOGRedirectOrFallback
      ? null
      : utils.getOpenGraphContent("title");
  }
  if (!data["$og_description"]) {
    data["$og_description"] = hasOGRedirectOrFallback
      ? null
      : utils.getOpenGraphContent("description");
  }
  if (!data["$og_image_url"]) {
    data["$og_image_url"] = hasOGRedirectOrFallback
      ? null
      : utils.getOpenGraphContent("image");
  }
  if (!data["$og_video"]) {
    data["$og_video"] = hasOGRedirectOrFallback
      ? null
      : utils.getOpenGraphContent("video");
  }
  if (!data["$og_type"]) {
    data["$og_type"] = hasOGRedirectOrFallback
      ? null
      : utils.getOpenGraphContent("type");
  }

  if (typeof data["$desktop_url"] === "string") {
    data["$desktop_url"] = data["$desktop_url"]
      .replace(/#r:[a-z0-9-_]+$/i, "")
      .replace(/([\?\&]_apparition_match_id=\d+)/, "");
  }

  try {
    safejson.parse(data);
  } catch (e) {
    data = goog.json.serialize(data);
  }
  linkData["data"] = data;

  return linkData;
};

/**
 * @param {String} link
 */
utils.getClickIdAndSearchStringFromLink = function (link) {
  if (!link || typeof link !== "string") {
    return "";
  }
  var elem = document.createElement("a");
  elem.href = link;
  function notEmpty(data) {
    return data !== "";
  }
  var pathname = elem.pathname && elem.pathname.split("/").filter(notEmpty);
  return Array.isArray(pathname) && pathname.length
    ? pathname[pathname.length - 1] + elem.search
    : elem.search;
};

/**
 * @param {String} link
 */
utils.processReferringLink = function (link) {
  return link
    ? link.substring(0, 4) !== "http"
      ? config.link_service_endpoint + link
      : link
    : null;
};

/**
 * @param {Object} to
 * @param {Object} from
 * @param {boolean=} removeNull delete null or undefined entries instead of inserting
 */
utils.merge = function (to, from, removeNull) {
  if (!to || typeof to !== "object") {
    to = {};
  }
  if (!from || typeof from !== "object") {
    return to;
  }

  for (var attr in from) {
    if (from.hasOwnProperty(attr)) {
      var fromAttr = from[attr];
      /* Only remove null and undefined, not all falsy values. */
      if (removeNull && (fromAttr === undefined || fromAttr === null)) {
        delete to[attr];
      } else {
        to[attr] = fromAttr;
      }
    }
  }
  return to;
};

/**
 * @param {string} key
 */
utils.hashValue = function (key) {
  try {
    var match = utils.getLocationHash().match(new RegExp(key + ":([^&]*)"));
    if (match && match.length >= 1) {
      return match[1];
    }
  } catch (e) {}
};

function isSafariBrowser(ua) {
  return !!/^((?!chrome|android|crios|firefox|fxios|edg|yabrowser).)*safari/i.test(
    ua,
  );
}

function isChromeBrowser(ua) {
  return !!/(chrome|crios)/i.test(ua);
}

function isFirefoxBrowser(ua) {
  return !!/(fxios|firefox)/i.test(ua);
}

function isEdgeBrowser(ua) {
  return !!/edg/i.test(ua);
}

function isOperaBrowser(ua) {
  return !!/(opt|opr)/i.test(ua);
}

function isYandexBrowser(ua) {
  return !!/yabrowser/i.test(ua);
}

function isMacintoshDesktop(ua) {
  return ua && ua.indexOf("Macintosh") > -1;
}

function isGTEVersion(ua, v) {
  v = v || 11;

  var match = /version\/([^ ]*)/i.exec(ua);
  if (match && match[1]) {
    try {
      var version = parseFloat(match[1]);
      if (version >= v) {
        return true;
      }
    } catch (e) {
      return false;
    }
  }
  return false;
}

function isSafari13OrGreateriPad(ua) {
  return (
    ua &&
    isSafariBrowser(ua) &&
    isMacintoshDesktop(ua) &&
    isGTEVersion(ua, 13) &&
    screen.height > screen.width
  );
}

function isIOS(ua) {
  return ua && /(iPad|iPod|iPhone)/.test(ua);
}

utils.getPlatformByUserAgent = function () {
  var ua = navigator.userAgent;
  if (ua.match(/android/i)) {
    return "android";
  }
  if (ua.match(/ipad/i) || isSafari13OrGreateriPad(ua)) {
    return "ipad";
  }
  if (ua.match(/i(os|p(hone|od))/i)) {
    return "ios";
  }
  if (ua.match(/\(BB[1-9][0-9]*\;/i)) {
    return "blackberry";
  }
  if (ua.match(/Windows Phone/i)) {
    return "windows_phone";
  }
  if (
    ua.match(/Kindle/i) ||
    ua.match(/Silk/i) ||
    ua.match(/KFTT/i) ||
    ua.match(/KFOT/i) ||
    ua.match(/KFJWA/i) ||
    ua.match(/KFJWI/i) ||
    ua.match(/KFSOWI/i) ||
    ua.match(/KFTHWA/i) ||
    ua.match(/KFTHWI/i) ||
    ua.match(/KFAPWA/i) ||
    ua.match(/KFAPWI/i)
  ) {
    return "kindle";
  }
  if (ua.match(/(Windows|Macintosh|Linux)/i)) {
    return "desktop";
  }
  return "other";
};

/**
 * Returns true if browser is safari version 11 or greater
 * @return {boolean}
 */
utils.isSafari11OrGreater = function () {
  var ua = navigator.userAgent;
  var isSafari = isSafariBrowser(ua);

  if (isSafari) {
    return isGTEVersion(ua, 11);
  }

  return false;
};

/**
 * Returns true if browser uses WebKit.
 * @return {boolean}
 */
utils.isWebKitBrowser = function () {
  return !!window.webkitURL;
};

utils.isIOSWKWebView = function () {
  var ua = navigator.userAgent;
  return (
    utils.isWebKitBrowser() &&
    ua &&
    isIOS(ua) &&
    !isChromeBrowser(ua) &&
    !isFirefoxBrowser(ua) &&
    !isEdgeBrowser(ua) &&
    !isOperaBrowser(ua) &&
    !isYandexBrowser(ua)
  );
};

/**
 * @param {string} key
 */
utils.getParamValue = function (key) {
  try {
    var match = utils
      .getLocationSearch()
      .substring(1)
      .match(new RegExp(key + "=([^&]*)"));
    if (match && match.length >= 1) {
      return match[1];
    }
  } catch (e) {}
};

/**
 * @param {string} key_or_id
 */
utils.isKey = function (key_or_id) {
  return key_or_id.indexOf("key_") > -1;
};

/**
 * @param {string} string
 */
utils.snakeToCamel = function (string) {
  var find = /(\-\w)/g;
  var convert = function (matches) {
    return matches[1].toUpperCase();
  };
  return string.replace(find, convert);
};

/**
 * Base64 encoding because ie9 does not have bota()
 *
 * @param {string} input
 */
utils.base64encode = function (input) {
  var utf8_encode = function (string) {
    string = string.replace(/\r\n/g, "\n");
    var utftext = "";
    for (var n = 0; n < string.length; n++) {
      var c = string.charCodeAt(n);
      if (c < 128) {
        utftext += String.fromCharCode(c);
      } else if (c > 127 && c < 2048) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      } else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }
    }
    return utftext;
  };

  var keyStr =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

  var output = "";
  var chr1;
  var chr2;
  var chr3;
  var enc1;
  var enc2;
  var enc3;
  var enc4;
  var i = 0;
  input = utf8_encode(input);

  while (i < input.length) {
    chr1 = input.charCodeAt(i++);
    chr2 = input.charCodeAt(i++);
    chr3 = input.charCodeAt(i++);
    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = chr3 & 63;
    if (isNaN(chr2)) {
      enc3 = 64;
      enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }
    output =
      output +
      keyStr.charAt(enc1) +
      keyStr.charAt(enc2) +
      keyStr.charAt(enc3) +
      keyStr.charAt(enc4);
  }
  return output;
};

/**
 * Decode Base64 if the string is encoded
 * @param {string} str
 */
utils.base64Decode = function (str) {
  if (utils.isBase64Encoded(str)) {
    return atob(str);
  }
  return str;
};

/**
 * Check if a String is a BASE64 encoded value
 * @param {string} str
 */
utils.isBase64Encoded = function (str) {
  if (typeof str !== "string") {
    return false;
  }
  if (str === "" || str.trim() === "") {
    return false;
  }
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
};

/**
 * Encodes BFP in data object with Base64 encoding.
 * BFP is supposed to be Base64 encoded when stored in local storage/cookie.
 * @param {Object} data
 */
utils.encodeBFPs = function (data) {
  if (
    data &&
    data["browser_fingerprint_id"] &&
    !utils.isBase64Encoded(data["browser_fingerprint_id"])
  ) {
    data["browser_fingerprint_id"] = btoa(data["browser_fingerprint_id"]);
  }
  if (
    data &&
    data["alternative_browser_fingerprint_id"] &&
    !utils.isBase64Encoded(data["alternative_browser_fingerprint_id"])
  ) {
    data["alternative_browser_fingerprint_id"] = btoa(
      data["alternative_browser_fingerprint_id"],
    );
  }
  return data;
};

/**
 * Decodes BFPs in data object from Base64 encoding.
 * BFP is supposed to be Base64 encoded when stored in local storage/cookie.
 * @param {Object} data
 */
utils.decodeBFPs = function (data) {
  if (data && utils.isBase64Encoded(data["browser_fingerprint_id"])) {
    data["browser_fingerprint_id"] = atob(data["browser_fingerprint_id"]);
  }
  if (
    data &&
    utils.isBase64Encoded(data["alternative_browser_fingerprint_id"])
  ) {
    data["alternative_browser_fingerprint_id"] = atob(
      data["alternative_browser_fingerprint_id"],
    );
  }
  return data;
};

/**
 * Add event listeners to elements, taking older browsers into account
 * @param {Element} el
 * @param {string} eventType
 * @param {Function} callback
 * @param {boolean=} useCapture
 */
utils.addEvent = function (el, eventType, callback, useCapture) {
  var ret = 0;

  if (typeof el["addEventListener"] === "function") {
    ret = el["addEventListener"](eventType, callback, useCapture);
  } else if (typeof el["attachEvent"] === "function") {
    ret = el["attachEvent"]("on" + eventType, callback);
  } else {
    el["on" + eventType] = callback;
  }

  return ret;
};

/**
 * Extract the path (the part of the url excluding protocol and domain name) from urls in the forms
 * of:
 * - "protocol://domain.name/some/path
 * - "domain.name/some/path"
 *
 * and returns (for the above sample input cases):
 * - "some/path"
 *
 * @param {string} url
 */
utils.extractDeeplinkPath = function (url) {
  if (!url) {
    return null;
  }
  if (url.indexOf("://") > -1) {
    url = url.split("://")[1];
  }
  return url.substring(url.indexOf("/") + 1);
};

/**
 * Extract the path (the part of the url excluding protocol and domain name) from urls in the forms
 * of:
 * - "AppName://some/path
 * - some/path
 * - /some/path
 *
 * and returns (for the above sample input cases):
 * - "some/path"
 *
 * @param {string} url
 */
utils.extractMobileDeeplinkPath = function (url) {
  if (!url) {
    return null;
  }
  if (url.indexOf("://") > -1) {
    url = url.split("://")[1];
  } else if (url.charAt(0) === "/") {
    url = url.slice(1);
  }
  return url;
};

/**
 * Search for a particular og tag by name, and return the content, if it exists. The optional
 * parameter 'content' will be the default value used if the og tag is not found or cannot
 * be parsed.
 * @param {string} property
 * @param {null|string=} content
 */
utils.getOpenGraphContent = function (property, content) {
  property = String(property);
  content = content || null;

  var el = document.querySelector('meta[property="og:' + property + '"]');
  if (el && el.content) {
    content = el.content;
  }

  return content;
};

/**
 * Used by utils.processHostedDeepLinkData() to prioritize deeplink paths found from various sources.
 * Returned params may include $ios_deeplink_path, $android_deeplink_path and $deeplink_path.
 */
utils.prioritizeDeeplinkPaths = function (params, deeplinkPaths) {
  if (
    !deeplinkPaths ||
    typeof deeplinkPaths !== "object" ||
    Object.keys(deeplinkPaths || {}).length === 0
  ) {
    return params;
  }

  if (deeplinkPaths["hostedIOS"]) {
    params["$ios_deeplink_path"] = deeplinkPaths["hostedIOS"];
  } else if (deeplinkPaths["applinksIOS"]) {
    params["$ios_deeplink_path"] = deeplinkPaths["applinksIOS"];
  } else if (deeplinkPaths["twitterIOS"]) {
    params["$ios_deeplink_path"] = deeplinkPaths["twitterIOS"];
  }

  if (deeplinkPaths["hostedAndroid"]) {
    params["$android_deeplink_path"] = deeplinkPaths["hostedAndroid"];
  } else if (deeplinkPaths["applinksAndroid"]) {
    params["$android_deeplink_path"] = deeplinkPaths["applinksAndroid"];
  } else if (deeplinkPaths["twitterAndroid"]) {
    params["$android_deeplink_path"] = deeplinkPaths["twitterAndroid"];
  }

  // If $ios_deeplink_path and $android_deeplink_path are the same, set a $deeplink_path as well
  if (
    params.hasOwnProperty("$ios_deeplink_path") &&
    params.hasOwnProperty("$android_deeplink_path") &&
    params["$ios_deeplink_path"] === params["$android_deeplink_path"]
  ) {
    params["$deeplink_path"] = params["$ios_deeplink_path"];
  }
  return params;
};
/**
 * Used by utils.getHostedDeepLinkData() to process page metadata.
 */
utils.processHostedDeepLinkData = function (metadata) {
  var params = {};
  if (!metadata || metadata.length === 0) {
    return params;
  }
  var deeplinkPaths = {
    // keeps track of deeplink paths encountered when parsing page's meta tags
    hostedIOS: null,
    hostedAndroid: null,
    applinksIOS: null,
    applinksAndroid: null,
    twitterIOS: null,
    twitterAndroid: null,
  };

  for (var i = 0; i < metadata.length; i++) {
    if (
      (!metadata[i].getAttribute("name") &&
        !metadata[i].getAttribute("property")) ||
      !metadata[i].getAttribute("content")
    ) {
      continue;
    }

    var name = metadata[i].getAttribute("name");
    var property = metadata[i].getAttribute("property");
    // name takes precedence over property
    var nameOrProperty = name || property;

    var split = nameOrProperty.split(":");

    if (
      split.length === 3 &&
      split[0] === "apparition" &&
      split[1] === "deeplink"
    ) {
      if (split[2] === "$ios_deeplink_path") {
        // Deeplink path detected from hosted deep link data
        deeplinkPaths["hostedIOS"] = utils.extractMobileDeeplinkPath(
          metadata[i].getAttribute("content"),
        );
      } else if (split[2] === "$android_deeplink_path") {
        deeplinkPaths["hostedAndroid"] = utils.extractMobileDeeplinkPath(
          metadata[i].getAttribute("content"),
        );
      } else {
        // Add all other hosted deeplink data key/values to params without needing special treatment
        params[split[2]] = metadata[i].getAttribute("content");
      }
    }
    if (nameOrProperty === "al:ios:url") {
      // Deeplink path detected from App Links meta tag
      deeplinkPaths["applinksIOS"] = utils.extractMobileDeeplinkPath(
        metadata[i].getAttribute("content"),
      );
    }
    if (nameOrProperty === "twitter:app:url:iphone") {
      // Deeplink path detected from Twitter meta tag
      deeplinkPaths["twitterIOS"] = utils.extractMobileDeeplinkPath(
        metadata[i].getAttribute("content"),
      );
    }
    if (nameOrProperty === "al:android:url") {
      deeplinkPaths["applinksAndroid"] = utils.extractMobileDeeplinkPath(
        metadata[i].getAttribute("content"),
      );
    }
    if (nameOrProperty === "twitter:app:url:googleplay") {
      deeplinkPaths["twitterAndroid"] = utils.extractMobileDeeplinkPath(
        metadata[i].getAttribute("content"),
      );
    }
  }
  return utils.prioritizeDeeplinkPaths(params, deeplinkPaths);
};

/**
 * Search for hosted deep link data on the page, as outlined here @TODO
 * Also searches for twitter and applinks tags, i.e. <meta property="al:ios:url" content="applinks://docs" />, <meta name="twitter:app:url:googleplay" content="twitter://docs">.
 */
utils.getHostedDeepLinkData = function () {
  var metadata = document.getElementsByTagName("meta");
  return utils.processHostedDeepLinkData(metadata);
};

/**
 * Returns the user's preferred language
 */
utils.getBrowserLanguageCode = function () {
  var code;
  try {
    if (navigator.languages && navigator.languages.length > 0) {
      code = navigator.languages[0];
    } else if (navigator.language) {
      code = navigator.language;
    }
    code = code.substring(0, 2).toUpperCase();
  } catch (e) {
    code = null;
  }
  return code;
};

/**
 * Returns an array which contains the difference in elements between the 'original' and 'toCheck' arrays.
 * If there is no difference, an empty array will be returned.
 */
utils.calculateDiffBetweenArrays = function (original, toCheck) {
  var diff = [];
  toCheck.forEach(function (element) {
    if (original.indexOf(element) === -1) {
      diff.push(element);
    }
  });
  return diff;
};

var validCommerceEvents = ["purchase"];

var commerceEventMessages = {
  missingPurchaseEvent:
    "event name is either missing, of the wrong type or not valid. Please specify 'purchase' as the event name.",
  missingCommerceData:
    "commerce_data is either missing, of the wrong type or empty. Please ensure that commerce_data is constructed correctly.",
  invalidKeysForRoot:
    "Please remove the following keys from the root of commerce_data: ",
  invalidKeysForProducts:
    "Please remove the following keys from commerce_data.products: ",
  invalidProductListType: "commerce_data.products must be an array of objects",
  invalidProductType: "Each product in the products list must be an object",
};

/**
 * Validates the commerce-data object passed into apparition.trackCommerceEvent().
 * If there are invalid keys present then it will report back what those keys are.
 * Note: The keys below are optional.
 */
var validateCommerceDataKeys = function (commerceData) {
  var allowedInRoot = [
    "common",
    "type",
    "transaction_id",
    "currency",
    "revenue",
    "revenue_in_usd",
    "exchange_rate",
    "shipping",
    "tax",
    "coupon",
    "affiliation",
    "persona",
    "products",
  ];
  var allowedInProducts = [
    "sku",
    "name",
    "price",
    "quantity",
    "brand",
    "category",
    "variant",
  ];

  var invalidKeysInRoot = utils.calculateDiffBetweenArrays(
    allowedInRoot,
    Object.keys(commerceData),
  );
  if (invalidKeysInRoot.length) {
    return (
      commerceEventMessages["invalidKeysForRoot"] + invalidKeysInRoot.join(", ")
    );
  }

  var invalidKeysForProducts = [];
  var invalidProductType;
  if (commerceData.hasOwnProperty("products")) {
    // make sure products is an array
    if (!Array.isArray(commerceData["products"])) {
      return commerceEventMessages["invalidProductListType"];
    }
    commerceData["products"].forEach(function (product) {
      // all product entries must be objects
      if (typeof product !== "object") {
        invalidProductType = commerceEventMessages["invalidProductType"];
      }
      invalidKeysForProducts = invalidKeysForProducts.concat(
        utils.calculateDiffBetweenArrays(
          allowedInProducts,
          Object.keys(product),
        ),
      );
    });

    if (invalidProductType) {
      return invalidProductType;
    }

    if (invalidKeysForProducts.length) {
      return (
        commerceEventMessages["invalidKeysForProducts"] +
        invalidKeysForProducts.join(", ")
      );
    }
  }

  return null;
};

/**
 * Returns an error message if the partner passes in an invalid event or commerce_data to apparition.trackCommerceEvent()
 */
utils.validateCommerceEventParams = function (event, commerce_data) {
  if (
    !event ||
    typeof event !== "string" ||
    validCommerceEvents.indexOf(event.toLowerCase()) === -1
  ) {
    return commerceEventMessages["missingPurchaseEvent"];
  }

  if (
    !commerce_data ||
    typeof commerce_data !== "object" ||
    Object.keys(commerce_data || {}).length === 0
  ) {
    return commerceEventMessages["missingCommerceData"];
  }

  var invalidKeysMessage = validateCommerceDataKeys(commerce_data);
  if (invalidKeysMessage) {
    return invalidKeysMessage;
  }

  return null;
};

utils.cleanBannerText = function (string) {
  if (typeof string !== "string") {
    return null;
  }

  return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
};

utils.getTitle = function () {
  var tags = document.getElementsByTagName("title");
  return tags.length > 0 ? tags[0].innerText : null;
};

utils.getDescription = function () {
  var el = document.querySelector('meta[name="description"]');
  return el && el.content ? el.content : null;
};

utils.getCanonicalURL = function () {
  var el = document.querySelector('link[rel="canonical"]');
  return el && el.href ? el.href : null;
};

utils.addPropertyIfNotNull = function (obj, key, value) {
  if (value !== null && value !== undefined) {
    if (typeof value === "object" && Object.keys(value || {}).length === 0) {
      return obj;
    }
    obj[key] = value;
  }
  return obj;
};

utils.openGraphDataAsObject = function () {
  var ogData = {};
  ogData = utils.addPropertyIfNotNull(
    ogData,
    "$og_title",
    utils.getOpenGraphContent("title"),
  );
  ogData = utils.addPropertyIfNotNull(
    ogData,
    "$og_description",
    utils.getOpenGraphContent("description"),
  );
  ogData = utils.addPropertyIfNotNull(
    ogData,
    "$og_image_url",
    utils.getOpenGraphContent("image"),
  );
  ogData = utils.addPropertyIfNotNull(
    ogData,
    "$og_video",
    utils.getOpenGraphContent("video"),
  );
  ogData = utils.addPropertyIfNotNull(
    ogData,
    "$og_type",
    utils.getOpenGraphContent("type"),
  );
  return ogData && Object.keys(ogData).length > 0 ? ogData : null;
};

utils.getAdditionalMetadata = function () {
  var metadata = {};
  metadata = utils.addPropertyIfNotNull(
    metadata,
    "og_data",
    utils.openGraphDataAsObject(),
  );
  metadata = utils.addPropertyIfNotNull(
    metadata,
    "hosted_deeplink_data",
    utils.getHostedDeepLinkData(),
  );
  metadata = utils.addPropertyIfNotNull(metadata, "title", utils.getTitle());
  metadata = utils.addPropertyIfNotNull(
    metadata,
    "description",
    utils.getDescription(),
  );
  metadata = utils.addPropertyIfNotNull(
    metadata,
    "canonical_url",
    utils.getCanonicalURL(),
  );
  return metadata && Object.keys(metadata).length > 0 ? metadata : {};
};

utils.removePropertiesFromObject = function (objectToModify, keysToRemove) {
  if (
    objectToModify &&
    typeof objectToModify === "object" &&
    !Array.isArray(objectToModify) &&
    Object.keys(objectToModify).length > 0 &&
    keysToRemove &&
    Array.isArray(keysToRemove) &&
    keysToRemove.length > 0
  ) {
    for (var key in objectToModify) {
      if (
        objectToModify.hasOwnProperty(key) &&
        keysToRemove.indexOf(key) > -1
      ) {
        delete objectToModify[key];
      }
    }
  }
};

// v2/event utility functions

var APPARITION_STANDARD_EVENTS = [
  "ADD_TO_CART",
  "ADD_TO_WISHLIST",
  "VIEW_CART",
  "INITIATE_PURCHASE",
  "ADD_PAYMENT_INFO",
  "PURCHASE",
  "SPEND_CREDITS",
  "SEARCH",
  "VIEW_ITEM",
  "VIEW_ITEMS",
  "RATE",
  "SHARE",
  "COMPLETE_REGISTRATION",
  "COMPLETE_TUTORIAL",
  "ACHIEVE_LEVEL",
  "UNLOCK_ACHIEVEMENT",
  "LOGIN",
  "SUBSCRIBE",
  "START_TRIAL",
  "INVITE",
  "RESERVE",
  "VIEW_AD",
  "CLICK_AD",
  "INITIATE_STREAM",
  "COMPLETE_STREAM",
];
var APPARITION_STANDARD_EVENT_DATA = [
  "transaction_id",
  "revenue",
  "currency",
  "shipping",
  "tax",
  "coupon",
  "affiliation",
  "search_query",
  "description",
];

utils.isStandardEvent = function (eventName) {
  return eventName && APPARITION_STANDARD_EVENTS.indexOf(eventName) > -1;
};

utils.separateEventAndCustomData = function (eventAndCustomData) {
  if (!eventAndCustomData || Object.keys(eventAndCustomData).length === 0) {
    return null;
  }
  var customDataKeys = utils.calculateDiffBetweenArrays(
    APPARITION_STANDARD_EVENT_DATA,
    Object.keys(eventAndCustomData),
  );
  var customData = {};

  for (var i = 0; i < customDataKeys.length; i++) {
    var key = customDataKeys[i];
    customData[key] = eventAndCustomData[key];
    delete eventAndCustomData[key];
  }
  return {
    custom_data: utils.convertObjectValuesToString(customData),
    event_data: eventAndCustomData,
  };
};

utils.validateParameterType = function (parameter, type) {
  if (!type || (parameter === null && type === "object")) {
    return false;
  }
  if (type === "array") {
    return Array.isArray(parameter);
  }
  return typeof parameter === type && !Array.isArray(parameter);
};

utils.getScreenHeight = function () {
  return screen.height || 0;
};

utils.getScreenWidth = function () {
  return screen.width || 0;
};

// Used by logEvent() to send fields related to user's visit and device to v2/event standard and custom
// Requires a reference to the apparition object to access information such as browser_fingerprint_id
utils.getUserData = function (apparition) {
  var user_data = {};
  user_data = utils.addPropertyIfNotNull(
    user_data,
    "http_origin",
    document.URL,
  );
  user_data = utils.addPropertyIfNotNull(
    user_data,
    "user_agent",
    navigator.userAgent,
  );
  user_data = utils.addPropertyIfNotNull(
    user_data,
    "language",
    utils.getBrowserLanguageCode(),
  );
  user_data = utils.addPropertyIfNotNull(
    user_data,
    "screen_width",
    utils.getScreenWidth(),
  );
  user_data = utils.addPropertyIfNotNull(
    user_data,
    "screen_height",
    utils.getScreenHeight(),
  );
  user_data = utils.addPropertyIfNotNull(
    user_data,
    "http_referrer",
    document.referrer,
  );
  user_data = utils.addPropertyIfNotNull(
    user_data,
    "browser_fingerprint_id",
    apparition.browser_fingerprint_id,
  );
  user_data = utils.addPropertyIfNotNull(
    user_data,
    "developer_identity",
    apparition.identity,
  );
  user_data = utils.addPropertyIfNotNull(
    user_data,
    "identity",
    apparition.identity,
  );
  user_data = utils.addPropertyIfNotNull(user_data, "sdk", "web");
  user_data = utils.addPropertyIfNotNull(
    user_data,
    "sdk_version",
    config.version,
  );
  user_data = utils.addPropertyIfNotNullorEmpty(
    user_data,
    "model",
    utils.userAgentData ? utils.userAgentData.model : "",
  );
  user_data = utils.addPropertyIfNotNullorEmpty(
    user_data,
    "os_version",
    utils.userAgentData ? utils.userAgentData.platformVersion : "",
  );
  return user_data;
};

// Checks if page is in an iFrame
utils.isIframe = function () {
  return window.self !== window.top;
};

// Checks if page is on the same domain as its top most window
// Will throw a cross-origin frame access error if it is not
utils.isSameOriginFrame = function () {
  var sameOriginTest = "true"; // without this minification of function doesn't work correctly
  try {
    if (window.top.location.search) {
      sameOriginTest = "true"; // without this minification of function doesn't work correctly
    }
  } catch (err) {
    return false;
  }
  return sameOriginTest === "true"; // without this minification of function doesn't work correctly
};

// Checks if page is in an iFrame and on the same domain as its top most window
utils.isIframeAndFromSameOrigin = function () {
  return utils.isIframe() && utils.isSameOriginFrame();
};

utils.getInitialReferrer = function (referringLink) {
  if (referringLink) {
    return referringLink;
  }
  if (utils.isIframe()) {
    return utils.isSameOriginFrame() ? window.top.document.referrer : "";
  }
  return document.referrer;
};

utils.getCurrentUrl = function () {
  return utils.isIframeAndFromSameOrigin()
    ? window.top.location.href
    : window.location.href;
};

utils.convertValueToString = function (value) {
  if (utils.validateParameterType(value, "object")) {
    return safejson.stringify(value);
  }
  if (utils.validateParameterType(value, "array")) {
    return safejson.stringify(value);
  }
  if (value === null) {
    return "null";
  }
  return value.toString();
};

// Required for logEvent()'s custom_data object - values must be converted to string
utils.convertObjectValuesToString = function (objectToConvert) {
  if (
    !utils.validateParameterType(objectToConvert, "object") ||
    Object.keys(objectToConvert).length === 0
  ) {
    return {};
  }
  for (var key in objectToConvert) {
    if (objectToConvert.hasOwnProperty(key)) {
      objectToConvert[key] = utils.convertValueToString(objectToConvert[key]);
    }
  }
  return objectToConvert;
};

// Merges user supplied metadata to hosted deep link data for additional Journeys user targeting
utils.mergeHostedDeeplinkData = function (hostedDeepLinkData, metadata) {
  var hostedDeepLinkDataClone = hostedDeepLinkData
    ? utils.merge({}, hostedDeepLinkData)
    : {};
  if (metadata && Object.keys(metadata).length > 0) {
    return Object.keys(hostedDeepLinkDataClone).length > 0
      ? utils.merge(hostedDeepLinkDataClone, metadata)
      : utils.merge({}, metadata);
  }
  return hostedDeepLinkDataClone;
};

// Creates a nonce attribute with the value stored in utils.nonce
utils.addNonceAttribute = function (element) {
  if (utils.nonce !== "") {
    element.setAttribute("nonce", utils.nonce);
  }
};

utils.getBooleanOrNull = function (value) {
  if (value === undefined) {
    return null;
  }

  return value;
};

/**
 * Execute operation immediately or after a timeout.
 * setTimeout(operation, 0) will enqueue the operation and may not execute
 * right away.
 * @param {function()} operation A function with no arguments to be executed after delay ms.
 * @param {number} delay Operation will be executed after this number of ms. If 0, the operation is executed immediately, not using setTimeout.
 */
utils.delay = function (operation, delay) {
  if (isNaN(delay) || delay <= 0) {
    operation();
    return;
  }

  setTimeout(operation, delay);
};

/**
 * gets client hints for supported browsers.
 * This will be used for browsers that have reduced user agent
 */
utils.getClientHints = function () {
  if (navigator.userAgentData) {
    var hints = ["model", "platformVersion"];
    navigator.userAgentData.getHighEntropyValues(hints).then(function (data) {
      utils.userAgentData = {
        model: data.model,
        platformVersion: utils.removeTrailingDotZeros(data.platformVersion),
      };
    });
  } else {
    utils.userAgentData = null;
  }
};

/**
 * @param {Object} obj
 * @param {string} key
 * @param {string} value
 * A utility function to add a property to an object only if its value is not null, empty
 */
utils.addPropertyIfNotNullorEmpty = function (obj, key, value) {
  if (typeof value === "string" && !!value) {
    obj[key] = value;
  }
  return obj;
};

/**
 * @param {String} versionNumber
 * A utility function to remove trailing dot zeroes
 */
utils.removeTrailingDotZeros = function (versionNumber) {
  if (!!versionNumber) {
    var dotZeroRegex = /^([1-9]\d*)\.(0\d*)(\.[0]\d*){1,}$/;

    if (versionNumber.indexOf(".") !== -1) {
      var dotString = versionNumber.substring(0, versionNumber.indexOf("."));
      versionNumber = versionNumber.replace(dotZeroRegex, dotString);
    }
  }
  return versionNumber;
};

utils.shouldAddDMAParams = function (endPointURL) {
  return utils.allowDMAParamURLMap.hasOwnProperty(endPointURL);
};

utils.setDMAParams = function (data, dmaObj = {}, endPoint) {
  const v1_DMAEndPoints = ["/v1/open", "/v1/pageview"];
  const v2_DMAEndPoints = ["/v2/event/standard", "/v2/event/custom"];
  const dmaParams = {};
  dmaParams["dma_eea"] = dmaObj["eeaRegion"];
  dmaParams["dma_ad_personalization"] = dmaObj["adPersonalizationConsent"];
  dmaParams["dma_ad_user_data"] = dmaObj["adUserDataUsageConsent"];
  if (v1_DMAEndPoints.includes(endPoint)) {
    Object.assign(data, dmaParams);
  } else if (v2_DMAEndPoints.includes(endPoint)) {
    try {
      let user_data;
      if (!data["user_data"]) {
        user_data = {};
      } else {
        user_data = JSON.parse(data["user_data"]);
      }
      Object.assign(user_data, dmaParams);
      data["user_data"] = JSON.stringify(user_data);
    } catch (error) {
      console.error(
        `setDMAParams:: ${data["user_data"]} is not a valid JSON string`,
      );
    }
  }
};

/**
 * @param {?} value
 * Check if given value is boolean or not
 */
utils.isBoolean = function (value) {
  return value === true || value === false;
};

/**
 * @param {String} url
 * @TODO A utility function to validate url
 */
utils.isValidURL = function (url) {
  // if (!url || url.trim() === "") {
  //   return false;
  // }
  // var urlPattern = new RegExp(
  //   "^(https?)://((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|((\\d{1,3}\\.){3}\\d{1,3}))(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*(\\?[;&a-z\\d%_.~+=-]*)?(\\#[-a-z\\d_]*)?$",
  //   "i",
  // );
  // return urlPattern.test(url);

  return true;
};
