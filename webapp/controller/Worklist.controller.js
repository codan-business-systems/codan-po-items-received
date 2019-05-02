sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"codan/zpoitemsreceived/model/utils",
	"sap/m/GroupHeaderListItem",
	"sap/m/MessageBox",
	"sap/m/MessageToast"
], function (Controller, JSONModel, utils, GHLI, MessageBox, MessageToast) {
	"use strict";

	return Controller.extend("codan.zpoitemsreceived.controller.Worklist", {
		//formatters: formatters,

		onInit() {
			// Get reference to ODataModel
			this._oODataModel = this.getOwnerComponent().getModel();
			this._oODataModel.setUseBatch(true);

			// View model for view state
			this._oViewModel = new JSONModel({
				busy: false,
				selectedCount: 0,
				totalItemCount: 0
			});
			this.getView().setModel(this._oViewModel, "viewModel");
		},

		createGroupHeader: function (oGroup) {
			return new GHLI({
				title: oGroup.key,
				upperCase: false
			});
		},

		navToGoodsReceipt(event) {
			const oSourceObject = event.getSource().getBindingContext().getObject(),
				oNav = sap.ushell.Container.getService("CrossApplicationNavigation");

			var hash = (oNav && oNav.hrefForExternal({
				target: {
					semanticObject: "GoodsReceipt",
					action: "create"
				},
				params: {
					"purchaseOrder": oSourceObject.OrderNumber,
					"deliveryDocket": oSourceObject.DeliveryDocket
				}
			})) || "";

			oNav.toExternal({
				target: {
					shellHash: hash
				}
			});

		},
		
		onTableSelectionChange() {
			var oTable = this._byId("worklist");
			var aSelectedItems = oTable.getSelectedItems();
			const aAllItems = oTable.getItems();
			var aSelectedDockets = [];
			
			aSelectedItems.forEach((oListItem) => {
				var deliveryDocket = oListItem.getBindingContext().getObject().DeliveryDocket;
				if (aSelectedDockets.indexOf(deliveryDocket) >= 0) {
					return;
				}
				aAllItems.filter((oItem) => {
					var oItemContext = oItem.getBindingContext();
					return oItemContext && oItemContext.getObject().DeliveryDocket === deliveryDocket && !oItem.getSelected();
				})
				.forEach((oItem) => oItem.setSelected(true));
				
				aSelectedDockets.push(deliveryDocket);
				
			});
			this._oViewModel.setProperty("/selectedCount", aSelectedDockets.length);
			this._oViewModel.setProperty("/totalItemCount", oTable.getSelectedItems().length);
			
		},
		
		clearSelections() {
			this._byId("worklist").removeSelections(true);
			this.onTableSelectionChange();			
		},
		
		confirmDeleteSelectedItems() {
			var oTable = this._byId("worklist");
			var aSelectedItems = oTable.getSelectedItems();
			var iDocketCount = this._oViewModel.getProperty("/selectedCount");
			MessageBox.confirm(`Are you sure you want to delete ${aSelectedItems.length} item(s) on ${iDocketCount} docket(s)?`, {
				onClose: (oAction) => {
					if (oAction === MessageBox.Action.OK) {
						this._deleteSelectedItems(aSelectedItems);
					}
				}
			});
		},
		
		_deleteSelectedItems(aSelectedItems) {
			
			// Update oDataModel in batch
			const sDeferredGroupId = "removeSelectedItems";
			this._oODataModel.setDeferredGroups([sDeferredGroupId]);
			const oRequestParams = {
				groupId: sDeferredGroupId
			};
			aSelectedItems
				.map(oTableItem => oTableItem.getBindingContextPath())
				.forEach(sItemPath => {
					this._oODataModel.remove(sItemPath, oRequestParams);
				});

			// Submit changes
			this._setBusy(true);
			this._oODataModel.submitChanges({
				groupId: sDeferredGroupId,
				success: (oData) => {
					this._setBusy(false);
					if (!this._handleBatchResponseAndReturnErrorFlag(oData)) {
						MessageToast.show(`${aSelectedItems.length} item(s) removed`);
					}
					this._resetODataModel();
					this.onTableSelectionChange();
				},
				error: this._handleSimpleODataError.bind(this)
			});
		},
		
		_handleBatchResponseAndReturnErrorFlag(oData) {
			let sErrorMessage = "";
			if (oData && oData.__batchResponses) {
				for (var x = 0; x < oData.__batchResponses.length; x++) {
					var oResponse = oData.__batchResponses[x];
					if ((oResponse.statusCode && oResponse.statusCode !== "200") || (!oResponse.statusCode && oResponse.response && oResponse.response
							.statusCode !== "200")) {
						try {
							var response = JSON.parse(oResponse.response.body);
							if (response.error && response.error.message) {
								sErrorMessage = response.error.message.value;
							}
						} catch (err) {
							sErrorMessage = "Unexpected error type/format in batch response.";
						}
					}
				}
			} else {
				sErrorMessage = "Unexpected problem / missing data in batch response.";
			}

			// Handle error
			if (sErrorMessage) {
				MessageBox.error(sErrorMessage);
				return true;
			} else {
				return false;
			}
		},
		
		_handleSimpleODataError(oError) {
			this._setBusy(false);
			this._resetODataModel();
			var sMessage = utils.parseError(oError);
			MessageBox.error(sMessage);
		},
		
		_resetODataModel() {
			this._oODataModel.resetChanges();
		},
		
		_byId(sControlId) {
			return this.getView().byId(sControlId);
		},
		
		_setBusy(bBusy) {
			this._oViewModel.setProperty("/busy", bBusy);
		}
	});
});