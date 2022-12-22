sap.ui.define([
    "./BaseController",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History",
    "sap/ui/model/Sorter",
    "com/cnhi/btp/prapproval/model/ReqHelper"
],
    function (BaseController, MessageBox, Filter, FilterOperator, MessageToast, History, Sorter, ReqHelper) {
        "use strict";
        var sServiceUrl;
        return BaseController.extend("com.cnhi.btp.prapproval.controller.Main", {
            
            /* =========================================================== */
            /* lifecycle methods                                           */
            /* =========================================================== */

            /**
             * Called when this controller is instantiated.
             * @public
             */
            onInit: function () {
                sServiceUrl = this.getOwnerComponent().getModel("PRApprovalCAP").sServiceUrl;
                this.getRouter().getRoute("main").attachPatternMatched(this._onObjectMatched, this);
                
            },
            _onObjectMatched: function(){
                this._getPRList();
                //this._getPRFromCAPM();
            },

            onRowsUpdated: function(oEvent){
                var oSrc = oEvent.getSource();
                var oLocalModel = this.getModel('LocalModel');
                var iRows = oSrc.getBinding("rows").iLength;
                oLocalModel.setProperty("/tblTitle", this.getResourceBundle().getText("tblTitle",[iRows]));
            },

            onClearSortFilter: function(){
                var oTable = this.getControl('prTbl');
                var oBindingRows = oTable.getBinding('rows');
                oBindingRows.filter([]);
                oBindingRows.sort(null);
                this._resetFilterAndSortingState();
            },
            _resetFilterAndSortingState : function() {
                var oTable = this.getControl('prTbl');
                var aColumns = oTable.getColumns();
                for (var i = 0; i < aColumns.length; i++) {
                    aColumns[i].setSorted(false);
                    aColumns[i].setFiltered(false);
                }
            },

            /* =========================================================== */
            /* event handlers                                              */
            /* =========================================================== */

            /**
             * Event handler for table item
             * navigate to detail view
             * @param {sap.ui.base.Event} oEvent item press event
             * @public
             */
            onItemPress: function(oEvent){
                var oSrc = oEvent.getSource();
                var oBindingObj = oSrc.getBindingContext("LocalModel").getObject();
                this.getRouter().navTo("detail",{
                    pr: oBindingObj.Banfn
                });
            },
            
            /* =========================================================== */
            /* internal methods                                            */
            /* =========================================================== */
            _getPRList: function(){
                var that = this;
                var oLocalModel = that.getModel('LocalModel');
                var oDataModel = that.getModel();
                var aFinal = [];
                that.loadBusyIndicator("page",true);
                oDataModel.read("/ebanSet",{
                    success: function(oData){
                        that.loadBusyIndicator("page",false);
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
                                    aFinal.push(oHeader);
                                }
                            }
                            oLocalModel.setProperty("/EbanResults", $.extend(true,[],aFinal));
                            that._getPRFromCAPM();
                        }
                    }
                });
            },
            
            _rebindTable: function(){
                var oSmartTable = this.getControl('prSmartTbl');
                oSmartTable.applyVariant({});
                if(oSmartTable.isInitialised()){
                    oSmartTable.rebindTable();
                }
            },
            
            _getPRFromCAPM: function(){
                var that = this;
                var oLocalModel = this.getModel('LocalModel');
                var sLoggedInUserID = oLocalModel.getProperty("/LoggedInUserID");
                var aResults = oLocalModel.getProperty("/EbanResults");
                var sUrl = sServiceUrl + "PurchaceReqSet";
                var aFinal = [];
                this.loadBusyIndicator("page", true);
                ReqHelper.sendGetReq(sUrl).then(function (oRes) {
                    that.loadBusyIndicator("page",false);
                    if(oRes.value.length > 0){
                        for(var i=0; i<aResults.length; i++){
                            var iIdx = oRes.value.findIndex(function(el){
                                return el.pr === aResults[i].Banfn;
                            });
                            if(iIdx >= 0){
                                if(oRes.value[iIdx].nextApprover === sLoggedInUserID && oRes.value[iIdx].status === aResults[i]['Eprofile']){
                                    aResults[i]['IsRequestor'] = false;
                                    aResults[i]['IsApprover'] = true;
                                    aResults[i]['id'] = oRes.value[iIdx].id;
                                    aResults[i]['nextApprover'] = oRes.value[iIdx].nextApprover;
                                    aResults[i]['uistatus'] = 'Waiting for '+oRes.value[iIdx].status+' approval';
                                    aResults[i]['uistatusstate'] = 'Indication04';
                                    aResults[i]['status'] = oRes.value[iIdx].status;
                                    aFinal.push(aResults[i]);
                                } else if(oRes.value[iIdx].nextApprover !== sLoggedInUserID && oRes.value[iIdx].status !== aResults[i]['Eprofile']){
                                    aResults[i]['IsRequestor'] = false;
                                    aResults[i]['IsApprover'] = true;
                                    aResults[i]['id'] = oRes.value[iIdx].id;
                                    aResults[i]['nextApprover'] = sLoggedInUserID;
                                    aResults[i]['uistatus'] = 'Waiting for '+aResults[i]['Eprofile']+' approval';
                                    aResults[i]['uistatusstate'] = 'Indication04';
                                    aResults[i]['status'] = aResults[i]['Eprofile'];
                                    aFinal.push(aResults[i]);
                                } else if(oRes.value[iIdx].requestor === sLoggedInUserID){
                                    aResults[i]['IsRequestor'] = true;
                                    aResults[i]['IsApprover'] = false;
                                    aResults[i]['id'] = oRes.value[iIdx].id;
                                    aResults[i]['nextApprover'] = oRes.value[iIdx].nextApprover;
                                    aResults[i]['uistatus'] = 'Waiting for '+oRes.value[iIdx].status+' approval';
                                    aResults[i]['uistatusstate'] = 'Warning';
                                    aResults[i]['status'] = oRes.value[iIdx].status;
                                    aFinal.push(aResults[i]);
                                } 
                            } else {
                                if(aResults[i]['Eprofile'] === 'N' || aResults[i]['Eprofile'] === 'L0'){
                                    aResults[i]['uistatus'] = aResults[i]['Eprofile'];
                                    aResults[i]['uistatusstate'] = 'Information';
                                } else {
                                    aResults[i]['uistatus'] = 'Waiting for '+aResults[i]['Eprofile']+' approval';
                                    aResults[i]['uistatusstate'] = 'Warning';
                                    aResults[i]['IsApprover'] = true;
                                    aResults[i]['IsRequestor'] = false;
                                }
                                aFinal.push(aResults[i]);
                            }
                        }
                        oLocalModel.setProperty("/Results", $.extend(true,[],aFinal));
                        //that._rebindTable();
                    }
                }.bind(this))
                .catch(function (response) {
                    that.loadBusyIndicator("page",false);
                }.bind(this));
            },
        });
    });
