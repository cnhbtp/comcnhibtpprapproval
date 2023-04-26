sap.ui.define([
    "./BaseController",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History",
    "sap/ui/model/Sorter",
    "com/cnhi/btp/prapproval/model/ReqHelper",
    "sap/ui/core/BusyIndicator"
],
    function (BaseController, MessageBox, Filter, FilterOperator, MessageToast, History, Sorter, ReqHelper, BusyIndicator) {
        "use strict";
        var sServiceUrl;
        return BaseController.extend("com.cnhi.btp.prapproval.controller.Detail", {
            
            /* =========================================================== */
            /* lifecycle methods                                           */
            /* =========================================================== */

            /**
             * Called when this controller is instantiated.
             * @public
             */
            onInit: function () {
                sServiceUrl = this.getOwnerComponent().getModel("PRApprovalCAP").sServiceUrl;
                this.getRouter().getRoute("detail").attachPatternMatched(this._onObjectMatched, this);
            },

            /* =========================================================== */
            /* event handlers                                              */
            /* =========================================================== */
            onPressRejectBtn: function(){
                var oLocalModel = this.getModel("LocalModel");
                var oBindingCtx = this.getView().getBindingContext("LocalModel").getObject();
                // var sSelNextApprover = oBindingCtx.selNextApprover;
                // if(!sSelNextApprover){
                //     MessageToast.show("Please select an approver");
                //     return;
                // }
                MessageBox.confirm(this.getResourceBundle().getText("apprCnfmMsg"),{
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    onClose: function(sAction){
                        if(sAction === 'YES'){
                            oLocalModel.setProperty("/action",'R');
                            this.onAction();
                            //this._openCommentsDialog('A');
                        }
                    }.bind(this)
                });
            },
            /**
             * Event handler for Approve Button
             * @public
             */
            onPressApproveBtn: function(){
                var oLocalModel = this.getModel("LocalModel");
                var oBindingCtx = this.getView().getBindingContext("LocalModel").getObject();
                var sSelNextApprover = oBindingCtx.selNextApprover;
                if(!sSelNextApprover){
                    MessageToast.show("Please select an approver");
                    return;
                }
                MessageBox.confirm(this.getResourceBundle().getText("apprCnfmMsg"),{
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    onClose: function(sAction){
                        if(sAction === 'YES'){
                            oLocalModel.setProperty("/action",'A');
                            this.onAction();
                            //this._openCommentsDialog('A');
                        }
                    }.bind(this)
                });
            },
            onPressSubmitBtn: function(){
                var oLocalModel = this.getModel("LocalModel");
                var oBindingCtx = this.getView().getBindingContext("LocalModel").getObject();
                var sSelNextApprover = oBindingCtx.selNextApprover;
                if(!sSelNextApprover){
                    MessageToast.show("Please select an approver");
                    return;
                }
                MessageBox.confirm("Are you sure you want to submit?",{
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    onClose: function(sAction){
                        if(sAction === 'YES'){
                            oLocalModel.setProperty("/action",'S');
                            this.onAction();
                        }
                    }.bind(this)
                });
                //this._openCommentsDialog('S');
            },

            onTableUpdated: function(oEvent){
                var oSrc = oEvent.getSource();
                var aCol = oSrc.getColumns();
                for(var i=0; i<aCol.length; i++){
                    aCol[i].getLabel().setDesign('Bold');
                }
            },
            
            /* =========================================================== */
            /* internal methods                                            */
            /* =========================================================== */

            /**
             * Binds the view to the object path.
             * @function
             * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
             * @private
             */
            _onObjectMatched : async function (oEvent) {
                var oArguments =  oEvent.getParameter("arguments");
                var sPR = oArguments.pr;
                var oLocalModel = this.getModel("LocalModel");
                // var aLevel = oLocalModel.getProperty("/sequence");
                // var aNextAppList = oLocalModel.getProperty("/NextApprovers");
                var aResult = oLocalModel.getProperty("/Results");
                if (aResult == undefined) {
                    try {
                        await this._getPRListPromise("ObjectPageLayout");
                    }
                    catch (error) {
                        console.log(error);
                    }
                }

                var iSelIdx = oLocalModel.getProperty("/Results").findIndex(function(el){
                    return el.Banfn === sPR;
                });
                this.getView().setBindingContext(oLocalModel.createBindingContext("/Results/"+iSelIdx), "LocalModel");
                // var status = this.getView().getBindingContext("LocalModel").getObject().status;
                // var iNextLevel = aLevel.findIndex(function(el){
                //     return el === status;
                // })+1;
                // var aNex = aNextAppList.filter(function(el){
                //     return el.levelID === aLevel[iNextLevel];
                // });
                // oLocalModel.setProperty("/dynNextApprTitle", "");
                // oLocalModel.setProperty("/dynNextAppr", $.extend(true,[],aNex));
                oLocalModel.setProperty("/Comment", "");
                this.getControl('prItemsSmartTbl').applyVariant({});
                this._getComments();
                this._getApproverList();
            },
            _getApproverList: function(){
                var that = this;
                var oLocalModel = that.getModel('LocalModel');
                var oDataModel = that.getModel();
                var aFinal = [];
                var oBindingCtx = that.getView().getBindingContext('LocalModel').getObject();
                var sUrl = oDataModel.sServiceUrl + "/ApproverSet";
                oLocalModel.setProperty("/ApproverList",[]);
                that.loadBusyIndicator("ObjectPageLayout",true);
                $.ajax({
                    url: sUrl,
                    dataType: 'JSON',
                    type: "get",
                    data: { 
                        search: oBindingCtx.Banfn
                    },
                    success: function(oData) {
                        that.loadBusyIndicator("ObjectPageLayout",false);
                        if(oData.d && oData.d.results && oData.d.results.length > 0){
                            oLocalModel.setProperty("/ApproverList", oData.d.results);
                            oLocalModel.setProperty("/dynNextApprTitle", oData.d.results[0].level);
                        }
                    },
                    error: function(oError) {
                        that.loadBusyIndicator("ObjectPageLayout",false);
                        if(oError && oError.responseText && JSON.parse(oError.responseText)){
                            MessageBox.error(JSON.parse(oError.responseText).error.message.value);
                        }
                    }
                  });
            },
            _getComments: function(){
                var that = this;
                var oLocalModel = this.getModel("LocalModel");
                var sBindingCtxPath = that.getView().getBindingContext('LocalModel').getPath();
                var oBindingCtx = that.getView().getBindingContext('LocalModel').getObject();
                var sUrl = sServiceUrl + "CommentSet";
                this.loadBusyIndicator("ObjectPageLayout", true);
                
                ReqHelper.sendGetReq(sUrl).then(function (oRes) {
                    that.loadBusyIndicator("ObjectPageLayout",false);
                    if(oRes.value.length > 0){
                        oLocalModel.setProperty(sBindingCtxPath+"/Comments", oRes.value.filter(function(el){
                            return el.pr === oBindingCtx.Banfn;
                        }));
                    }
                }.bind(this))
                .catch(function (response) {
                    that.loadBusyIndicator("ObjectPageLayout",false);
                }.bind(this));
            },
            _openCommentsDialog: function(sAction){
                var oLocalModel = this.getModel("LocalModel");
                if (!this.oCommentsDlg) {
                    this.oCommentsDlg = sap.ui.xmlfragment("com.cnhi.btp.prapproval.fragment.Comments", this);
                    // to get access to the controller's model
                    this.getView().addDependent(this.oCommentsDlg);
                }
                oLocalModel.setProperty("/dlgTitle",sAction === 'A' ? 'Approve PR' : sAction === 'S' ? 'Submit PR' : 'Reject PR');
                oLocalModel.setProperty("/Comment",'');
                oLocalModel.setProperty("/action",sAction);
                this.oCommentsDlg.open();
            },
            onAction: function(){
                var that = this;
                var oLocalModel = that.getModel("LocalModel");
                var sAction = oLocalModel.getProperty("/action");
                var oDataModel = that.getModel();
                var oBindingCtx = that.getView().getBindingContext("LocalModel").getObject();
                var sPath = oDataModel.createKey("/ebanSet",{
                    Banfn: oBindingCtx.Banfn,
                    Bnfpo: oBindingCtx.Bnfpo
                });
                var oPayload = {
                    Frgzu: sAction
                };
                BusyIndicator.show();
                oDataModel.update(sPath,oPayload,{
                    success: function(oData, oRes){
                        BusyIndicator.hide();
                        if(sAction === 'A'){
                            that._onApproveToCAPM();
                        } else if(sAction === 'S'){
                            that._onSubmitToCAPM();
                        } else if(sAction === 'R'){
                            that._onRejectToCAPM();
                        }
                    }
                });
            },
            /**
            * Push approval to CAPM
            * @private
            */
           _onApproveToCAPM: function(){
                var that = this;
                var oBindingCtx = that.getView().getBindingContext("LocalModel").getObject();
                if (oBindingCtx.id !== undefined ) {
                    var oPayload = {
                        status  : oBindingCtx.selNextApprover.split('|')[1],
                        nextApprover    : oBindingCtx.selNextApprover.split('|')[0],
                    };
                    var sUrl = sServiceUrl + "PurchaceReqSet/"+oBindingCtx.id;
                    this.loadBusyIndicator("ObjectPageLayout", true);
                    ReqHelper.sendUpdateReq(sUrl, oPayload).then(function (oRes) {
                        that.loadBusyIndicator("ObjectPageLayout",false);
                        //that.oCommentsDlg.close();
                        that._postComments(oRes);
                      //  that._postHistory(oRes);
                        MessageBox.success('Approved',{
                            onClose: function () {
                                that.getRouter().navTo("main");
                            }.bind(that)
                        });
                    }.bind(this))
                    .catch(function (response) {
                        that.loadBusyIndicator("ObjectPageLayout",false);
                    }.bind(this));
                } else {
                    var oLocalModel = that.getModel("LocalModel");
                    var sRequestor = oLocalModel.getProperty("/LoggedInUserID");
                    var oPayload = {
                        pr  : oBindingCtx.Banfn,
                        status  : oBindingCtx.selNextApprover.split('|')[1],
                        nextApprover    : oBindingCtx.selNextApprover.split('|')[0],
                        requestor   : sRequestor
                    };
                    var sUrl = sServiceUrl + "PurchaceReqSet";
                    this.loadBusyIndicator("ObjectPageLayout", true);
                    
                    ReqHelper.sendCreateReq(sUrl, oPayload).then(function (oRes) {
                        that.loadBusyIndicator("ObjectPageLayout",false);
                        //that.oCommentsDlg.close();
                        that._postComments(oRes);
                        //that._postHistory(oRes);
                        MessageBox.success('Approved',{
                            onClose: function () {
                                that.getRouter().navTo("main");
                            }.bind(that)
                        });
                    }.bind(this))
                    .catch(function (response) {
                        that.loadBusyIndicator("ObjectPageLayout",false);
                    }.bind(this));
                }

            },/**
            * Method to submit
            * @private
            */
           _onSubmitToCAPM: function(){
                var that = this;
                var oLocalModel = this.getModel("LocalModel");
                var oBindingCtx = that.getView().getBindingContext("LocalModel").getObject();
                var sRequestor = oLocalModel.getProperty("/LoggedInUserID");
                var oPayload = {
                    pr  : oBindingCtx.Banfn,
                    status  : oBindingCtx.selNextApprover.split('|')[1],
                    nextApprover    : oBindingCtx.selNextApprover.split('|')[0],
                    requestor   : sRequestor
                };
                var sUrl = sServiceUrl + "PurchaceReqSet";
                this.loadBusyIndicator("ObjectPageLayout", true);
                
                ReqHelper.sendCreateReq(sUrl, oPayload).then(function (oRes) {
                    that.loadBusyIndicator("ObjectPageLayout",false);
                    //that.oCommentsDlg.close();
                    that._postComments(oRes);
                    //that._postHistory(oRes);
                    MessageBox.success('Sent for next approval',{
                        onClose: function () {
                            that.getRouter().navTo("main");
                        }.bind(that)
                    });
                }.bind(this))
                .catch(function (response) {
                    that.loadBusyIndicator("ObjectPageLayout",false);
                }.bind(this));
            },
            _postHistory: function(oPayload){
                var that = this;
                var oLocalModel = this.getModel("LocalModel");
                var sAction = oLocalModel.getProperty("/action");
                var sAuthorID = oLocalModel.getProperty("/LoggedInUserID");
                var sAuthorName = oLocalModel.getProperty("/LoggedInUserName");
                var oPayload = {
                    pr  : oPayload.Banfn,
                    status  : sAction === 'S' ? 'Submitted' : sAction === 'A' ? 'Approved' : 'Rejected',
                    userID   : sAuthorID,
                    userName  : sAuthorName
                };
                
                var sUrl = sServiceUrl + "HistorySet";
                this.loadBusyIndicator("ObjectPageLayout", true);
                ReqHelper.sendCreateReq(sUrl, oPayload).then(function (oRes) {
                    that.loadBusyIndicator("ObjectPageLayout",false);
                }.bind(this))
                .catch(function (response) {
                    that.loadBusyIndicator("ObjectPageLayout",false);
                }.bind(this));
            },
            _postComments: function(oPayload){
                var that = this;
                var oLocalModel = this.getModel("LocalModel");
                var sComment = oLocalModel.getProperty("/Comment");
                var sAction = oLocalModel.getProperty("/action");
                var sAuthorID = oLocalModel.getProperty("/LoggedInUserID");
                var sAuthorName = oLocalModel.getProperty("/LoggedInUserName");
                var oPayload = {
                    pr  : oPayload.pr,
                    type  : sAction,
                    comment    : sComment ? sComment : '',
                    authorID   : sAuthorID,
                    authorName  : sAuthorName
                };
                
                var sUrl = sServiceUrl + "CommentSet";
                this.loadBusyIndicator("ObjectPageLayout", true);
                ReqHelper.sendCreateReq(sUrl, oPayload).then(function (oRes) {
                    that.loadBusyIndicator("ObjectPageLayout",false);
                }.bind(this))
                .catch(function (response) {
                    that.loadBusyIndicator("ObjectPageLayout",false);
                }.bind(this));
            },
            /**
            * Method to navigate to the previous page
            * @private
            */
            _onNavBack: function () {
                var sPreviousHash = History.getInstance().getPreviousHash();
                if (sPreviousHash !== undefined && sPreviousHash !== "") {
                    history.go(-1);
                } else {
                    this.getRouter().navTo("main");
                }
            }
        });
    });
