
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Item",
    "sap/m/ColumnListItem",
    "sap/m/Select",
    "sap/m/Input",
    "sap/m/Text",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (
    Controller,
    JSONModel,
    Item,
    ColumnListItem,
    Select,
    Input,
    Text,
    MessageToast,
    MessageBox
) {
    "use strict";

    return Controller.extend("discountrequest.controller.ObjectPage", {

        // ============================================================
        // INITIALIZATION
        // ============================================================

        onInit: function () {
            this._oModel = this.getOwnerComponent().getModel();
            this._oRouter = this.getOwnerComponent().getRouter();

            this._sMode = "create";
            this._sRequestId = null;

            this._aModels = [];
            this._aDealers = [];
            this._aPriceConditions = [];
            this._aDeletedLineIds = [];

            this._oLineModel = new JSONModel({
                items: []
            });

            this.getView().setModel(this._oLineModel, "lines");

            this._oRouter.getRoute("objectPage")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: async function (oEvent) {
            var oArgs = oEvent.getParameter("arguments");
            var sRouteRequestId = oArgs.requestId;

            if (!sRouteRequestId || sRouteRequestId === "new") {
                this._sMode = "create";
                this._sRequestId = null;
            } else {
                this._sMode = oArgs.mode || "edit";
                this._sRequestId = sRouteRequestId;
            }

            this._clearForm();

            try {
                await this._loadMasterData();

                if (this._sMode === "create") {
                    this._setEditMode(true);
                    this.byId("requestDate").setValue(this._today());
                    return;
                }

                await this._loadRequest(this._sRequestId);

                this._setEditMode(this._sMode === "edit");

            } catch (oError) {
                console.error("Route loading error:", oError);

                MessageBox.error(
                    "Unable to open Discount Request: " +
                    (oError.message || oError)
                );
            }
        },

        _today: function () {
            var oDate = new Date();
            var iOffset = oDate.getTimezoneOffset();

            oDate = new Date(oDate.getTime() - iOffset * 60000);

            return oDate.toISOString().slice(0, 10);
        },

        _clearForm: function () {
            [
                "requestNumber",
                "requestDate",
                "reason",
                "supportingDetails",
                "validFrom",
                "validTo",
                "totalBasePrice",
                "totalDiscountPrice",
                "totalNetPrice"
            ].forEach(function (sId) {
                var oControl = this.byId(sId);

                if (oControl) {
                    oControl.setValue("");
                }
            }.bind(this));

            [
                "dealerSelect",
                "regionSelect",
                "salesChannelSelect"
            ].forEach(function (sId) {
                var oSelect = this.byId(sId);

                if (oSelect) {
                    oSelect.removeAllItems();
                    oSelect.setSelectedKey("");
                }
            }.bind(this));

            this.byId("lineItemsTable").removeAllItems();

            this._aDeletedLineIds = [];

            this._oLineModel.setData({
                items: []
            });
        },

        // ============================================================
        // DATE HELPERS
        // ============================================================

        _toISODate: function (vDate) {
            if (!vDate) {
                return "";
            }

            if (vDate instanceof Date && !isNaN(vDate.getTime())) {
                var iYear = vDate.getFullYear();
                var iMonth = String(vDate.getMonth() + 1).padStart(2, "0");
                var iDay = String(vDate.getDate()).padStart(2, "0");

                return iYear + "-" + iMonth + "-" + iDay;
            }

            var sDate = String(vDate).trim();

            if (!sDate) {
                return "";
            }

            if (/^\d{4}-\d{2}-\d{2}/.test(sDate)) {
                return sDate.substring(0, 10);
            }

            var aParts = sDate.split("/");

            if (aParts.length === 3) {
                return aParts[2] + "-" +
                    aParts[1].padStart(2, "0") + "-" +
                    aParts[0].padStart(2, "0");
            }

            return sDate;
        },

        _getDateControlValue: function (sControlId) {
            var oControl = this.byId(sControlId);

            if (!oControl) {
                return "";
            }

            if (typeof oControl.getDateValue === "function") {
                var oDate = oControl.getDateValue();

                if (oDate instanceof Date && !isNaN(oDate.getTime())) {
                    return this._toISODate(oDate);
                }
            }

            return this._toISODate(oControl.getValue());
        },

        // ============================================================
        // MASTER DATA
        // ============================================================

        _readEntity: async function (sPath) {
            var oBinding = this._oModel.bindList(sPath);
            var aContexts = await oBinding.requestContexts(0, 1000);

            return aContexts.map(function (oContext) {
                return oContext.getObject();
            });
        },
        _loadMasterData: async function () {
            var aResults = await Promise.all([
                this._readEntity("/Dealers"),
                this._readEntity("/Regions"),
                this._readEntity("/SalesChannels"),
                this._readEntity("/Models"),
                this._readEntity("/PriceConditions")
            ]);

            this._aDealers = aResults[0];
            this._aModels = aResults[3];
            this._aPriceConditions = aResults[4];

            // Only these four regions are selectable
            var aAllowedRegions = ["East", "West", "North", "South"];

            var aFilteredRegions = aResults[1].filter(function (oRegion) {
                return aAllowedRegions.indexOf(oRegion.regionName) !== -1;
            });

            this._fillSelect(
                "dealerSelect",
                aResults[0],
                "dealerName"
            );

            this._fillSelect(
                "regionSelect",
                aFilteredRegions,
                "regionName"
            );

            this._fillSelect(
                "salesChannelSelect",
                aResults[2],
                "channelName"
            );

            console.log(
                "Loaded Price Conditions:",
                this._aPriceConditions.length
            );
        },

        _fillSelect: function (sControlId, aData, sTextProperty) {
            var oSelect = this.byId(sControlId);

            oSelect.removeAllItems();

            oSelect.addItem(new Item({
                key: "",
                text: "Select"
            }));

            aData.forEach(function (oEntry) {
                if (oEntry.status && oEntry.status !== "Active") {
                    return;
                }

                oSelect.addItem(new Item({
                    key: oEntry.ID,
                    text: oEntry[sTextProperty] || ""
                }));
            });

            oSelect.setSelectedKey("");
        },

        _getModelName: function (sModelId) {
            var oModel = this._aModels.find(function (oEntry) {
                return oEntry.ID === sModelId;
            });

            return oModel ? oModel.modelName : "";
        },

        // ============================================================
        // HEADER CHANGE EVENTS
        // ============================================================

        onDealerChange: function () {
            var sDealerId = this.byId("dealerSelect").getSelectedKey();

            var oDealer = this._aDealers.find(function (oEntry) {
                return oEntry.ID === sDealerId;
            });

            if (oDealer && oDealer.region_ID) {
                this.byId("regionSelect").setSelectedKey(
                    oDealer.region_ID
                );
            }

            this._clearInvalidPriceConditions();
        },

        onRegionChange: function () {
            this._clearInvalidPriceConditions();
        },

        onSalesChannelChange: function () {
            this._clearInvalidPriceConditions();
        },

        onRequestDateChange: function () {
            this._clearInvalidPriceConditions();
        },

        // ============================================================
        // LOAD EXISTING REQUEST
        // ============================================================

        _loadRequest: async function (sRequestId) {
            var oBinding = this._oModel.bindContext(
                "/DiscountRequests(" + sRequestId + ")"
            );

            var oContext = await oBinding.requestObject();

            this.byId("requestNumber").setValue(
                oContext.requestNumber || ""
            );

            this.byId("requestDate").setValue(
                this._toISODate(oContext.requestDate)
            );

            this.byId("reason").setValue(
                oContext.reason || ""
            );

            this.byId("supportingDetails").setValue(
                oContext.supportingDetails || ""
            );

            this.byId("validFrom").setValue(
                this._toISODate(oContext.validFrom)
            );

            this.byId("validTo").setValue(
                this._toISODate(oContext.validTo)
            );

            this.byId("dealerSelect").setSelectedKey(
                oContext.dealer_ID || ""
            );

            this.byId("regionSelect").setSelectedKey(
                oContext.region_ID || ""
            );

            this.byId("salesChannelSelect").setSelectedKey(
                oContext.salesChannel_ID || ""
            );

            await this._loadRequestLines(sRequestId);

            this._clearInvalidPriceConditions();
            this._calculateSummary();
        },

        _loadRequestLines: async function (sRequestId) {
            var oBinding = this._oModel.bindList(
                "/DiscountLines",
                null,
                null,
                null,
                {
                    $filter: "discountRequest_ID eq " + sRequestId
                }
            );

            var aContexts = await oBinding.requestContexts(0, 1000);

            var aLines = aContexts.map(function (oContext) {
                var oLine = oContext.getObject();

                return {
                    ID: oLine.ID,
                    model_ID: oLine.model_ID,
                    quantity: oLine.quantity,

                    basePrice: Number(oLine.basePrice || 0),
                    costPrice: Number(oLine.costPrice || 0),
                    taxPercentage: Number(oLine.taxPercentage || 0),
                    dealerMargin: Number(oLine.dealerMargin || 0),

                    // The UI now supports percentage discounts only.
                    discountType: "Percentage",

                    discountValue: Number(
                        oLine.discountPercentage || 0
                    ),

                    discountPercentage: Number(
                        oLine.discountPercentage || 0
                    ),

                    discountAmount: Number(
                        oLine.discountAmount || 0
                    ),

                    netPrice: Number(oLine.netPrice || 0),

                    totalNetPrice: Number(
                        oLine.totalNetPrice || 0
                    ),

                    priceCondition_ID: oLine.priceCondition_ID || ""
                };
            });

            this._oLineModel.setData({
                items: aLines
            });

            this._calculateAllLines();
            this._renderLines();
        },

        // ============================================================
        // ADD LINE
        // ============================================================

        onAddLine: function () {
            if (this._sMode === "display") {
                return;
            }

            var aItems = this._oLineModel.getProperty("/items") || [];

            aItems.push({
                model_ID: "",
                quantity: 1,

                basePrice: 0,
                costPrice: 0,
                taxPercentage: 0,
                dealerMargin: 0,

                discountType: "Percentage",
                discountValue: 0,
                discountPercentage: 0,
                discountAmount: 0,

                netPrice: 0,
                totalNetPrice: 0,

                priceCondition_ID: ""
            });

            this._oLineModel.setProperty("/items", aItems);

            this._renderLines();
            this._calculateSummary();
        },

        // ============================================================
        // PRICE CONDITION MATCHING
        // ============================================================

        _getMatchingConditions: function (oLine) {
            var sRegionId = this.byId("regionSelect").getSelectedKey();
            var sChannelId = this.byId("salesChannelSelect").getSelectedKey();
            var sDealerId = this.byId("dealerSelect").getSelectedKey();

            var sValidFrom = this._getDateControlValue("validFrom");
            var sValidTo = this._getDateControlValue("validTo");

            var aConditions = this._aPriceConditions || [];

            if (!oLine.model_ID || !sRegionId) {
                return [];
            }

            return aConditions.filter(function (oCondition) {

                if (oCondition.model_ID !== oLine.model_ID) {
                    return false;
                }

                if (oCondition.region_ID !== sRegionId) {
                    return false;
                }

                if (oCondition.status !== "Active") {
                    return false;
                }

                if (
                    sChannelId &&
                    oCondition.salesChannel_ID &&
                    oCondition.salesChannel_ID !== sChannelId
                ) {
                    return false;
                }

                if (
                    sDealerId &&
                    oCondition.dealer_ID &&
                    oCondition.dealer_ID !== sDealerId
                ) {
                    return false;
                }

                var sConditionFrom = this._toISODate(
                    oCondition.validFrom
                );

                if (
                    sValidFrom &&
                    sConditionFrom &&
                    sValidFrom < sConditionFrom
                ) {
                    return false;
                }

                var sConditionTo = this._toISODate(
                    oCondition.validTo
                );

                if (
                    sValidTo &&
                    sConditionTo &&
                    sValidTo > sConditionTo
                ) {
                    return false;
                }

                return true;

            }.bind(this));
        },

        // ============================================================
        // CLEAR / APPLY PRICE CONDITION
        // ============================================================

        _clearLinePricing: function (iIndex) {
            this._updateLine(iIndex, "priceCondition_ID", "");

            this._updateLine(iIndex, "basePrice", 0);
            this._updateLine(iIndex, "costPrice", 0);
            this._updateLine(iIndex, "taxPercentage", 0);
            this._updateLine(iIndex, "dealerMargin", 0);

            this._updateLine(iIndex, "discountAmount", 0);
            this._updateLine(iIndex, "discountPercentage", 0);
            this._updateLine(iIndex, "discountValue", 0);

            this._updateLine(iIndex, "netPrice", 0);
            this._updateLine(iIndex, "totalNetPrice", 0);
        },

        _setLineFromCondition: function (iIndex, oCondition) {
            this._updateLine(
                iIndex,
                "priceCondition_ID",
                oCondition.ID
            );

            this._updateLine(
                iIndex,
                "model_ID",
                oCondition.model_ID || ""
            );

            this._updateLine(
                iIndex,
                "basePrice",
                Number(oCondition.basePrice || 0)
            );

            this._updateLine(
                iIndex,
                "costPrice",
                Number(oCondition.costPrice || 0)
            );

            this._updateLine(
                iIndex,
                "taxPercentage",
                Number(oCondition.taxPercentage || 0)
            );

            this._updateLine(
                iIndex,
                "dealerMargin",
                Number(oCondition.dealerMargin || 0)
            );

            this._calculateLine(iIndex);
        },

        _clearInvalidPriceConditions: function () {
            var aLines = this._oLineModel.getProperty("/items") || [];

            aLines.forEach(function (oLine, iIndex) {
                var aMatching = this._getMatchingConditions(oLine);

                var bStillValid = aMatching.some(function (oCondition) {
                    return oCondition.ID === oLine.priceCondition_ID;
                });

                if (bStillValid) {
                    return;
                }

                this._clearLinePricing(iIndex);

                if (aMatching.length === 1) {
                    this._setLineFromCondition(
                        iIndex,
                        aMatching[0]
                    );
                }

            }.bind(this));

            this._renderLines();
            this._calculateSummary();
        },

        _applyPriceCondition: function (iIndex, sConditionId) {
            if (!sConditionId) {
                this._clearLinePricing(iIndex);
                this._renderLines();
                this._calculateSummary();
                return;
            }

            var oLine = this._oLineModel.getProperty(
                "/items/" + iIndex
            );

            var aMatching = this._getMatchingConditions(oLine);

            var oCondition = aMatching.find(function (oEntry) {
                return oEntry.ID === sConditionId;
            });

            if (!oCondition) {
                this._clearLinePricing(iIndex);

                MessageToast.show(
                    "This Price Condition does not match the selected " +
                    "Model, Region, Dealer, Channel or validity dates."
                );

                this._renderLines();
                this._calculateSummary();
                return;
            }

            this._setLineFromCondition(iIndex, oCondition);

            this._renderLines();
            this._calculateSummary();
        },

        // ============================================================
        // RENDER LINE TABLE
        // ============================================================

        _renderLines: function () {
            var oTable = this.byId("lineItemsTable");

            oTable.removeAllItems();

            var aItems = this._oLineModel.getProperty("/items") || [];
            var bEditable = this._sMode !== "display";

            aItems.forEach(function (oLine, iIndex) {

                // MODEL SELECT
                var oModelSelect = new Select({
                    width: "100%",
                    selectedKey: oLine.model_ID || "",
                    enabled: bEditable,

                    items: [
                        new Item({
                            key: "",
                            text: "Select Model"
                        })
                    ]
                });

                this._aModels.forEach(function (oModel) {
                    var bAlreadySelected =
                        oModel.ID === oLine.model_ID;

                    if (
                        oModel.status !== "Active" &&
                        !bAlreadySelected
                    ) {
                        return;
                    }

                    oModelSelect.addItem(new Item({
                        key: oModel.ID,
                        text: oModel.modelName || ""
                    }));
                });

                oModelSelect.attachChange(function (oEvent) {
                    var sModelId = oEvent.getSource().getSelectedKey();

                    this._updateLine(
                        iIndex,
                        "model_ID",
                        sModelId
                    );

                    this._clearLinePricing(iIndex);
                    this._clearInvalidPriceConditions();

                }.bind(this));

                // PRICE CONDITION SELECT
                var oConditionSelect = new Select({
                    width: "100%",
                    selectedKey: oLine.priceCondition_ID || "",

                    enabled: bEditable &&
                        !!oLine.model_ID &&
                        !!this.byId("regionSelect").getSelectedKey(),

                    items: [
                        new Item({
                            key: "",
                            text: "Select Price Condition"
                        })
                    ]
                });

                var aMatchingConditions =
                    this._getMatchingConditions(oLine);

                aMatchingConditions.forEach(function (oCondition) {
                    oConditionSelect.addItem(new Item({
                        key: oCondition.ID,

                        text:
                            (oCondition.conditionCode || "Price Condition") +
                            " | ₹" +
                            Number(oCondition.basePrice || 0).toFixed(2)
                    }));
                });

                oConditionSelect.attachChange(function (oEvent) {
                    this._applyPriceCondition(
                        iIndex,
                        oEvent.getSource().getSelectedKey()
                    );
                }.bind(this));

                // QUANTITY
                var oQuantity = new Input({
                    value: String(
                        oLine.quantity == null ? "" : oLine.quantity
                    ),
                    type: "Number",
                    width: "100%",
                    editable: bEditable
                });

                oQuantity.attachChange(function (oEvent) {
                    var sValue = oEvent.getSource().getValue();

                    this._updateLine(
                        iIndex,
                        "quantity",
                        sValue === "" ? null : Number(sValue)
                    );

                    this._calculateLine(iIndex);
                    this._calculateSummary();
                    this._renderLines();

                }.bind(this));

                // BASE PRICE
                var oBasePrice = new Text({
                    text: Number(oLine.basePrice || 0).toFixed(2)
                });

                // DISCOUNT VALUE - PERCENTAGE ONLY
                var oDiscountValue = new Input({
                    value: oLine.discountValue == null
                        ? ""
                        : String(oLine.discountValue),

                    type: "Number",
                    width: "100%",

                    editable: bEditable &&
                        !!oLine.priceCondition_ID
                });

                oDiscountValue.attachChange(function (oEvent) {
                    var sValue = oEvent.getSource().getValue();

                    this._updateLine(
                        iIndex,
                        "discountValue",
                        sValue === "" ? null : Number(sValue)
                    );

                    this._calculateLine(iIndex);
                    this._calculateSummary();
                    this._renderLines();

                }.bind(this));

                // NET PRICE
                var oNetPrice = new Text({
                    text: "₹ " +
                        Number(oLine.netPrice || 0).toFixed(2)
                });

                // Six cells matching the updated XML table.
                oTable.addItem(new ColumnListItem({
                    cells: [
                        oModelSelect,
                        oConditionSelect,
                        oQuantity,
                        oBasePrice,
                        oDiscountValue,
                        oNetPrice
                    ]
                }));

            }.bind(this));
        },

        // ============================================================
        // LINE DATA UPDATE
        // ============================================================

        _updateLine: function (iIndex, sProperty, vValue) {
            this._oLineModel.setProperty(
                "/items/" + iIndex + "/" + sProperty,
                vValue
            );
        },

        // ============================================================
        // CALCULATIONS - PERCENTAGE DISCOUNT ONLY
        // ============================================================

        _calculateLine: function (iIndex) {
            var oLine = this._oLineModel.getProperty(
                "/items/" + iIndex
            );

            if (!oLine || !oLine.priceCondition_ID) {
                return;
            }

            var nBase = Number(oLine.basePrice || 0);
            var nTax = Number(oLine.taxPercentage || 0);
            var nQuantity = Number(oLine.quantity || 0);
            var nDiscountPercentage = Number(
                oLine.discountValue || 0
            );

            var nDiscountAmount =
                nBase * nDiscountPercentage / 100;

            var nDiscountedPrice = nBase - nDiscountAmount;

            var nNetPrice =
                nDiscountedPrice * (1 + nTax / 100);

            this._updateLine(
                iIndex,
                "discountType",
                "Percentage"
            );

            this._updateLine(
                iIndex,
                "discountAmount",
                nDiscountAmount
            );

            this._updateLine(
                iIndex,
                "discountPercentage",
                nDiscountPercentage
            );

            this._updateLine(
                iIndex,
                "netPrice",
                nNetPrice
            );

            this._updateLine(
                iIndex,
                "totalNetPrice",
                nNetPrice * nQuantity
            );
        },

        _calculateAllLines: function () {
            var aItems = this._oLineModel.getProperty("/items") || [];

            aItems.forEach(function (oLine, iIndex) {
                this._calculateLine(iIndex);
            }.bind(this));
        },

        _calculateSummary: function () {
            var aItems = this._oLineModel.getProperty("/items") || [];

            var nTotalBase = 0;
            var nTotalDiscount = 0;
            var nTotalNet = 0;

            aItems.forEach(function (oLine) {
                var nQuantity = Number(oLine.quantity || 0);
                var nBase = Number(oLine.basePrice || 0);
                var nDiscount = Number(oLine.discountAmount || 0);
                var nNet = Number(oLine.netPrice || 0);

                nTotalBase += nBase * nQuantity;
                nTotalDiscount += nDiscount * nQuantity;
                nTotalNet += nNet * nQuantity;
            });

            this.byId("totalBasePrice").setValue(
                nTotalBase.toFixed(2)
            );

            this.byId("totalDiscountPrice").setValue(
                nTotalDiscount.toFixed(2)
            );

            this.byId("totalNetPrice").setValue(
                nTotalNet.toFixed(2)
            );
        },

        // ============================================================
        // REMOVE LINE
        // ============================================================

        onRemoveLine: function () {
            var oTable = this.byId("lineItemsTable");
            var oSelectedItem = oTable.getSelectedItem();

            if (!oSelectedItem) {
                MessageToast.show("Select a line item first");
                return;
            }

            var iIndex = oTable.indexOfItem(oSelectedItem);

            var aItems = this._oLineModel.getProperty("/items");
            var oRemovedLine = aItems[iIndex];

            if (oRemovedLine && oRemovedLine.ID) {
                this._aDeletedLineIds.push(oRemovedLine.ID);
            }

            aItems.splice(iIndex, 1);

            this._oLineModel.setProperty("/items", aItems);

            this._renderLines();
            this._calculateSummary();
        },

        // ============================================================
        // EDIT / DISPLAY MODE
        // ============================================================

        _setEditMode: function (bEditable) {
            [
                "reason",
                "supportingDetails",
                "validFrom",
                "validTo"
            ].forEach(function (sId) {
                this.byId(sId).setEditable(bEditable);
            }.bind(this));

            this.byId("requestNumber").setEditable(false);
            this.byId("requestDate").setEditable(false);

            [
                "dealerSelect",
                "regionSelect",
                "salesChannelSelect"
            ].forEach(function (sId) {
                this.byId(sId).setEnabled(bEditable);
            }.bind(this));

            [
                "totalBasePrice",
                "totalDiscountPrice",
                "totalNetPrice"
            ].forEach(function (sId) {
                this.byId(sId).setEditable(false);
            }.bind(this));

            this.byId("lineItemsTable").setMode(
                bEditable ? "SingleSelectLeft" : "None"
            );

            this.byId("objectPage").setTitle(
                this._sMode === "create"
                    ? "Create Discount Request"
                    : this._sMode === "edit"
                        ? "Edit Discount Request"
                        : "Discount Request Details"
            );

            [
                "calculateButton",
                "validateButton",
                "saveDraftButton",
                "submitButton",
                "_IDGenButton3",
                "_IDGenButton5"
            ].forEach(function (sId) {
                var oButton = this.byId(sId);

                if (oButton) {
                    oButton.setVisible(bEditable);
                }
            }.bind(this));

            this._renderLines();
        },

        // ============================================================
        // REQUEST PAYLOADS
        // ============================================================

        _getRequestPayload: function () {
            return {
                reason: this.byId("reason").getValue().trim(),

                supportingDetails:
                    this.byId("supportingDetails").getValue(),

                validFrom:
                    this._getDateControlValue("validFrom") || null,

                validTo:
                    this._getDateControlValue("validTo") || null,

                dealer_ID:
                    this.byId("dealerSelect").getSelectedKey() || null,

                region_ID:
                    this.byId("regionSelect").getSelectedKey() || null,

                salesChannel_ID:
                    this.byId("salesChannelSelect").getSelectedKey() || null
            };
        },

        _getLinePayload: function (oLine) {
            return {
                model_ID: oLine.model_ID || null,

                quantity: oLine.quantity == null
                    ? null
                    : Number(oLine.quantity),

                basePrice: Number(oLine.basePrice || 0),
                costPrice: Number(oLine.costPrice || 0),
                taxPercentage: Number(oLine.taxPercentage || 0),
                dealerMargin: Number(oLine.dealerMargin || 0),

                // Fixed discount type because the UI is percentage-only.
                discountType: "Percentage",

                discountPercentage: oLine.discountValue == null
                    ? null
                    : Number(oLine.discountValue),

                priceCondition_ID: oLine.priceCondition_ID || null
            };
        },

        // ============================================================
        // VALIDATION
        // ============================================================

        _validateDraft: function () {
            return true;
        },

        _validateSubmission: function () {
            var oPayload = this._getRequestPayload();

            if (!oPayload.reason) {
                MessageToast.show("Enter the request reason");
                return false;
            }

            if (!oPayload.dealer_ID) {
                MessageToast.show("Select a dealer");
                return false;
            }

            if (!oPayload.region_ID) {
                MessageToast.show("Select a region");
                return false;
            }

            if (!oPayload.salesChannel_ID) {
                MessageToast.show("Select a sales channel");
                return false;
            }

            if (!oPayload.validFrom || !oPayload.validTo) {
                MessageToast.show("Select request validity dates");
                return false;
            }

            if (oPayload.validFrom >= oPayload.validTo) {
                MessageToast.show(
                    "Valid To must be later than Valid From"
                );
                return false;
            }

            var aLines = this._oLineModel.getProperty("/items") || [];

            if (aLines.length === 0) {
                MessageToast.show("Add at least one discount line");
                return false;
            }

            for (var i = 0; i < aLines.length; i++) {
                var oLine = aLines[i];

                if (!oLine.model_ID) {
                    MessageToast.show(
                        "Select Model in line " + (i + 1)
                    );
                    return false;
                }

                if (!oLine.priceCondition_ID) {
                    MessageToast.show(
                        "Select Price Condition in line " + (i + 1)
                    );
                    return false;
                }

                if (
                    oLine.quantity == null ||
                    !Number.isFinite(Number(oLine.quantity)) ||
                    Number(oLine.quantity) <= 0
                ) {
                    MessageToast.show(
                        "Enter a valid Quantity in line " + (i + 1)
                    );
                    return false;
                }

                if (
                    oLine.discountValue == null ||
                    !Number.isFinite(Number(oLine.discountValue)) ||
                    Number(oLine.discountValue) < 0
                ) {
                    MessageToast.show(
                        "Enter a valid Discount Value in line " + (i + 1)
                    );
                    return false;
                }

                if (Number(oLine.discountValue) > 100) {
                    MessageToast.show(
                        "Discount percentage cannot exceed 100% " +
                        "in line " + (i + 1)
                    );
                    return false;
                }

                var oCondition = this._aPriceConditions.find(
                    function (oEntry) {
                        return oEntry.ID === oLine.priceCondition_ID;
                    }
                );

                if (!oCondition || oCondition.status !== "Active") {
                    MessageToast.show(
                        "Select an active Price Condition in line " +
                        (i + 1)
                    );
                    return false;
                }

                if (
                    oCondition.model_ID !== oLine.model_ID ||
                    oCondition.region_ID !== oPayload.region_ID
                ) {
                    MessageToast.show(
                        "Price Condition Model or Region does not match " +
                        "the request in line " + (i + 1)
                    );
                    return false;
                }

                if (
                    oCondition.salesChannel_ID &&
                    oCondition.salesChannel_ID !== oPayload.salesChannel_ID
                ) {
                    MessageToast.show(
                        "Price Condition Sales Channel does not match " +
                        "the request in line " + (i + 1)
                    );
                    return false;
                }

                if (
                    oCondition.dealer_ID &&
                    oCondition.dealer_ID !== oPayload.dealer_ID
                ) {
                    MessageToast.show(
                        "Price Condition Dealer does not match " +
                        "the request in line " + (i + 1)
                    );
                    return false;
                }

                var sConditionFrom = this._toISODate(
                    oCondition.validFrom
                );

                var sConditionTo = this._toISODate(
                    oCondition.validTo
                );

                if (
                    sConditionFrom &&
                    oPayload.validFrom < sConditionFrom
                ) {
                    MessageToast.show(
                        "Request Valid From is outside Price Condition " +
                        "validity in line " + (i + 1)
                    );
                    return false;
                }

                if (
                    sConditionTo &&
                    oPayload.validTo > sConditionTo
                ) {
                    MessageToast.show(
                        "Request Valid To is outside Price Condition " +
                        "validity in line " + (i + 1)
                    );
                    return false;
                }

                if (
                    oCondition.maximumDiscount != null &&
                    Number(oLine.discountValue) >
                    Number(oCondition.maximumDiscount)
                ) {
                    MessageToast.show(
                        "Discount exceeds the Price Condition maximum " +
                        "in line " + (i + 1)
                    );
                    return false;
                }
            }

            return true;
        },

        // ============================================================
        // CALCULATE BUTTON
        // ============================================================

        // onCalculate: function () {
        //     var aLines = this._oLineModel.getProperty("/items") || [];

        //     if (!aLines.length) {
        //         MessageToast.show("Add at least one discount line");
        //         return;
        //     }

        //     for (var i = 0; i < aLines.length; i++) {
        //         if (!aLines[i].priceCondition_ID) {
        //             MessageToast.show(
        //                 "Select a Model, Region and matching Price " +
        //                 "Condition in line " + (i + 1)
        //             );
        //             return;
        //         }

        //         this._calculateLine(i);
        //     }

        //     this._calculateSummary();
        //     this._renderLines();

        //     MessageToast.show("Pricing calculated successfully");
        // },

        // ============================================================
        // VALIDATE BUTTON
        // ============================================================

        // onValidate: function () {
        //     if (!this._validateSubmission()) {
        //         return;
        //     }

        //     MessageBox.information(
        //         "The required request and line-item information is " +
        //         "available. Final approval-matrix validation will be " +
        //         "performed by the backend during submission."
        //     );
        // },

        // ============================================================
        // UPDATE HEADER
        // ============================================================

        _saveHeaderChanges: async function () {
            if (
                !this._sRequestId ||
                this._sRequestId === "new"
            ) {
                throw new Error(
                    "Invalid Request ID. Save the request as a new draft first."
                );
            }

            var oPayload = this._getRequestPayload();

            var oBinding = this._oModel.bindContext(
                "/DiscountRequests(" + this._sRequestId + ")"
            );

            await oBinding.requestObject();

            var oContext = oBinding.getBoundContext();

            Object.keys(oPayload).forEach(function (sKey) {
                oContext.setProperty(sKey, oPayload[sKey]);
            });
        },

        // ============================================================
        // DELETE REMOVED LINES
        // ============================================================

        _deleteRemovedLines: async function () {
            for (
                var i = 0;
                i < this._aDeletedLineIds.length;
                i++
            ) {
                var oBinding = this._oModel.bindContext(
                    "/DiscountLines(" + this._aDeletedLineIds[i] + ")"
                );

                await oBinding.requestObject();

                var oContext = oBinding.getBoundContext();

                if (oContext) {
                    await oContext.delete("$auto");
                }
            }

            this._aDeletedLineIds = [];
        },

        // ============================================================
        // SAVE LINES
        // ============================================================

        _saveLines: async function () {
            var aLines = this._oLineModel.getProperty("/items") || [];
            var aCreatedContexts = [];

            for (var i = 0; i < aLines.length; i++) {
                var oLine = aLines[i];
                var oPayload = this._getLinePayload(oLine);

                if (oLine.ID) {
                    var oBinding = this._oModel.bindContext(
                        "/DiscountLines(" + oLine.ID + ")"
                    );

                    await oBinding.requestObject();

                    var oContext = oBinding.getBoundContext();

                    Object.keys(oPayload).forEach(function (sKey) {
                        oContext.setProperty(sKey, oPayload[sKey]);
                    });

                } else {
                    oPayload.discountRequest_ID = this._sRequestId;

                    var oCreatedContext = this._oModel
                        .bindList("/DiscountLines")
                        .create(oPayload);

                    aCreatedContexts.push(oCreatedContext);
                }
            }

            await this._oModel.submitBatch("$auto");

            await Promise.all(
                aCreatedContexts.map(function (oContext) {
                    return oContext.created();
                })
            );
        },

        // ============================================================
        // SAVE DRAFT
        // ============================================================

        onSaveDraft: async function () {
            var oView = this.getView();
            var oModel = this._oModel;

            try {
                oView.setBusy(true);

                var oPayload = this._getRequestPayload();

                if (!this._sRequestId) {
                    var oListBinding = oModel.bindList(
                        "/DiscountRequests"
                    );

                    var oCreatedContext = oListBinding.create(oPayload);

                    await oModel.submitBatch("$auto");
                    await oCreatedContext.created();

                    var oCreatedRequest =
                        await oCreatedContext.requestObject();

                    this._sRequestId = oCreatedRequest.ID;

                    if (!this._sRequestId) {
                        throw new Error(
                            "Draft was created, but its Request ID " +
                            "was not returned."
                        );
                    }

                    await this._saveLines();

                    await oModel.submitBatch("$auto");

                    this._sMode = "edit";

                    MessageToast.show(
                        "Draft saved successfully."
                    );

                    this._oRouter.navTo(
                        "objectPage",
                        {
                            mode: "edit",
                            requestId: this._sRequestId
                        },
                        true
                    );

                } else {
                    await this._saveHeaderChanges();
                    await this._deleteRemovedLines();
                    await this._saveLines();

                    await oModel.submitBatch("$auto");

                    MessageToast.show(
                        "Draft updated successfully."
                    );
                }

            } catch (oError) {
                console.error("Save Draft Error:", oError);

                MessageBox.error(
                    oError.message ||
                    "Unable to save the draft."
                );

            } finally {
                oView.setBusy(false);
            }
        },

        // ============================================================
        // SUBMIT FOR APPROVAL
        // ============================================================


onSubmit: function () {

    if (!this._validateSubmission()) {
        return;
    }

    MessageBox.confirm(
        "Do you want to submit this request for approval?",
        {
            title: "Submit Request",

            onClose: async function (sAction) {

                if (sAction !== MessageBox.Action.OK) {
                    return;
                }

                var oView = this.getView();

                try {
                    oView.setBusy(true);

                    // STEP 1: Create request if it is new
                    if (!this._sRequestId) {

                        var oPayload = this._getRequestPayload();

                        var oListBinding = this._oModel.bindList(
                            "/DiscountRequests"
                        );

                        var oCreatedContext =
                            oListBinding.create(oPayload);

                        await this._oModel.submitBatch("$auto");

                        await oCreatedContext.created();

                        var oCreatedRequest =
                            await oCreatedContext.requestObject();

                        this._sRequestId = oCreatedRequest.ID;

                        if (!this._sRequestId) {
                            throw new Error(
                                "Request ID was not generated."
                            );
                        }

                        // Switch to edit mode after creation
                        this._sMode = "edit";
                    }

                    // STEP 2: Save header changes
                    else {
                        await this._saveHeaderChanges();
                    }

                    // STEP 3: Delete removed lines
                    await this._deleteRemovedLines();

                    // STEP 4: Save line items
                    await this._saveLines();

                    // STEP 5: Submit pending changes
                    await this._oModel.submitBatch("$auto");

                    // STEP 6: Call CAP submit action
                    var oActionBinding =
                        this._oModel.bindContext(
                            "/DiscountRequests(" +
                            this._sRequestId +
                            ")/DealerService.submitDiscount(...)"
                        );

                    await oActionBinding.execute("$auto");

                    // STEP 7: Success
                    MessageBox.success(
                        "Discount request submitted successfully!\n\n" +
                        "The request is now pending approval.",
                        {
                            title: "Submission Successful",

                            onClose: function () {
                                this._oRouter.navTo("requests");
                            }.bind(this)
                        }
                    );

                } catch (oError) {

                    console.error(
                        "Discount Submission Error:",
                        oError
                    );

                    MessageBox.error(
                        "Unable to submit request:\n" +
                        (oError.message || oError)
                    );

                } finally {
                    oView.setBusy(false);
                }

            }.bind(this)
        }
    );
},


        // ============================================================
        // NAVIGATION
        // ============================================================

        onNavBack: function () {
            this._oRouter.navTo("requests");
        }

    });
});
