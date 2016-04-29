/// <reference path='../typings/tsd.d.ts' />
var parseIds = (workItem) : number[] => {
    var ids = [];
    
    var children = workItem.relations;
    
    for(var i = 0; i < children.length; i++) {
        var potentialChild = children[i];
        if(potentialChild.rel === "System.LinkTypes.Hierarchy-Forward") {
            var splits = potentialChild.url.split("/");
            var id = splits[splits.length - 1];
            
            ids.push(parseInt(id, 10));
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
            

            var dialogOkCallback = () => {
                
            };
            
           
            
            
            var dialogOptions = {
                title: "Split",
                draggable: true,
                modal: true,
                okText: "Split",
                cancelText: "Cancel",
                okCallback: dialogOkCallback,
                // content: $taskGrid,
                defaultButton: "ok",
                urlReplacementObject: { id: workItemId }
            };
            // VSS.require(["VSS/Controls/Dialogs"], function (Dialogs) {
            //    Dialogs.show(Dialogs.ModalDialog, dialogOptions); 
            // });
            dialogSvc.openDialog(dialogContributionId, dialogOptions).then((dialog) => {
                // do something
               
               var parentId =(<any>dialog)._id;
               VSS.require(["VSS/Service", "TFS/WorkItemTracking/RestClient", "TFS/WorkItemTracking/Contracts"], function (VSS_Service, TFS_Wit_WebApi, WIT_Contracts) {
                        // Get the REST client
                        var witClient = VSS_Service.getCollectionClient(TFS_Wit_WebApi.WorkItemTrackingHttpClient);
                        // ...
                        witClient.getWorkItems([parentId], null, null, WIT_Contracts.QueryExpand[3]).then(
                             (workItems) => {
                                var workItem = workItems[0];
                                var childIds = parseIds(workItem);
                                
                                witClient.getWorkItems(childIds).then((childWorkItems) => {
                                    // new SplitWorkDialog().showDialog(childWorkItems);
                                    
                                    dialog.getContributionInstance("split-work-dialog").then(function (splitWorkDialog) {
                                        (<any>splitWorkDialog).buildChildDivs(childWorkItems);
                                    });
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