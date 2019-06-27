jQuery.sap.registerModulePath("codan.z_ie11_polyfill", "/sap/bc/ui5_ui5/sap/z_ie11_polyfill");
jQuery.sap.registerModulePath("codan.zsendemail", "/sap/bc/ui5_ui5/sap/z_send_email");

sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"codan/zpoitemsreceived/model/models",
	"codan/z_ie11_polyfill/Component"
], function (UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("codan.zpoitemsreceived.Component", {

		metadata: {
			manifest: "json",
			includes: ["css/style.css"]
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// enable routing
			this.getRouter().initialize();

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
		}
	});
});