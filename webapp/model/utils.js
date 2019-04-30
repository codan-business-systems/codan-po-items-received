sap.ui.define([
], function () {
	"use strict";
	return {
		/**
		 * Parse an error string or object returning a string with error message
		 *
		 * @param {(string|object)} [error] - Error object or string or null/undefined
		 * @param {string} [sActionContext] - Description of activity being performed
		 * @return {string} Error message text
		 */
		parseError: function(error, sActionContext) {
			var sErrorMessage = "";
			if (!error) {
				sErrorMessage = "";
			} else if (typeof error === "string") {
				sErrorMessage = error;
			} else {
				// Attempt to parse error to get to API message text
				if (error.responseText) {
					try {
						var responseText = JSON.parse(error.responseText);
						if (responseText.error && responseText.error.message) {
							sErrorMessage = responseText.error.message.value;
						}
					} catch (err) {
						// responseText is not JSON - probably XML which doesn't look like it can
						// be reliably parsed.  Handle the most common errors here
						if (error.statusCode && error.statusCode === 504) {
							// Error 504 - Gateway timeout.
							sErrorMessage = "504. The connection to the server timed out.";
						} else if (error.statusCode && error.statusCode === 503) {
							// Error 503 - Service unavailable.
							sErrorMessage = "503. Service unavailable";
						}
					}
				}
				
				// If unable to parse application error message, fall back to generic error
				if (!sErrorMessage) {
					sErrorMessage = "Undefined error " + sActionContext;
				}
			}
			
			return sErrorMessage;
		},
		
		/**
		 * Recursively looks for a control in the parents of a control by matching
		 * the search term against part of the control id or the whole control
		 * type (class name).
		 * 
		 * @param {string} sSearchTerm - Class name or part of id
		 * @param {sap.ui.core.Control} oChild - Starting point for search
		 * @returns {sap.ui.core.Control} - Control found
		 */		
		findControlInParents: function(sSearchTerm, oChild) {
			var oMaybeTarget = oChild;
			while (oMaybeTarget.getMetadata()._sClassName !== sSearchTerm
				&& oMaybeTarget.getId().indexOf(sSearchTerm) < 0) {
				oMaybeTarget = oMaybeTarget.getParent();
				if (!oMaybeTarget) {
					throw new Error("Could not find parent matching '" + sSearchTerm + "' for control " + oChild.getId());
				}
			}
			return oMaybeTarget;
		},
		
		/**
		 * Look for a control in an aggregation of controls by matching the search term
		 * against part of the control id or the whole control type (class name).
		 * 
		 * Returns only first instance found.
		 *
		 * @param {string} sSearchTerm - Class name or part of id
		 * @param {sap.ui.core.Control[]} aControls - Array of controls
		 * @returns {sap.ui.core.Control} - Control found
		 */
		findControlInAggregation: function(sSearchTerm, aControls) {
			if (!Array.isArray(aControls)) {
				throw new Error("Invalid parameter 'aControls' - expected an array");
			}
			var oControl;
			var index = aControls.findIndex(function(oCandidate) {
				return oCandidate.getId().indexOf(sSearchTerm) > -1
					|| oCandidate.getMetadata()._sClassName === sSearchTerm;
			});
			if (index > -1) {
				oControl = aControls[index];
			}
			return oControl;
		}
	};
});
