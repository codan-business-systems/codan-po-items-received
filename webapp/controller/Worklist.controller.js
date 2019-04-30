sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"codan/zpoitemsreceived/model/utils",
	"sap/m/GroupHeaderListItem"
], function (Controller, JSONModel, utils, GHLI) {
	"use strict";

	return Controller.extend("codan.zpoitemsreceived.controller.Worklist", {
		//formatters: formatters,

		onInit() {
			// Get reference to ODataModel
			this._oODataModel = this.getOwnerComponent().getModel();

			// View model for view state
			this._oViewModel = new JSONModel({
				busy: false
			});
			this.getView().setModel(this._oViewModel, "viewModel");
		},
		
		createGroupHeader: function (oGroup) {
			return new GHLI({
				title: oGroup.key,
				upperCase: false
			});
		}
	});
});