sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/UIComponent",
    "com/cnhi/btp/prapproval/model/ReqHelper",
], function (Controller, UIComponent, ReqHelper) {
    "use strict";

    return Controller.extend("com.cnhi.btp.prapproval.controller.BaseController", {
        /**
         * Convenience method for accessing the router.
         * @public
         * @returns {sap.ui.core.routing.Router} the router for this component
         */
        getRouter: function () {
            return UIComponent.getRouterFor(this);
        },

        /**
         * Convenience method for getting the view model by name.
         * @public
         * @param {string} [sName] the model name
         * @returns {sap.ui.model.Model} the model instance
         */
        getModel: function (sName) {
            return this.getView().getModel(sName) ? this.getView().getModel(sName) : this.getOwnerComponent().getModel(sName);
        },

        /**
         * Convenience method for setting the view model.
         * @public
         * @param {sap.ui.model.Model} oModel the model instance
         * @param {string} sName the model name
         * @returns {sap.ui.mvc.View} the view instance
         */
        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        /**
         * Getter for the resource bundle.
         * @public
         * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
         */
        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },
        /**
         * Set busy indicators for the controls
         */
        loadBusyIndicator: function (sName, bIsBusy) {
            var oControl = this.getView().byId(sName);
            oControl = oControl ? oControl : sap.ui.getCore().byId(sName);
            oControl.setBusy(bIsBusy);
        },
        /**
         * Get UI control
         */
        getControl: function (sId) {
            var oControl = this.getView().byId(sId);
            oControl = oControl ? oControl : sap.ui.getCore().byId(sId);
            return oControl;
        },

        getIconForMimeType: function(sMimeType) {
            return sap.ui.core.IconPool.getIconForMimeType(sMimeType)
        },

        _getPRListPromise: function (busyIndicatorId) {
            var that = this;
            return new Promise((resolve, reject) => {
                var oLocalModel = that.getModel('LocalModel');
                var oDataModel = that.getModel();
                var aFinal = [];
                that.loadBusyIndicator(busyIndicatorId,true);
                oDataModel.read("/ebanSet",{
                    success: function(oData){
                        that.loadBusyIndicator(busyIndicatorId,false);
                        if(oData.results.length > 0){
                            var aUniquePRs = [...new Set(oData.results.map(function(el){
                                return el.Banfn;
                            }))];
                            for(var i=0; i<aUniquePRs.length; i++){
                                var aItems = oData.results.filter(function(el){
                                    return el.Banfn === aUniquePRs[i];
                                });
                                if(aItems.length > 0){
                                    var oHeader = aItems[0];
                                    oHeader.Items = $.extend(true,[],aItems);
                                    
                                    oHeader.Preis = 0;
                                    oHeader['HasComment'] = oHeader['HasComment']  ? oHeader['HasComment'] : false;
                                    oHeader['HasDocument'] = oHeader['HasDocument']  ? oHeader['HasDocument'] : false;
                                    for (const item of oHeader.Items) {
                                        item['HasComment'] = item['HasComment']  ? item['HasComment'] : false;
                                        item['HasDocument'] = item['HasDocument']  ? item['HasDocument'] : false;
                                        item['HasItemComment'] = item['HasItemComment']  ? item['HasItemComment'] : false;
                                        try {
                                            var preis = parseFloat(item.Preis);
                                            oHeader.Preis = oHeader.Preis + preis;
                                        } catch (error) {
                                            
                                        }
                                    }
                                    
                                    aFinal.push(oHeader);
                                }
                            }
                            oLocalModel.setProperty("/EbanResults", $.extend(true,[],aFinal));
                            that._getPRFromCAPMPromise(busyIndicatorId)
                                .then(res => resolve(res))
                                .catch(err => reject(err));
                        }
                    }
                });
            });
        },

        _getPRFromCAPMPromise: function (busyIndicatorId) {
            var that = this;
            return new Promise((resolve, reject) => {
                var sServiceUrl = this.getOwnerComponent().getModel("PRApprovalCAP").sServiceUrl;
                var oLocalModel = this.getModel('LocalModel');
                var sLoggedInUserID = oLocalModel.getProperty("/LoggedInUserID");
                var aResults = oLocalModel.getProperty("/EbanResults");
                var sUrl = sServiceUrl + "PurchaceReqSet";
                var aFinal = [];
                that.loadBusyIndicator(busyIndicatorId, true);
                ReqHelper.sendGetReq(sUrl).then(function (oRes) {
                    that.loadBusyIndicator(busyIndicatorId, false);
                    //if(oRes.value.length > 0){
                    for (var i = 0; i < aResults.length; i++) {
                        var iIdx = oRes.value.findIndex(function (el) {
                            return el.pr === aResults[i].Banfn;
                        });
                        if (iIdx >= 0) {
                            if (oRes.value[iIdx].nextApprover === sLoggedInUserID && oRes.value[iIdx].status === aResults[i]['Eprofile']) {
                                aResults[i]['IsRequestor'] = false;
                                aResults[i]['IsApprover'] = true;
                                aResults[i]['id'] = oRes.value[iIdx].id;
                                aResults[i]['nextApprover'] = oRes.value[iIdx].nextApproverFrgzu === aResults[i].Frgzu ? oRes.value[iIdx].nextApprover : "";
                                aResults[i]['uistatus'] = 'Waiting for ' + oRes.value[iIdx].status + ' approval';
                                aResults[i]['uistatusstate'] = 'Indication04';
                                aResults[i]['status'] = oRes.value[iIdx].status;
                                aFinal.push(aResults[i]);
                            } else if (oRes.value[iIdx].nextApprover !== sLoggedInUserID && oRes.value[iIdx].status !== aResults[i]['Eprofile']) {
                                aResults[i]['IsRequestor'] = false;
                                aResults[i]['IsApprover'] = true;
                                aResults[i]['id'] = oRes.value[iIdx].id;
                                aResults[i]['nextApprover'] = oRes.value[iIdx].nextApproverFrgzu === aResults[i].Frgzu ? oRes.value[iIdx].nextApprover : "";
                                aResults[i]['uistatus'] = 'Waiting for ' + aResults[i]['Eprofile'] + ' approval';
                                aResults[i]['uistatusstate'] = 'Indication04';
                                aResults[i]['status'] = aResults[i]['Eprofile'];
                                aFinal.push(aResults[i]);
                            } else if (oRes.value[iIdx].requestor === sLoggedInUserID) {
                                aResults[i]['IsRequestor'] = true;
                                aResults[i]['IsApprover'] = true;
                                aResults[i]['id'] = oRes.value[iIdx].id;
                                aResults[i]['nextApprover'] = oRes.value[iIdx].nextApproverFrgzu === aResults[i].Frgzu ? oRes.value[iIdx].nextApprover : "";
                                aResults[i]['uistatus'] = 'Waiting for ' + oRes.value[iIdx].status + ' approval';
                                aResults[i]['uistatusstate'] = 'Warning';
                                aResults[i]['status'] = oRes.value[iIdx].status;
                                aFinal.push(aResults[i]);
                            }
                        } else {
                            if (aResults[i]['Eprofile'] === 'N' || aResults[i]['Eprofile'] === 'L0') {
                                aResults[i]['uistatus'] = aResults[i]['Eprofile'];
                                aResults[i]['uistatusstate'] = 'Information';
                            } else {
                                aResults[i]['uistatus'] = 'Waiting for ' + aResults[i]['Eprofile'] + ' approval';
                                aResults[i]['uistatusstate'] = 'Warning';
                                aResults[i]['IsApprover'] = true;
                                aResults[i]['IsRequestor'] = false;
                            }
                            aFinal.push(aResults[i]);
                        }
                    }
                    oLocalModel.setProperty("/Results", $.extend(true, [], aFinal));
                    //that._rebindTable();
                    //}
                    resolve();
                }.bind(this))
                    .catch(function (response) {
                        that.loadBusyIndicator(busyIndicatorId, false);
                        reject(response)
                    }.bind(this));
            });
        },
    });
});
