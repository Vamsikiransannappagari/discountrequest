
sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend(
        "discountrequest.controller.App",
        {

            onInit: function () {

                // Open Dashboard when application starts
                this.getOwnerComponent()
                    .getRouter()
                    .navTo("dashboard", {}, true);

            },

            onItemSelect: function (oEvent) {

                var oItem = oEvent.getParameter("item");
                var sKey = oItem.getKey();

                if (sKey === "dashboard") {

                    this.getOwnerComponent()
                        .getRouter()
                        .navTo("dashboard");

                } else if (sKey === "requests") {

                    this.getOwnerComponent()
                        .getRouter()
                        .navTo("requests");

                }

            },

            onSideNavButtonPress: function () {

                var oToolPage = this.byId("toolPage");

                oToolPage.setSideExpanded(
                    !oToolPage.getSideExpanded()
                );

            },

            onHome: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("dashboard");

            }

        }
    );
});
