/**
 * Just a couple of variables that shouldn't change very often...
 */
goog.provide("config");
/** @define {string} */
var DEFAULT_API_ENDPOINT = "https://apparition.link/api";

//config.app_service_endpoint = "https://app.link/";
config.app_service_endpoint = "https://apparition.link";

config.link_service_endpoint = "https://stpz.link";
config.api_endpoint = DEFAULT_API_ENDPOINT;
// will get overwritten by gha on actual deploy
config.version = "0.0.1";
