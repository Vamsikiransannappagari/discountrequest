sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/FilterType",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    FilterType,
    MessageToast,
    MessageBox
) {
    "use strict";

    return Controller.extend("discountrequest.controller.View1", {

        onInit: function () {
            this._oSelectedContext = null;
            this._sQuery = "";
            this._sStatus = "All";

            this.getView().setModel(new JSONModel({
                counts: { all: 0, draft: 0, pending: 0, approved: 0, rejected: 0 },
                pendingValue: this.formatAmount(0)
            }), "view");

            this._updateActionButtons();
        },

        // ---------- Refresh ----------
        onRefresh: function () {
            var oBinding = this.byId("requestsTable").getBinding("items");
            if (oBinding) {
                oBinding.refresh();
                MessageToast.show("Discount requests refreshed");
            }
        },

        // ---------- Search + status filter (applied together) ----------
        onSearch: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            if (sQuery === undefined) {
                sQuery = oEvent.getParameter("newValue");
            }
            this._sQuery = (sQuery || "").trim();
            this._applyFilters();
        },

        onStatusFilterChange: function (oEvent) {
            this._sStatus = oEvent.getParameter("item").getKey();
            this._applyFilters();
        },

        _applyFilters: function () {
            var oBinding = this.byId("requestsTable").getBinding("items");
            if (!oBinding) {
                return;
            }

            var aFilters = [];

            if (this._sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("requestNumber", FilterOperator.Contains, this._sQuery),
                        new Filter("reason", FilterOperator.Contains, this._sQuery)
                    ],
                    and: false
                }));
            }

            if (this._sStatus === "Approved") {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("status", FilterOperator.EQ, "Approved"),
                        new Filter("status", FilterOperator.EQ, "Active")
                    ],
                    and: false
                }));
            } else if (this._sStatus !== "All") {
                aFilters.push(new Filter("status", FilterOperator.EQ, this._sStatus));
            }

            this.byId("requestsTable").removeSelections(true);
            this._oSelectedContext = null;
            this._updateActionButtons();

            oBinding.filter(aFilters, FilterType.Application);
        },

        // ---------- Summary cards ----------
        // Counts come from the rows loaded while no filter is active.
        onTableUpdateFinished: function () {
            if (this._sQuery || this._sStatus !== "All") {
                return;
            }

            var oBinding = this.byId("requestsTable").getBinding("items");
            if (!oBinding || !oBinding.getAllCurrentContexts) {
                return;
            }

            var oCounts = { all: 0, draft: 0, pending: 0, approved: 0, rejected: 0 };
            var fPendingValue = 0;

            oBinding.getAllCurrentContexts().forEach(function (oContext) {
                var oData = oContext.getObject() || {};
                oCounts.all++;

                switch (oData.status) {
                    case "Draft":
                        oCounts.draft++;
                        break;
                    case "PendingApproval":
                        oCounts.pending++;
                        fPendingValue += Number(oData.totalDiscountPrice) || 0;
                        break;
                    case "Approved":
                    case "Active":
                        oCounts.approved++;
                        break;
                    case "Rejected":
                        oCounts.rejected++;
                        break;
                }
            });

            var oModel = this.getView().getModel("view");
            oModel.setProperty("/counts", oCounts);
            oModel.setProperty("/pendingValue", this.formatAmount(fPendingValue));
        },

        // ---------- Selection ----------
        onRequestSelectionChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            this._oSelectedContext = oSelectedItem
                ? oSelectedItem.getBindingContext()
                : null;
            this._updateActionButtons();
        },

        _updateActionButtons: function () {
            var oContext = this._oSelectedContext;
            var bSelected = !!oContext;
            var sStatus = bSelected ? oContext.getProperty("status") : "";

            this.byId("editRequestButton").setEnabled(bSelected && sStatus === "Draft");
            this.byId("cancelRequestButton").setEnabled(bSelected && sStatus === "Draft");
        },

        // ---------- Navigation ----------
        onCreateRequest: function () {
            this.getOwnerComponent().getRouter().navTo("objectPage", {
                requestId: "new",
                mode: "create"
            });
        },

        onEditRequest: function () {
            if (!this._oSelectedContext) {
                MessageToast.show("Select a draft request first");
                return;
            }
            this.getOwnerComponent().getRouter().navTo("objectPage", {
                requestId: this._oSelectedContext.getProperty("ID"),
                mode: "edit"
            });
        },

        // Clicking a row (or its arrow) opens the request in display mode
        onRowPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            this.getOwnerComponent().getRouter().navTo("objectPage", {
                requestId: oContext.getProperty("ID"),
                mode: "display"
            });
        },

        // ---------- Delete draft ----------
        onCancelRequest: function () {
            if (!this._oSelectedContext) {
                MessageToast.show("Select a draft request first");
                return;
            }

            var oContext = this._oSelectedContext;
            var sRequestNumber = oContext.getProperty("requestNumber");

            if (oContext.getProperty("status") !== "Draft") {
                MessageToast.show("Only draft requests can be deleted");
                return;
            }

            MessageBox.confirm(
                "Delete request " + sRequestNumber + "? This can't be undone.",
                {
                    title: "Delete draft",
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.DELETE,
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.DELETE) {
                            return;
                        }

                        oContext.delete("$auto")
                            .then(function () {
                                this._oSelectedContext = null;
                                this._updateActionButtons();
                                MessageToast.show("Request " + sRequestNumber + " deleted");
                                this.byId("requestsTable").getBinding("items").refresh();
                            }.bind(this))
                            .catch(function (oError) {
                                MessageBox.error(
                                    oError.message || "Couldn't delete the request. Try again."
                                );
                            });
                    }.bind(this)
                }
            );
        },

        // ---------- Formatters ----------
        formatAmount: function (vAmount) {
            if (vAmount === null || vAmount === undefined || vAmount === "") {
                return "";
            }
            // The OData V4 type may hand over text like "5,812,480",
            // so keep only digits, the decimal point and the minus sign.
            var fAmount = typeof vAmount === "number"
                ? vAmount
                : Number(String(vAmount).replace(/[^0-9.\-]/g, ""));
            if (isNaN(fAmount)) {
                return "";
            }
            // Indian digit grouping, e.g. ₹ 58,12,480
            return "₹ " + fAmount.toLocaleString("en-IN", {
                maximumFractionDigits: 2
            });
        },

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
        },

        formatStatusIcon: function (sStatus) {
            switch (sStatus) {
                case "Draft":
                    return "sap-icon://document-text";
                case "PendingApproval":
                    return "sap-icon://pending";
                case "Approved":
                case "Active":
                    return "sap-icon://accept";
                case "Rejected":
                    return "sap-icon://decline";
                case "Expired":
                    return "sap-icon://history";
                default:
                    return "";
            }
        }
    });
});