/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require([
    "discountrequest/test/unit/AllTests"
], function () {
    "use strict";

    QUnit.start();
});