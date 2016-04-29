/// <reference path='../typings/tsd.d.ts' />
var parseIds = (workItem) : number[] => {
    var ids = [];
    
    var children = workItem.relations;
    if(children) {
        for(var i = 0; i < children.length; i++) {
            var potentialChild = children[i];       
            if(potentialChild.rel === "System.LinkTypes.Hierarchy-Forward") {
                var splits = potentialChild.url.split("/");
                var id = splits[splits.length - 1];
                
                ids.push(parseInt(id, 10));
            }
        }
    }
    
    return ids;
}

var actionProvider = {
    getMenuItems: (context) => {
        return [<IContributedMenuItem>{
            title: "Split Workitem",
            icon: "img/logo.png",
            action: (actionContext) => {
                let workItemId = actionContext.id
                    || (actionContext.ids && actionContext.ids.length > 0 && actionContext.ids[0])
                    || (actionContext.workItemIds && actionContext.workItemIds.length > 0 && actionContext.workItemIds[0]);
                    
                if (workItemId) {
                    
                    new SplitWorkDialog().showDialog(workItemId);
                }
                
            }
        }];
    }
};

/// <reference path='../typings/tsd.d.ts' />

export class SplitWorkDialog { 
    
    public showDialog(workItemId) {
        VSS.getService(VSS.ServiceIds.Dialog).then((dialogSvc: IHostDialogService) => {
            // contribution info
            var extInfo = VSS.getExtensionContext();
            var dialogContributionId = extInfo.publisherId + "." + extInfo.extensionId + "." + "split-work-dialog";
            var theDialog: IExternalDialog;
            var mySplitDialog;
            var dialogOkCallback = (): any => {
                //    alert("ASDFASDFASDFASDF");
                   var ids = mySplitDialog.getIDs().then((ids) => {
                        // alert(ids);
                        // todo: call this thing
                        theDialog.close();
                   });
                  
            };
            
            var dialogOptions = {
                title: "Split",
                draggable: true,
                modal: true,
                okText: "Split",
                cancelText: "Cancel",
                height: 400,
                width: 500,
                resizable: false,
                // okCallback: dialogOkCallback,
                getDialogResult: dialogOkCallback,
                defaultButton: "ok",
                urlReplacementObject: { id: workItemId }
            };
            // VSS.require(["VSS/Controls/Dialogs"], function (Dialogs) {
            //    Dialogs.show(Dialogs.ModalDialog, dialogOptions); 
            // });
            dialogSvc.openDialog(dialogContributionId, dialogOptions).then((dialog: IExternalDialog) => {
                // do something
               theDialog = dialog;
               var parentId =(<any>dialog)._options.urlReplacementObject.id;
               VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient", "TFS/WorkItemTracking/Contracts"], function (VSS_Service, TFS_Wit_WebApi, WIT_Contracts) {
                        // Get the REST client
                        var witClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);
                        // ...
                        witClient.getWorkItems([parentId], null, null, WIT_Contracts.QueryExpand[3]).then(
                             (workItems) => {
                                var workItem = workItems[0];
                                var childIds = parseIds(workItem);
                                
                                witClient.getWorkItems(childIds).then((childWorkItems) => {
                                    
                                    var openChildWorkItems = [];
                                    for(var i = 0; i < childWorkItems.length; i++) {
                                        if(childWorkItems[i].fields["System.State"] !== "Closed") {
                                            openChildWorkItems.push(childWorkItems[i])
                                        }
                                    }
                                    dialog.getContributionInstance("split-work-dialog").then(function (splitWorkDialog) {
                                        mySplitDialog = splitWorkDialog;
                                        (<any>splitWorkDialog).buildChildDivs(openChildWorkItems);
                                    });
                                    dialog.updateOkButton(true); 
                                })
                            });
                    });
            })
        })
    }
}

// Register context menu action provider
VSS.register("blueprint-team.vsts-extension-split-work.vsts-extension-split-work-action", actionProvider);
VSS.register("vsts-extension-split-work-action", actionProvider);