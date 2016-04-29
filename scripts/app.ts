/// <reference path='../typings/tsd.d.ts' />

var actionProvider =  {
    getMenuItems: (context) => {
        return [<IContributedMenuItem>{
            title: "Work Item Menu Action",
            action: (actionContext) => {
                let workItemId = actionContext.id
                    || (actionContext.ids && actionContext.ids.length > 0 && actionContext.ids[0])
                    || (actionContext.workItemIds && actionContext.workItemIds.length > 0 && actionContext.workItemIds[0]);
                    
                if (workItemId) {
                    alert(`Selected work item ${workItemId}`);
                }
            }
        }];
    }
};

// Register context menu action provider
VSS.register("blueprint-team.vsts-extension-split-work.vsts-extension-split-work-action", actionProvider);
VSS.register("vsts-extension-split-work-action", actionProvider);