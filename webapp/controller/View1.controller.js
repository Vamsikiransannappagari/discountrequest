
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (
    Controller,
    Filter,
    FilterOperator,
    FilterType,
    MessageToast,
    MessageBox
) {
    "use strict";

    return Controller.extend(
        "discountrequest.controller.View1",
        {

            onInit: function () {
                this._oSelectedContext = null;
                this._updateActionButtons();
            },

            // Refresh Request List
            onRefresh: function () {

                var oBinding = this.byId("requestsTable")
                    .getBinding("items");

                if (oBinding) {
                    oBinding.refresh();
                    MessageToast.show("Discount requests refreshed");
                }
            },

            // Search Requests
            onSearch: function (oEvent) {

                var sQuery = oEvent.getParameter("query");

                if (sQuery === undefined) {
                    sQuery = oEvent.getParameter("newValue");
                }

                sQuery = (sQuery || "").trim();

                var oBinding = this.byId("requestsTable")
                    .getBinding("items");

                if (!oBinding) {
                    return;
                }

                if (!sQuery) {
                    oBinding.filter([], FilterType.Application);
                    return;
                }

                var oSearchFilter = new Filter({
                    filters: [
                        new Filter(
                            "requestNumber",
                            FilterOperator.Contains,
                            sQuery
                        ),
                        new Filter(
                            "reason",
                            FilterOperator.Contains,
                            sQuery
                        )
                    ],
                    and: false
                });

                oBinding.filter(
                    [oSearchFilter],
                    FilterType.Application
                );
            },

            // Handle Row Selection
            onRequestSelectionChange: function (oEvent) {

                var oTable = this.byId("requestsTable");
                var oSelectedItem = oEvent.getParameter("listItem");

                this._oSelectedContext = oSelectedItem
                    ? oSelectedItem.getBindingContext()
                    : null;

                this._updateActionButtons();
            },

            // Enable or Disable Buttons
            _updateActionButtons: function () {

                var oContext = this._oSelectedContext;
                var bSelected = !!oContext;

                var sStatus = bSelected
                    ? oContext.getProperty("status")
                    : "";

                this.byId("editRequestButton").setEnabled(
                    bSelected && sStatus === "Draft"
                );

                // this.byId("viewRequestButton").setEnabled(
                //     bSelected
                // );

                // Without backend changes, only Draft can be deleted.
                this.byId("cancelRequestButton").setEnabled(
                    bSelected && sStatus === "Draft"
                );
            },

            // Create Request
            onCreateRequest: function () {

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("objectPage", {
                        requestId: "new",
                        mode: "create"
                    });
            },

            // Edit Request
            onEditRequest: function () {

                if (!this._oSelectedContext) {
                    MessageToast.show("Please select a discount request");
                    return;
                }

                var sRequestId = this._oSelectedContext.getProperty("ID");

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("objectPage", {
                        requestId: sRequestId,
                        mode: "edit"
                    });
            },

            // View Request Details
            onViewDetails: function () {

                if (!this._oSelectedContext) {
                    MessageToast.show("Please select a discount request");
                    return;
                }

                var sRequestId = this._oSelectedContext.getProperty("ID");

                this.getOwnerComponent()
                    .getRouter()
                    .navTo("objectPage", {
                        requestId: sRequestId,
                        mode: "display"
                    });
            },

            // Delete Draft Request
            onCancelRequest: function () {

                if (!this._oSelectedContext) {
                    MessageToast.show("Please select a discount request");
                    return;
                }

                var oContext = this._oSelectedContext;
                var sStatus = oContext.getProperty("status");
                var sRequestNumber = oContext.getProperty("requestNumber");

                if (sStatus !== "Draft") {
                    MessageToast.show(
                        "Only Draft requests can be deleted"
                    );
                    return;
                }

                MessageBox.confirm(
                    "Do you want to delete request " +
                    sRequestNumber + "?",
                    {
                        title: "Confirm Delete",

                        actions: [
                            MessageBox.Action.DELETE,
                            MessageBox.Action.CANCEL
                        ],

                        emphasizedAction: MessageBox.Action.DELETE,

                        onClose: function (sAction) {

                            if (sAction !== MessageBox.Action.DELETE) {
                                return;
                            }

                            oContext.delete("$auto")
                                .then(function () {

                                    this._oSelectedContext = null;
                                    this._updateActionButtons();

                                    MessageToast.show(
                                        "Draft request deleted successfully"
                                    );

                                    this.byId("requestsTable")
                                        .getBinding("items")
                                        .refresh();

                                }.bind(this))
                                .catch(function (oError) {

                                    MessageBox.error(
                                        oError.message ||
                                        "Unable to delete the request"
                                    );

                                });
                        }.bind(this)
                    }
                );
            },

            // Status Formatting
            formatStatus: function (sStatus) {

                switch (sStatus) {

                    case "Draft":
                        return "Information";

                    case "PendingApproval":
                        return "Warning";

                    case "Approved":
                    case "Active":
                        return "Success";

                    case "Rejected":
                    case "Expired":
                        return "Error";

                    default:
                        return "None";
                }
            }

        }
    );
});
