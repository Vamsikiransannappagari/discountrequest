
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

        onInit: function () {

            this._oModel = this.getOwnerComponent().getModel();
            this._oRouter = this.getOwnerComponent().getRouter();

            this._sMode = "create";
            this._sRequestId = null;

            this._aModels = [];
            this._aPriceConditions = [];
            this._aDeletedLineIds = [];

            this._oLineModel = new JSONModel({
                items: []
            });

            this.getView().setModel(this._oLineModel, "lines");

            this._oRouter
                .getRoute("objectPage")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        // Route Handling
        _onRouteMatched: async function (oEvent) {

            var oArgs = oEvent.getParameter("arguments");

            this._sMode = oArgs.mode;
            this._sRequestId = oArgs.requestId;

            this._clearForm();

            await this._loadMasterData();

            if (this._sMode === "create") {

                this._setEditMode(true);
                this.byId("requestDate").setValue(this._today());

                return;
            }

            await this._loadRequest(this._sRequestId);

            this._setEditMode(this._sMode === "edit");
        },

        // Today's Date
        _today: function () {

            var oDate = new Date();
            var iOffset = oDate.getTimezoneOffset();

            oDate = new Date(
                oDate.getTime() - iOffset * 60000
            );

            return oDate.toISOString().slice(0, 10);
        },

        // Clear Form
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
                "totalNetPrice",
                "overallMargin"
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

            var oTable = this.byId("lineItemsTable");

            if (oTable) {
                oTable.removeAllItems();
            }

            this._aDeletedLineIds = [];

            this._oLineModel.setData({
                items: []
            });
        },

        // Load Master Data
        _loadMasterData: async function () {

            try {

                var aResults = await Promise.all([
                    this._readEntity("/Dealers"),
                    this._readEntity("/Regions"),
                    this._readEntity("/SalesChannels"),
                    this._readEntity("/Models"),
                    this._readEntity("/PriceConditions")
                ]);

                this._aModels = aResults[3];

                // Keep active conditions and retain an existing
                // inactive condition when displaying an old request.
                this._aPriceConditions = aResults[4];

                this._fillSelect(
                    "dealerSelect",
                    aResults[0],
                    "dealerName"
                );

                this._fillSelect(
                    "regionSelect",
                    aResults[1],
                    "regionName"
                );

                this._fillSelect(
                    "salesChannelSelect",
                    aResults[2],
                    "channelName"
                );

            } catch (oError) {

                MessageBox.error(
                    "Unable to load master data: " + oError.message
                );

                throw oError;
            }
        },

        // Read Entity Collection
        _readEntity: async function (sPath) {

            var oBinding = this._oModel.bindList(sPath);

            var aContexts = await oBinding.requestContexts(0, 1000);

            return aContexts.map(function (oContext) {
                return oContext.getObject();
            });
        },

        // Fill Dropdown
        _fillSelect: function (sControlId, aData, sTextProperty) {

            var oSelect = this.byId(sControlId);

            if (!oSelect) {
                return;
            }

            oSelect.removeAllItems();

            oSelect.addItem(new Item({
                key: "",
                text: "Select"
            }));

            aData.forEach(function (oEntry) {

                oSelect.addItem(new Item({
                    key: oEntry.ID,
                    text: oEntry[sTextProperty] || ""
                }));

            });

            oSelect.setSelectedKey("");
        },

        // Load Existing Request
        _loadRequest: async function (sRequestId) {

            try {

                var oBinding = this._oModel.bindContext(
                    "/DiscountRequests(" + sRequestId + ")"
                );

                var oContext = await oBinding.requestObject();

                this.byId("requestNumber").setValue(
                    oContext.requestNumber || ""
                );

                this.byId("requestDate").setValue(
                    oContext.requestDate || ""
                );

                this.byId("reason").setValue(
                    oContext.reason || ""
                );

                this.byId("supportingDetails").setValue(
                    oContext.supportingDetails || ""
                );

                this.byId("validFrom").setValue(
                    oContext.validFrom || ""
                );

                this.byId("validTo").setValue(
                    oContext.validTo || ""
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

                this.byId("totalBasePrice").setValue(
                    oContext.totalBasePrice || ""
                );

                this.byId("totalDiscountPrice").setValue(
                    oContext.totalDiscountPrice || ""
                );

                this.byId("totalNetPrice").setValue(
                    oContext.totalNetPrice || ""
                );

                this.byId("overallMargin").setValue(
                    oContext.overallMargin || ""
                );

                await this._loadRequestLines(sRequestId);

            } catch (oError) {

                MessageBox.error(
                    "Unable to load request: " + oError.message
                );

                throw oError;
            }
        },

        // Load Request Lines
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
                    basePrice: oLine.basePrice,
                    costPrice: oLine.costPrice,
                    taxPercentage: oLine.taxPercentage,
                    dealerMargin: oLine.dealerMargin,
                    discountType: oLine.discountType,
                    discountPercentage: oLine.discountPercentage,
                    discountAmount: oLine.discountAmount,
                    netPrice: oLine.netPrice,
                    priceCondition_ID: oLine.priceCondition_ID
                };
            });

            this._oLineModel.setData({
                items: aLines
            });

            this._renderLines();
        },

        // Add Line Item
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
                discountPercentage: 0,
                netPrice: 0,
                priceCondition_ID: ""
            });

            this._oLineModel.setProperty("/items", aItems);

            this._renderLines();
        },

        // Render Line Items
        _renderLines: function () {

            var oTable = this.byId("lineItemsTable");

            if (!oTable) {
                return;
            }

            oTable.removeAllItems();

            var aItems = this._oLineModel.getProperty("/items") || [];

            aItems.forEach(function (oLine, iIndex) {

                // Model Dropdown
                var oModelSelect = new Select({
                    width: "100%",
                    selectedKey: oLine.model_ID || "",
                    enabled: this._sMode !== "display",
                    items: [
                        new Item({
                            key: "",
                            text: "Select Model"
                        })
                    ]
                });

                this._aModels.forEach(function (oModel) {

                    oModelSelect.addItem(new Item({
                        key: oModel.ID,
                        text: oModel.modelName || ""
                    }));

                });

                oModelSelect.attachChange(function (oEvent) {

                    var sModelId = oEvent.getSource().getSelectedKey();

                    this._updateLine(iIndex, "model_ID", sModelId);

                    // A condition from another model must not remain selected.
                    this._updateLine(iIndex, "priceCondition_ID", "");
                    this._updateLine(iIndex, "basePrice", 0);
                    this._updateLine(iIndex, "costPrice", 0);
                    this._updateLine(iIndex, "taxPercentage", 0);
                    this._updateLine(iIndex, "dealerMargin", 0);

                    this._renderLines();

                }.bind(this));

                // Price Condition Dropdown
                var oPriceConditionSelect = new Select({
                    width: "100%",
                    selectedKey: oLine.priceCondition_ID || "",
                    enabled: this._sMode !== "display" && !!oLine.model_ID,
                    items: [
                        new Item({
                            key: "",
                            text: oLine.model_ID
                                ? "Select Price Condition"
                                : "Select Model First"
                        })
                    ]
                });

                var aMatchingConditions = this._aPriceConditions.filter(
                    function (oCondition) {

                        var bSameModel =
                            oCondition.model_ID === oLine.model_ID;

                        var bActive =
                            oCondition.status === "Active";

                        var bAlreadySelected =
                            oCondition.ID === oLine.priceCondition_ID;

                        return bSameModel && (bActive || bAlreadySelected);
                    }
                );

                aMatchingConditions.forEach(function (oCondition) {

                    var sConditionText =
                        (oCondition.conditionCode || "Price Condition") +
                        " | ₹" +
                        Number(oCondition.basePrice || 0).toFixed(2);

                    oPriceConditionSelect.addItem(new Item({
                        key: oCondition.ID,
                        text: sConditionText
                    }));

                });

                oPriceConditionSelect.attachChange(function (oEvent) {

                    var sConditionId =
                        oEvent.getSource().getSelectedKey();

                    var oCondition = this._aPriceConditions.find(
                        function (oEntry) {
                            return oEntry.ID === sConditionId;
                        }
                    );

                    this._updateLine(
                        iIndex,
                        "priceCondition_ID",
                        sConditionId
                    );

                    if (oCondition) {

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
                    }

                    this._renderLines();

                }.bind(this));

                // Quantity
                var oQuantity = new Input({
                    value: String(oLine.quantity == null ? 1 : oLine.quantity),
                    type: "Number",
                    width: "100%",
                    editable: this._sMode !== "display"
                });

                oQuantity.attachChange(function (oEvent) {

                    this._updateLine(
                        iIndex,
                        "quantity",
                        Number(oEvent.getSource().getValue())
                    );

                }.bind(this));

                // Base Price
                var oBasePrice = new Input({
                    value: String(oLine.basePrice || 0),
                    type: "Number",
                    width: "100%",
                    editable: false
                });

                // Discount Type
                var oDiscountType = new Select({
                    width: "100%",
                    selectedKey: oLine.discountType || "Percentage",
                    enabled: this._sMode !== "display",
                    items: [
                        new Item({
                            key: "Percentage",
                            text: "Percentage"
                        }),
                        new Item({
                            key: "Amount",
                            text: "Amount"
                        })
                    ]
                });

                oDiscountType.attachChange(function (oEvent) {

                    this._updateLine(
                        iIndex,
                        "discountType",
                        oEvent.getSource().getSelectedKey()
                    );

                }.bind(this));

                // Discount Value
                var oDiscountValue = new Input({
                    value: String(oLine.discountPercentage || 0),
                    type: "Number",
                    width: "100%",
                    editable: this._sMode !== "display"
                });

                oDiscountValue.attachChange(function (oEvent) {

                    this._updateLine(
                        iIndex,
                        "discountPercentage",
                        Number(oEvent.getSource().getValue())
                    );

                }.bind(this));

                // Net Price
                var oNetPrice = new Text({
                    text: "₹" + Number(oLine.netPrice || 0).toFixed(2)
                });

                oTable.addItem(new ColumnListItem({
                    cells: [
                        oModelSelect,
                        oPriceConditionSelect,
                        oQuantity,
                        oBasePrice,
                        oDiscountType,
                        oDiscountValue,
                        oNetPrice
                    ]
                }));

            }.bind(this));
        },

        // Update Local Line
        _updateLine: function (iIndex, sProperty, vValue) {

            this._oLineModel.setProperty(
                "/items/" + iIndex + "/" + sProperty,
                vValue
            );
        },

        // Remove Selected Line
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
        },

        // Set Edit Mode
        _setEditMode: function (bEditable) {

            [
                "reason",
                "supportingDetails",
                "validFrom",
                "validTo"
            ].forEach(function (sId) {

                var oControl = this.byId(sId);

                if (oControl) {
                    oControl.setEditable(bEditable);
                }

            }.bind(this));

            this.byId("requestNumber").setEditable(false);
            this.byId("requestDate").setEditable(false);

            [
                "dealerSelect",
                "regionSelect",
                "salesChannelSelect"
            ].forEach(function (sId) {

                var oControl = this.byId(sId);

                if (oControl) {
                    oControl.setEnabled(bEditable);
                }

            }.bind(this));

            [
                "totalBasePrice",
                "totalDiscountPrice",
                "totalNetPrice",
                "overallMargin"
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

            this.byId("calculateButton").setVisible(bEditable);
            this.byId("validateButton").setVisible(bEditable);
            this.byId("saveDraftButton").setVisible(bEditable);
            this.byId("submitButton").setVisible(bEditable);

            this.byId("_IDGenButton3").setVisible(bEditable);
            this.byId("_IDGenButton5").setVisible(bEditable);

            this._renderLines();
        },

        // Build Request Payload
        _getRequestPayload: function () {

            return {
                requestDate: this.byId("requestDate").getValue(),
                reason: this.byId("reason").getValue(),
                supportingDetails: this.byId("supportingDetails").getValue(),
                validFrom: this.byId("validFrom").getValue(),
                validTo: this.byId("validTo").getValue(),
                dealer_ID: this.byId("dealerSelect").getSelectedKey(),
                region_ID: this.byId("regionSelect").getSelectedKey(),
                salesChannel_ID: this.byId("salesChannelSelect").getSelectedKey()
            };
        },

        // Validate Form and Mandatory Lines
        _validateForm: function () {

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

            if (oPayload.validFrom > oPayload.validTo) {
                MessageToast.show("Valid To must be after Valid From");
                return false;
            }

            var aLines = this._oLineModel.getProperty("/items") || [];

            if (aLines.length === 0) {
                MessageToast.show("Add at least one discount line");
                return false;
            }

            for (var i = 0; i < aLines.length; i++) {

                if (!aLines[i].model_ID) {
                    MessageToast.show(
                        "Select a Model in line " + (i + 1)
                    );
                    return false;
                }

                if (!aLines[i].priceCondition_ID) {
                    MessageToast.show(
                        "Select a Price Condition in line " + (i + 1)
                    );
                    return false;
                }

                if (!aLines[i].quantity || aLines[i].quantity <= 0) {
                    MessageToast.show(
                        "Enter a valid quantity in line " + (i + 1)
                    );
                    return false;
                }

                if (aLines[i].discountPercentage == null ||
                    aLines[i].discountPercentage < 0) {
                    MessageToast.show(
                        "Enter a valid discount value in line " + (i + 1)
                    );
                    return false;
                }
            }

            return true;
        },

        // Build Discount Line Payload
        _getLinePayload: function (oLine) {

            return {
                model_ID: oLine.model_ID,
                quantity: Number(oLine.quantity),
                basePrice: Number(oLine.basePrice || 0),
                costPrice: Number(oLine.costPrice || 0),
                taxPercentage: Number(oLine.taxPercentage || 0),
                dealerMargin: Number(oLine.dealerMargin || 0),
                discountType: oLine.discountType,
                discountPercentage: Number(oLine.discountPercentage || 0),
                priceCondition_ID: oLine.priceCondition_ID
            };
        },

        // Save Draft
        onSaveDraft: async function () {

            if (!this._validateForm()) {
                return;
            }

            try {

                var oPayload = this._getRequestPayload();

                var aLines = this._oLineModel.getProperty("/items") || [];

                if (this._sMode === "create") {

                    oPayload.lines = aLines.map(function (oLine) {
                        return this._getLinePayload(oLine);
                    }.bind(this));

                    var oListBinding = this._oModel.bindList(
                        "/DiscountRequests"
                    );

                    var oCreatedContext = oListBinding.create(oPayload);

                    await oCreatedContext.created();

                    var oCreatedRequest =
                        await oCreatedContext.requestObject();

                    var sGeneratedNumber =
                        oCreatedRequest.requestNumber || "";

                    MessageBox.success(
                        "Draft request created successfully.\n\n" +
                        "Request Number: " + sGeneratedNumber,
                        {
                            onClose: function () {
                                this._oRouter.navTo("requests");
                            }.bind(this)
                        }
                    );

                } else {

                    var oContextBinding = this._oModel.bindContext(
                        "/DiscountRequests(" + this._sRequestId + ")"
                    );

                    await oContextBinding.requestObject();

                    var oRequestContext =
                        oContextBinding.getBoundContext();

                    Object.keys(oPayload).forEach(function (sKey) {

                        oRequestContext.setProperty(
                            sKey,
                            oPayload[sKey]
                        );

                    });

                    // Delete lines removed by the user.
                    for (var i = 0; i < this._aDeletedLineIds.length; i++) {

                        var oDeleteBinding = this._oModel.bindContext(
                            "/DiscountLines(" +
                            this._aDeletedLineIds[i] +
                            ")"
                        );

                        await oDeleteBinding.getBoundContext()?.delete("$auto");
                    }

                    // Update existing lines or create new lines.
                    for (var j = 0; j < aLines.length; j++) {

                        var oLine = aLines[j];
                        var oLinePayload = this._getLinePayload(oLine);

                        if (oLine.ID) {

                            var oLineBinding = this._oModel.bindContext(
                                "/DiscountLines(" + oLine.ID + ")"
                            );

                            await oLineBinding.requestObject();

                            var oLineContext =
                                oLineBinding.getBoundContext();

                            Object.keys(oLinePayload).forEach(
                                function (sKey) {

                                    oLineContext.setProperty(
                                        sKey,
                                        oLinePayload[sKey]
                                    );

                                }
                            );

                        } else {

                            oLinePayload.discountRequest_ID =
                                this._sRequestId;

                            this._oModel.bindList(
                                "/DiscountLines"
                            ).create(oLinePayload);
                        }
                    }

                    await this._oModel.submitBatch("$auto");

                    MessageBox.success(
                        "Draft request updated successfully",
                        {
                            onClose: function () {
                                this._oRouter.navTo("requests");
                            }.bind(this)
                        }
                    );
                }

            } catch (oError) {

                MessageBox.error(
                    "Unable to save request: " +
                    (oError.message || oError)
                );
            }
        },

        // Calculate
        onCalculate: function () {

            MessageBox.information(
                "The selected Price Condition provides the pricing " +
                "details. Save the draft and submit it to run the " +
                "backend discount calculation."
            );
        },

        // Validate
        onValidate: function () {

            if (!this._validateForm()) {
                return;
            }

            MessageBox.information(
                "Required request fields, models, Price Conditions " +
                "and quantities are filled. Final margin validation " +
                "is performed by the backend during submission."
            );
        },

        // Submit for Approval
        onSubmit: function () {

            if (this._sMode === "create") {
                MessageToast.show(
                    "Save the Draft first, then submit it for approval"
                );
                return;
            }

            if (!this._validateForm()) {
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

                        try {

                            // Save pending UI edits before submission.
                            // Existing saved lines are already associated
                            // with this request.
                            await this.onSubmitSavePendingChanges();

                            var oContextBinding = this._oModel.bindContext(
                                "/DiscountRequests(" +
                                this._sRequestId +
                                ")/DealerService.submitDiscount(...)"
                            );

                            await oContextBinding.execute("$auto");

                            MessageToast.show(
                                "Request submitted for approval"
                            );

                            this._oRouter.navTo("requests");

                        } catch (oError) {

                            MessageBox.error(
                                "Unable to submit request: " +
                                (oError.message || oError)
                            );
                        }

                    }.bind(this)
                }
            );
        },

        // Save Pending Changes Before Submit
        onSubmitSavePendingChanges: async function () {

            var aLines = this._oLineModel.getProperty("/items") || [];

            // This handler saves edits to existing lines and creates
            // any new lines before the submit action is called.
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

                    this._oModel.bindList("/DiscountLines").create(oPayload);
                }
            }

            await this._oModel.submitBatch("$auto");
        },

        // Back Navigation
        onNavBack: function () {

            this._oRouter.navTo("requests");
        }

    });
});
