"use strict";
goog.provide("banner_css");

goog.require("banner_utils");
goog.require("utils");

banner_css.banner = function (options) {
  return (
    ".apparition-banner-is-active { -webkit-transition: all " +
    (banner_utils.animationSpeed * 1.5) / 1000 +
    "s ease; transition: all 0" +
    (banner_utils.animationSpeed * 1.5) / 1000 +
    "s ease; }\n" +
    "#apparition-banner { width:100%; z-index: 99999; font-family: Helvetica Neue, Sans-serif;" +
    " -webkit-font-smoothing: antialiased; -webkit-user-select: none;" +
    " -moz-user-select: none; user-select: none; -webkit-transition: all " +
    banner_utils.animationSpeed / 1000 +
    "s ease; transition: all 0" +
    banner_utils.animationSpeed / 1000 +
    "s ease; }\n" +
    "#apparition-banner .button{" +
    " border: 1px solid " +
    (options["buttonBorderColor"] ||
      (options["theme"] === "dark" ? "transparent" : "#ccc")) +
    ";" +
    " background: " +
    (options["buttonBackgroundColor"] || "#fff") +
    ";" +
    " color: " +
    (options["buttonFontColor"] || "#000") +
    ";" +
    " cursor: pointer; margin-top: 0px; font-size: 14px;" +
    " display: inline-block; margin-left: 5px; font-weight: 400; text-decoration: none; " +
    " border-radius: 4px; padding: 6px 12px; transition: all .2s ease;" +
    "}\n" +
    "#apparition-banner .button:hover { " +
    " border: 1px solid " +
    (options["buttonBorderColorHover"] ||
      (options["theme"] === "dark" ? "transparent" : "#BABABA")) +
    ";" +
    " background: " +
    (options["buttonBackgroundColorHover"] || "#E0E0E0") +
    ";" +
    " color: " +
    (options["buttonFontColorHover"] || "#000") +
    ";" +
    "}\n" +
    "#apparition-banner .button:focus { outline: none; }\n" +
    "#apparition-banner * { margin-right: 4px; position: relative; line-height: 1.2em; }\n" +
    "#apparition-banner-close { font-weight: 400; cursor: pointer; float: left; z-index: 2;" +
    "padding: 0 5px 0 5px; margin-right: 0; }\n" +
    "#apparition-banner .content { width:100%; overflow: hidden; height: " +
    banner_utils.bannerHeight +
    "; background: rgba(255, 255, 255, 0.95); color: #333; " +
    (options.position === "top" ? "border-bottom" : "border-top") +
    ": 1px solid #ddd; }\n" +
    "#apparition-banner-close { color: #000; font-size: 24px; top: 14px; opacity: .5;" +
    " transition: opacity .3s ease; }\n" +
    "#apparition-banner-close:hover { opacity: 1; }\n" +
    "#apparition-banner .title { font-size: 18px; font-weight:bold; color: #555; }\n" +
    "#apparition-banner .description { font-size: 12px; font-weight: normal; color: #777; max-height: 30px; overflow: hidden; }\n" +
    "#apparition-banner .icon { float: left; padding-bottom: 40px; margin-right: 10px; margin-left: 5px; }\n" +
    "#apparition-banner .icon img { width: 63px; height: 63px; margin-right: 0; }\n" +
    "#apparition-banner .reviews { font-size:13px; margin: 1px 0 3px 0; color: #777; }\n" +
    "#apparition-banner .reviews .star { display:inline-block; position: relative; margin-right:0; }\n" +
    "#apparition-banner .reviews .star span { display: inline-block; margin-right: 0; color: #555;" +
    " position: absolute; top: 0; left: 0; }\n" +
    "#apparition-banner .reviews .review-count { font-size:10px; }\n" +
    "#apparition-banner .reviews .star .half { width: 50%; overflow: hidden; display: block; }\n" +
    "#apparition-banner .content .left { padding: 6px 5px 6px 5px; }\n" +
    "#apparition-banner .vertically-align-middle { top: 50%; transform: translateY(-50%);" +
    " -webkit-transform: translateY(-50%); -ms-transform: translateY(-50%); }\n" +
    "#apparition-banner .details > * { display: block; }\n" +
    "#apparition-banner .content .left { height: 63px; }\n" +
    "#apparition-banner .content .right { float: right; height: 63px; margin-bottom: 50px;" +
    " padding-top: 22px; z-index: 1; }\n" +
    "#apparition-banner .right > div { float: left; }\n" +
    "#apparition-banner-action { top: 17px; }\n" +
    '#apparition-banner .content:after { content: ""; position: absolute; left: 0; right: 0;' +
    " top: 100%; height: 1px; background: rgba(0, 0, 0, 0.2); }\n" +
    "#apparition-banner .theme-dark.content { background: rgba(51, 51, 51, 0.95); }\n" +
    "#apparition-banner .theme-dark #apparition-banner-close{ color: #fff; text-shadow: 0 1px 1px rgba(0, 0, 0, .15); }\n" +
    "#apparition-banner .theme-dark .details { text-shadow: 0 1px 1px rgba(0, 0, 0, .15); }\n" +
    "#apparition-banner .theme-dark .title { color: #fff; }\n" +
    "#apparition-banner .theme-dark .description { color: #fff; }\n" +
    "#apparition-banner .theme-dark .reviews { color: #888; }\n" +
    "#apparition-banner .theme-dark .reviews .star span{ color: #fff; }\n" +
    "#apparition-banner .theme-dark .reviews .review-count{ color: #fff; }\n" +
    ""
  );
};

banner_css.other =
  "#apparition-banner { position: fixed; min-width: 600px; }\n" +
  "#apparition-banner input{" +
  " border: 1px solid #ccc; " +
  " font-weight: 400;  border-radius: 4px; height: 30px;" +
  " padding: 5px 7px 4px; width: 145px; font-size: 14px;" +
  "}\n" +
  "#apparition-banner input:focus { outline: none; }\n" +
  "#apparition-banner input.error { color: rgb(194, 0, 0); border-color: rgb(194, 0, 0); }\n" +
  "#apparition-banner .apparition-icon-wrapper { width:25px; height: 25px; vertical-align: middle;" +
  " display: inline-block; margin-top: -18px; }\n" +
  "@keyframes apparition-spinner { 0% { transform: rotate(0deg);" +
  " -webkit-transform: rotate(0deg); -ms-transform: rotate(0deg); }" +
  " 100% { transform: rotate(360deg); -webkit-transform: rotate(360deg);" +
  " -ms-transform: rotate(360deg); } }\n" +
  "@-webkit-keyframes apparition-spinner { 0% { transform: rotate(0deg);" +
  " -webkit-transform: rotate(0deg); -ms-transform: rotate(0deg); }" +
  " 100% { transform: rotate(360deg); -webkit-transform: rotate(360deg);" +
  " -ms-transform: rotate(360deg); } }\n" +
  "#apparition-spinner { -webkit-animation: apparition-spinner 1s ease-in-out infinite;" +
  " animation: apparition-spinner 1s ease-in-out infinite; transition: all 0.7s ease-in-out;" +
  " border:2px solid #ddd; border-bottom-color:#428bca; width:80%; height:80%;" +
  " border-radius:50%; -webkit-font-smoothing: antialiased !important; }\n" +
  "#apparition-banner .theme-dark input { border-color: transparent; }\n" +
  "";

banner_css.mobile =
  "#apparition-banner { position: absolute; }\n" +
  "#apparition-banner .content .left .details .title { font-size: 12px; }\n" +
  "#apparition-mobile-action { white-space: nowrap; }\n" +
  "#apparition-banner .content .left .details .description { font-size: 11px;" +
  " font-weight: normal; }\n" +
  "@media only screen and (min-device-width: 320px) and (max-device-width: 350px) {" +
  " #apparition-banner .content .right { max-width: 120px; } }\n" +
  "@media only screen and (min-device-width: 351px) and (max-device-width: 400px)" +
  " and (orientation: landscape) { #apparition-banner .content .right { max-width: 150px; } }\n" +
  "@media only screen and (min-device-width: 401px) and (max-device-width: 480px)" +
  " and (orientation: landscape) { #apparition-banner .content .right { max-width: 180px; } }\n";

banner_css.ios = "";

// Styles thanks to https://github.com/asianmack/play-store-smartbanner/blob/master/smartbanner.html
banner_css.android =
  "#apparition-banner #apparition-banner-close," +
  "#apparition-banner .theme-dark #apparition-banner-close { height:17px; width: 17px; text-align: center; font-size: 15px; top: 24px; " +
  " border-radius:14px; border:0; line-height:14px; color:#b1b1b3; background:#efefef; padding: 0; opacity: 1; }\n" +
  "#apparition-banner .button { top: 0; text-decoration:none; border-bottom: 3px solid #A4C639;" +
  " padding: 0 10px; height: 24px; line-height: 24px; text-align: center; color: #fff; margin-top: 2px; " +
  " font-weight: bold; background-color: #A4C639; border-radius: 5px; }\n" +
  "#apparition-banner .button:hover { border-bottom:3px solid #8c9c29; background-color: #c1d739; }\n";

banner_css.blackberry = "";

banner_css.windows_phone = "";

banner_css.kindle = "";

banner_css.iframe =
  "body { -webkit-transition: all " +
  (banner_utils.animationSpeed * 1.5) / 1000 +
  "s ease; transition: all 0" +
  (banner_utils.animationSpeed * 1.5) / 1000 +
  "s ease; }\n" +
  "#apparition-banner-iframe { box-shadow: 0 0 5px rgba(0, 0, 0, .35); width: 1px; min-width:100%;" +
  " left: 0; right: 0; border: 0; height: " +
  banner_utils.bannerHeight +
  "; z-index: 99999; -webkit-transition: all " +
  banner_utils.animationSpeed / 1000 +
  "s ease; transition: all 0" +
  banner_utils.animationSpeed / 1000 +
  "s ease; }\n";

banner_css.inneriframe = "body { margin: 0; }\n";

banner_css.iframe_position = function (sticky, position) {
  return (
    "#apparition-banner-iframe { position: " +
    (position === "top" && !sticky ? "absolute" : "fixed") +
    "; }\n"
  );
};

/**
 * @param {banner_utils.options} options
 * @param {Object} element
 */
banner_css.css = function (options, element) {
  // Construct Banner CSS
  var style = banner_css.banner(options);

  // User agent specific styles
  var userAgent = utils.getPlatformByUserAgent();
  if ((userAgent === "ios" || userAgent === "ipad") && options.showiOS) {
    style += banner_css.mobile + banner_css.ios;
  } else if (userAgent === "android" && options.showAndroid) {
    style += banner_css.mobile + banner_css.android;
  } else if (userAgent === "blackberry" && options.showBlackberry) {
    style += banner_css.mobile + banner_css.blackberry;
  } else if (userAgent === "windows_phone" && options.showWindowsPhone) {
    style += banner_css.mobile + banner_css.windows_phone;
  } else if (userAgent === "kindle" && options.showKindle) {
    style += banner_css.mobile + banner_css.kindle;
  }
  style += options.customCSS;

  if (options.iframe) {
    style += banner_css.inneriframe;

    var iFrameCSS = document.createElement("style");
    iFrameCSS.type = "text/css";
    iFrameCSS.id = "apparition-iframe-css";
    utils.addNonceAttribute(iFrameCSS);
    iFrameCSS.innerHTML =
      banner_css.iframe +
      banner_css.iframe_position(options.mobileSticky, options.position);
    (document.head || document.getElementsByTagName("head")[0]).appendChild(
      iFrameCSS,
    );
  }

  var css = document.createElement("style");
  css.type = "text/css";
  css.id = "apparition-css";
  css.innerHTML = style;
  utils.addNonceAttribute(css);

  var doc = options.iframe ? element.contentWindow.document : document;
  var controlledHead = doc.head || doc.getElementsByTagName("head")[0];
  if (controlledHead && typeof controlledHead.appendChild === "function") {
    controlledHead.appendChild(css);
  }
  if (options.position === "top") {
    element.style.top = "-" + banner_utils.bannerHeight;
  } else if (options.position === "bottom") {
    element.style.bottom = "-" + banner_utils.bannerHeight;
  }
};
