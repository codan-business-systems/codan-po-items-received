sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"codan/zpoitemsreceived/model/utils",
	"sap/m/GroupHeaderListItem",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"codan/zpoitemsreceived/model/formatters",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function (Controller, JSONModel, utils, GHLI, MessageBox, MessageToast, formatters, Filter, FilterOperator) {
	"use strict";

	return Controller.extend("codan.zpoitemsreceived.controller.Worklist", {
		formatters,
		_oSendEmail: null, // Send email reuse component

		onInit() {
			// Get reference to ODataModel
			this._oODataModel = this.getOwnerComponent().getModel();
			this._oODataModel.setUseBatch(true);
			this._oODataModel.setSizeLimit(10000);

			// View model for view state
			this._oViewModel = new JSONModel({
				busy: false,
				selectedCount: 0,
				totalItemCount: 0,
				search: {
					fields: [
						{
							property: "OrderNumber",
							label: "Purchase Order",
							searchSelected: true
						},
						{
							property: "SupplierId",
							label: "Supplier ID",
							searchSelected: true
						},
						{
							property: "SupplierName",
							label: "Supplier Name",
							searchSelected: true
						},
						{
							property: "PartNumber",
							label: "Material",
							searchSelected: true
						},
						{
							property: "Description",
							label: "Material Desc",
							searchSelected: true
						},
						{
							property: "DeliveryDocket",
							label: "Delivery Docket",
							searchSelected: true
						}
					],
					value: ""
				},
				changeDelivery: {
					purchaseOrder: "",
					oldDeliveryDocket: "",
					newDeliveryDocket: ""
				},
				urgentBoardOnly: false
			});
			this.getView().setModel(this._oViewModel, "viewModel");
			
			this._loadSendEmailComponent();
		},

		createGroupHeader(oGroup) {
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
		
		onSearch() {
			this.clearSelections();

			var aSearchFields = this._oViewModel.getProperty("/search/fields");
			var sSearchValue = this._oViewModel.getProperty("/search/value");
			var bUrgentBoardOnly = this._oViewModel.getProperty("/urgentBoardOnly");

			// Build filters for each active search field
			var aAllFilters = [];
			
			if (bUrgentBoardOnly) {
				aAllFilters.push(new Filter({
					path: "UrgentBoard",
					operator: FilterOperator.EQ,
					value1: bUrgentBoardOnly
				}));
			}
			if (sSearchValue) {
				var aFieldFilters = aSearchFields
					.filter(oSearchField => oSearchField.searchSelected)
					.map(oSearchField => new Filter({
						path: oSearchField.property,           
						operator: FilterOperator.Contains,
						value1: sSearchValue
					}));

				// If no field filters active, advise user that nothing will be selected
				if (!aFieldFilters.length) {
					MessageBox.warning("Nothing will be found because no search fields have been selected");
				}
				
				// Combine filters with OR statement not AND
				var oCombinedFilter = new Filter({
					filters: aFieldFilters,
					and: false
				});
				aAllFilters.push(oCombinedFilter);
			}
			
			// Apply filter
			var oTable = this._byId("worklist");
			var oBinding = oTable.getBinding("items");
			oBinding.filter(aAllFilters);
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
		
		toggleSearchSettings(oEvent) {
			var oPopover = this._byId("searchSettingsPopover");
			if (oPopover.isOpen()) {
				oPopover.close();
			} else {
				oPopover.openBy(oEvent.getSource());
			}
		},
		
		sendSelectedItemsEmail(aSelectedItems) {
			const oTable = this._byId("worklist");
			// aSelectedItems may be an event, so check if it is a managed object and ignore if so
			const oSelectedItems = aSelectedItems.getMetadata ? oTable.getSelectedItems() : aSelectedItems;

			// Get item data for selected items
			const aItemData = oSelectedItems
				.map(oTableItem => oTableItem.getBindingContextPath())
				.map(sPath => this._oODataModel.getProperty(sPath));

			// Build email content
			const sItemSeparator = "\r\n***********************************************************************\r\n";
			let sBody = aItemData
				.map(oItemData => this._getEmailBodyForItem(oItemData))
				.join(sItemSeparator);
			sBody = `${sItemSeparator}${sBody}${sItemSeparator}`;
			
			// Get single supplier (if there is only one)
			let sSingleSupplierName = aItemData[0].SupplierName;
			const oDifferentSupplier = aItemData.find(oItem => oItem.SupplierName !== sSingleSupplierName);
			if (oDifferentSupplier) {
				sSingleSupplierName = "";
			}
				
			// Build subject
			const sSubject = sSingleSupplierName
				? `Delivery received from ${sSingleSupplierName}`
				: "Multiple Deliveries";

			// Set properties and open send email dialog
			this._oSendEmail.setRecipients("");
			this._oSendEmail.setSubject(sSubject);
			this._oSendEmail.setBodyText(sBody);
			this._oSendEmail.showDialog();
		},
		
		_loadSendEmailComponent() {
			sap.ui.component({
				name: "codan.zsendemail",
				settings: {
					showButton: false // We provide our own button
				},
				componentData: {},
				async: true,
				manifestFirst: true  //deprecated from 1.49+
				// manifest: true    //SAPUI5 >= 1.49
			}).then(function (oComponent) {
				this._oSendEmail = oComponent;
				// oComponent.attachSent(this.onEmailSent.bind(this));
				// oComponent.attachCancelled(this.onEmailCancelled.bind(this));
				this.byId("componentSendEmail").setComponent(oComponent);
			}.bind(this)).catch(function(oError) {
				jQuery.sap.log.error(oError);
			});
		},
		
		_getEmailBodyForItem(oItemData) {
			// Replace undefined values in oItemData with "" into oData
			const oData = {};
			Object.entries(oItemData)
				.forEach(([key, value]) => {
					if (value) {
						oData[key] = value;
					} else {
						oData[key] = "";
					}
				});

			const aLines = [
				`Material:  ${oData.PartNumber} (${oData.Description})`,
				`Quantity received: ${oData.QuantityReceived} ${oData.UnitOfMeasure}`,
				`Purchase order:  ${oData.OrderNumber} / ${oData.ItemNumber}`,
				`Supplier:  ${oData.SupplierName} (${oData.SupplierId})`
			];
			return aLines.join("\r\n");
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
		},
		
		openChangeDeliveryDocketDialog() {
			
			var oSelectedTableItem = this._byId("worklist").getSelectedItems()[0],	//Button only visible if exactly 1 row is selected
				oItem	 = oSelectedTableItem.getBindingContext().getObject(),
				sItemPath = `/GoodsReceiptSet('${oItem.ProcessingId}')`;
			
			// Initialise the data
			this._oViewModel.setProperty("/changeDelivery", {
					purchaseOrder: oItem.OrderNumber,
					oldDeliveryDocket: oItem.DeliveryDocket,
					newDeliveryDocket: "",
					itemPath: sItemPath
			});
			
			// Create the dialog
			if (!this._oChangeDeliveryDocketDialog) {
				this._oChangeDeliveryDocketDialog = sap.ui.xmlfragment("codan.zpoitemsreceived.fragments.ChangeDeliveryDocket", this);
				this.getView().addDependent(this._oChangeDeliveryDocketDialog);
			}
			
			// Bind the dialog to the selected row
			this._oChangeDeliveryDocketDialog.bindElement(sItemPath); 
			
			this._oChangeDeliveryDocketDialog.open();
			
		},
		
		closeChangeDeliveryDocketDialog() {
			if (this._oChangeDeliveryDocketDialog) {
				this._oChangeDeliveryDocketDialog.close();
			}
		},
		
		changeDeliveryDocket() {
			var oChange = this._oViewModel.getProperty("/changeDelivery"),
				that = this;
			
			if (!oChange.newDeliveryDocket) {
				MessageBox.error("Enter a docket number before saving");
				return;
			}
			
			this._setBusy(true);
			
			this._oODataModel.setProperty(oChange.itemPath + "/DeliveryDocket", oChange.newDeliveryDocket);
			this._oODataModel.submitChanges({
				success: (oData) => {
					if (!this._handleBatchResponseAndReturnErrorFlag(oData)) {
						this._byId("worklist").getBinding("items").refresh();
						that.closeChangeDeliveryDocketDialog();
						this._setBusy(false);
						MessageToast.show("Delivery docket updated");
					} else {
						this._setBusy(false);
						this._oODataModel.resetChanges();
					}
					
				},
				error: this._handleSimpleODataError.bind(this)
			});
		},
		
		forceNewDeliveryDocketUpperCase(oEvent) {
			this._oViewModel.setProperty("/changeDelivery/newDeliveryDocket", oEvent.getParameter("newValue").toUpperCase());
		},
		
		onUrgentBoardOnlyChange(oEvent) {
			// Filter the worklist according to the new value of the urgent board flag.
			
		}
	});
});