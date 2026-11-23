
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/format/NumberFormat"
], function (
    Controller,
    JSONModel,
    MessageToast,
    NumberFormat
) {
    "use strict";

    return Controller.extend(
        "discountrequest.controller.Dashboard",
        {

            onInit: function () {

                var oDashboardModel = new JSONModel({
                    total: 0,
                    pending: 0,
                    active: 0,
                    rejected: 0,
                    draft: 0,
                    expired: 0,
                    recentRequests: []
                });

                this.getView().setModel(
                    oDashboardModel,
                    "dashboard"
                );

                this.loadDashboard();
            },

            loadDashboard: function () {

                var oModel =
                    this.getOwnerComponent().getModel();

                var oDashboardModel =
                    this.getView().getModel("dashboard");

                if (!oModel) {

                    MessageToast.show(
                        "OData service model is not available"
                    );

                    console.error(
                        "Default OData model is undefined"
                    );

                    return;
                }

                var oNumberFormat =
                    NumberFormat.getFloatInstance({
                        minFractionDigits: 2,
                        maxFractionDigits: 2,
                        groupingEnabled: true
                    });

                var oListBinding = oModel.bindList(
                    "/DiscountRequests",
                    null,
                    null,
                    null,
                    {
                        $select: [
                            "requestNumber",
                            "reason",
                            "totalNetPrice",
                            "status",
                            "requestDate",
                            "validFrom",
                            "validTo"
                        ].join(",")
                    }
                );

                oListBinding.requestContexts(0, 1000)

                    .then(function (aContexts) {

                        var aRequests = aContexts.map(
                            function (oContext) {

                                var oRequest =
                                    Object.assign(
                                        {},
                                        oContext.getObject()
                                    );

                                var fNetPrice =
                                    Number(oRequest.totalNetPrice) || 0;

                                oRequest.totalNetPriceText =
                                    oNumberFormat.format(fNetPrice);

                                oRequest.statusText =
                                    this.getStatusText(
                                        oRequest.status
                                    );

                                oRequest.statusState =
                                    this.getStatusState(
                                        oRequest.status
                                    );

                                return oRequest;

                            }.bind(this)
                        );

                        // Sort by latest request date

                        aRequests.sort(function (a, b) {

                            var dA = a.requestDate
                                ? new Date(a.requestDate).getTime()
                                : 0;

                            var dB = b.requestDate
                                ? new Date(b.requestDate).getTime()
                                : 0;

                            return dB - dA;

                        });

                        // Calculate request counts

                        var oCounts = {
                            total: aRequests.length,
                            pending: 0,
                            active: 0,
                            rejected: 0,
                            draft: 0,
                            expired: 0
                        };

                        aRequests.forEach(function (oRequest) {

                            switch (oRequest.status) {

                                case "Draft":
                                    oCounts.draft++;
                                    break;

                                case "PendingApproval":
                                    oCounts.pending++;
                                    break;

                                case "Active":
                                    oCounts.active++;
                                    break;

                                case "Rejected":
                                    oCounts.rejected++;
                                    break;

                                case "Expired":
                                    oCounts.expired++;
                                    break;

                            }

                        });

                        // Update dashboard model

                        oDashboardModel.setData({

                            total: oCounts.total,

                            pending: oCounts.pending,

                            active: oCounts.active,

                            rejected: oCounts.rejected,

                            draft: oCounts.draft,

                            expired: oCounts.expired,

                            recentRequests:
                                aRequests.slice(0, 5)

                        });

                    }.bind(this))

                    .catch(function (oError) {

                        MessageToast.show(
                            "Unable to load dashboard data"
                        );

                        console.error(
                            "Dashboard loading error:",
                            oError
                        );

                    });

            },

            getStatusText: function (sStatus) {

                var oStatusTexts = {
                    PendingApproval: "Pending Approval",
                    Draft: "Draft",
                    Approved: "Approved",
                    Rejected: "Rejected",
                    Active: "Active",
                    Expired: "Expired"
                };

                return oStatusTexts[sStatus] || sStatus || "Unknown";

            },

            getStatusState: function (sStatus) {

                switch (sStatus) {

                    case "Active":
                    case "Approved":
                        return "Success";

                    case "PendingApproval":
                        return "Warning";

                    case "Rejected":
                    case "Expired":
                        return "Error";

                    case "Draft":
                        return "Information";

                    default:
                        return "None";
                }

            },

            onViewAllRequests: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("requests");

            }

        }
    );
});
