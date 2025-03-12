/**
 * This provides the markup, styles, and helper functions for all Banner UI Elements
 */
"use strict";
goog.provide("banner");

goog.require("utils");
goog.require("banner_utils");
goog.require("banner_css");
goog.require("banner_html");

/**
 * @param {Object} apparition
 * @param {banner_utils.options} options
 * @param {Object} linkData
 * @param {storage} storage
 */
banner = function (apparition, options, linkData, storage) {
  if (!banner_utils.shouldAppend(storage, options)) {
    apparition._publishEvent("willNotShowBanner");
    return null;
  }

  apparition._publishEvent("willShowBanner");

  var element;
  var bodyMarginTopInline = document.body.style.marginTop;
  var bodyMarginBottomInline = document.body.style.marginBottom;

  var closeBanner = function (closeOptions, callback) {
    if (typeof closeOptions === "function") {
      callback = closeOptions;
      closeOptions = {};
    }
    closeOptions = closeOptions || {};

    if (options.position === "top") {
      element.style.top = "-" + banner_utils.bannerHeight;
    } else if (options.position === "bottom") {
      element.style.bottom = "-" + banner_utils.bannerHeight;
    }

    if (typeof options.forgetHide === "number") {
      storage.set("hideBanner", banner_utils.getDate(options.forgetHide), true);
    } else {
      storage.set("hideBanner", true, true);
    }

    if (closeOptions.immediate) {
      if (options.position === "top") {
        document.body.style.marginTop = bodyMarginTopInline;
      } else if (options.position === "bottom") {
        document.body.style.marginBottom = bodyMarginBottomInline;
      }
      banner_utils.removeClass(document.body, "apparition-banner-is-active");
      banner_utils.removeElement(element);
      banner_utils.removeElement(document.getElementById("apparition-css"));
      callback();
    } else {
      setTimeout(function () {
        banner_utils.removeElement(element);
        banner_utils.removeElement(document.getElementById("apparition-css"));
        callback();
      }, banner_utils.animationSpeed + banner_utils.animationDelay);

      setTimeout(function () {
        if (options.position === "top") {
          document.body.style.marginTop = bodyMarginTopInline;
        } else if (options.position === "bottom") {
          document.body.style.marginBottom = bodyMarginBottomInline;
        }
        banner_utils.removeClass(document.body, "apparition-banner-is-active");
      }, banner_utils.animationDelay);
    }
  };

  var finalHookupsCallback = function (markup) {
    element = markup;
    // Add CSS
    banner_css.css(options, element);
    // Attach actions
    linkData["channel"] = linkData["channel"] || "app banner";

    var doc = options.iframe ? element.contentWindow.document : document;
    var platform = utils.getPlatformByUserAgent();
    if (!["other", "desktop"].includes(platform)) {
      options["open_app"] = options.open_app;
      options["append_deeplink_path"] = options.append_deeplink_path;
      options["make_new_link"] = options.make_new_link;
      options["deepview_type"] = "banner";
      apparition["deepview"](linkData, options);
      var cta = doc.getElementById("apparition-mobile-action");
      if (cta) {
        cta.onclick = function (ev) {
          ev.preventDefault();
          apparition["deepviewCta"]();
        };
      }
    }

    var bodyMarginTopComputed = banner_utils.getBodyStyle("margin-top");
    var bodyMarginBottomComputed = banner_utils.getBodyStyle("margin-bottom");

    // Trigger animation
    banner_utils.addClass(document.body, "apparition-banner-is-active");
    if (options.position === "top") {
      document.body.style.marginTop = banner_utils.addCSSLengths(
        banner_utils.bannerHeight,
        bodyMarginTopComputed,
      );
    } else if (options.position === "bottom") {
      document.body.style.marginBottom = banner_utils.addCSSLengths(
        banner_utils.bannerHeight,
        bodyMarginBottomComputed,
      );
    }

    var closeButton = doc.getElementById("apparition-banner-close");

    if (closeButton) {
      closeButton.onclick = function (ev) {
        ev.preventDefault();
        apparition._publishEvent("willCloseBanner");
        closeBanner({}, function () {
          apparition._publishEvent("didCloseBanner");
        });
      };
    }

    var modalBackground = doc.getElementById(
      "apparition-banner-modal-background",
    );

    if (modalBackground) {
      modalBackground.onclick = function (ev) {
        ev.preventDefault();
        apparition._publishEvent("willCloseBanner");
        closeBanner({}, function () {
          apparition._publishEvent("didCloseBanner");
        });
      };
    }

    function onAnimationEnd() {
      if (options.position === "top") {
        element.style.top = "0";
      } else if (options.position === "bottom") {
        element.style.bottom = "0";
      }
      apparition._publishEvent("didShowBanner");
    }

    if (options.immediate) {
      onAnimationEnd();
    } else {
      setTimeout(onAnimationEnd, banner_utils.animationDelay);
    }
  };

  // Create markup
  banner_html.markup(options, storage, finalHookupsCallback);

  return closeBanner;
};
