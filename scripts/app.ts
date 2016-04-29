/// <reference path='../typings/tsd.d.ts' />

import Q = require("q");

import TFS_Wit_Contracts = require("TFS/WorkItemTracking/Contracts");
import TFS_Wit_Client = require("TFS/WorkItemTracking/RestClient");
import TFS_Wit_Services = require("TFS/WorkItemTracking/Services");

import TFS_Work_Contracts = require("TFS/Work/Contracts");
import TFS_Work_Client = require("TFS/Work/RestClient");

var _fieldsToCopy = [
    "System.Title",
    "System.AssignedTo",
    "System.IterationPath",
    "System.AreaPath",
    "System.Description"
];

function createFieldPatchBlock(field: string, value: string): any {
    return {
        "op": "add",
        "path": "/fields/" + field,
        "value": value || ""
    };
}

function createRelationPatchBlock(index: string) {
    return {
        "op": "remove",
        "path": "/relations/" + index
    };
}

function removeLinks(workItem: TFS_Wit_Contracts.WorkItem, linkedWorkItemIds: number[], targetId: number): IPromise<TFS_Wit_Contracts.WorkItem> {
    if (!linkedWorkItemIds || linkedWorkItemIds.length === 0) {
        return Q(workItem);
    }

    var indices = [];
    workItem.relations.forEach((relation, index) => {
        linkedWorkItemIds.forEach(id => {
            var relationId = parseInt(relation.url.substr(relation.url.lastIndexOf("/") + 1), 10)
            if (relationId === id) {
                indices.unshift(index);
            }
        });
    });

    var patchDocument = [];
    // TODO: revisit
    var comment = `The follow items were <a href="http://bing.com" target="_blank">split</a> to parent work item #${targetId}<br>${linkedWorkItemIds.join(", ")}`;
    patchDocument.push(createFieldPatchBlock("System.History", comment));
    indices.forEach(index => {
        patchDocument.push(createRelationPatchBlock(index));
    });

    return TFS_Wit_Client.getClient().updateWorkItem(patchDocument, workItem.id);
}

function addRelations(workItem: TFS_Wit_Contracts.WorkItem, relations: TFS_Wit_Contracts.WorkItemRelation[]): IPromise<TFS_Wit_Contracts.WorkItem> {
    if (!relations || relations.length === 0) {
        return Q(workItem);
    }

    var patchDocument = [];
    relations.forEach(relation => {
        patchDocument.push({
            "op": "add",
            "path": "/relations/-",
            "value": relation
        });
    });

    return TFS_Wit_Client.getClient().updateWorkItem(patchDocument, workItem.id);
}

function updateLinkRelations(sourceWorkItem: TFS_Wit_Contracts.WorkItem, targetWorkItem: TFS_Wit_Contracts.WorkItem, childIdsToMove: number[]): IPromise<TFS_Wit_Contracts.WorkItem> {
    var parentRelation = sourceWorkItem.relations.filter(relation => relation.rel === "System.LinkTypes.Hierarchy-Reverse");
    var attachmentRelations = sourceWorkItem.relations.filter(relation => relation.rel === "AttachedFile").map(relation => {
        return <TFS_Wit_Contracts.WorkItemRelation>{
            rel: relation.rel,
            url: relation.url,
            title: null,
            attributes: {
                name: relation.attributes["name"],
                resourceCreatedDate: relation.attributes["resourceCreatedDate"],
                resourceModifiedDate: relation.attributes["resourceModifiedDate"],
                resourceSize: relation.attributes["resourceSize"]
            }
        };
    });
    var childRelations = sourceWorkItem.relations.filter(relation => {
        if (relation.rel === "System.LinkTypes.Hierarchy-Forward") {
            var url = relation.url;
            var id = parseInt(url.substr(url.lastIndexOf("/") + 1), 10);
            return childIdsToMove.indexOf(id) > -1;
        }
        return false;
    });

    return removeLinks(sourceWorkItem, childIdsToMove, targetWorkItem.id).then(() => {
        var relationsToAdd = parentRelation.concat(childRelations).concat(attachmentRelations);
        return addRelations(targetWorkItem, relationsToAdd).then(() => {

        });
    });
}

function updateIterationPath(childIdsToMove: number[], iterationPath: string): IPromise<TFS_Wit_Contracts.WorkItem[]> {
    var promises = [];
    childIdsToMove.forEach(childId => {
        var patchDocument = [];
        patchDocument.push(createFieldPatchBlock("System.IterationPath", iterationPath));
        promises.push(TFS_Wit_Client.getClient().updateWorkItem(patchDocument, childId));
    });

    return Q.allSettled(promises).then(promiseStates => promiseStates.map(state => state.value));
}

function createWorkItem(workItem: TFS_Wit_Contracts.WorkItem, iterationPath?: string): IPromise<TFS_Wit_Contracts.WorkItem> {
    var patchDocument = [];
    _fieldsToCopy.forEach(field => {
        if (field === "System.IterationPath" && iterationPath) {
            patchDocument.push(createFieldPatchBlock(field, iterationPath));
        }
        else {
            patchDocument.push(createFieldPatchBlock(field, workItem.fields[field]));
        }
    });
    // TODO: revisit
    var comment = `This item was <a href="http://bing.com" target="_blank">split</a> from #${workItem.id}: ${workItem.fields["System.Title"]}`;
    patchDocument.push(createFieldPatchBlock("System.History", comment));

    var context = VSS.getWebContext();
    return TFS_Wit_Client.getClient().createWorkItem(patchDocument, context.project.name, workItem.fields["System.WorkItemType"]);
}

function findNextIteration(sourceWorkItem: TFS_Wit_Contracts.WorkItem): IPromise<string> {
    var currentIterationPath = sourceWorkItem.fields["System.IterationPath"];

    var context = VSS.getWebContext();
    var teamContext = {
        project: context.project.name,
        projectId: context.project.id,
        team: context.team.name,
        teamId: context.team.id
    };

    return TFS_Work_Client.getClient().getTeamIterations(teamContext).then((iterations: TFS_Work_Contracts.TeamSettingsIteration[]) => {
        var index = 0;
        for (var len = iterations.length; index < len; index++) {
            var iteration = iterations[index];
            if (currentIterationPath === iteration.path) {
                break;
            }
        }
        if (index >= iterations.length - 1) {
            return currentIterationPath;
        }
        else {
            return iterations[index + 1].path;
        }
    });
}

function split(id: number, childIdsToMove: number[]): IPromise<any> {

    return TFS_Wit_Client.getClient().getWorkItem(id, null, null, <any>"all" /*TFS_Wit_Contracts.WorkItemExpand.All*/)    // TODO: Bug - TFS_Wit_Contracts.WorkItemExpand.All should be a string value or REST API should handle enum value.
        .then((sourceWorkItem: TFS_Wit_Contracts.WorkItem) => {

            return findNextIteration(sourceWorkItem).then(iterationPath => {
                return createWorkItem(sourceWorkItem, iterationPath).then((targetWorkItem) => {
                    return updateLinkRelations(sourceWorkItem, targetWorkItem, childIdsToMove).then(() => {
                        return updateIterationPath(childIdsToMove, iterationPath).then(() => {
                            // all done!!
                        });
                    });
                });
            });
        });
}

function parseIds(workItem) {
    var ids = [];

    var children = workItem.relations;
    if (children) {
        for (var i = 0; i < children.length; i++) {
            var potentialChild = children[i];
            if (potentialChild.rel === "System.LinkTypes.Hierarchy-Forward") {
                var splits = potentialChild.url.split("/");
                var id = splits[splits.length - 1];

                ids.push(parseInt(id, 10));
            }
        }
    }

    return ids;
}

function showSplitDialog(workItemId: number) {
    VSS.getService(VSS.ServiceIds.Dialog).then((dialogSvc: IHostDialogService) => {
        // contribution info
        var extInfo = VSS.getExtensionContext();
        var dialogContributionId = extInfo.publisherId + "." + extInfo.extensionId + "." + "split-work-dialog";
        var theDialog: IExternalDialog;
        var mySplitDialog: any; // TODO: interface this

        var dialogOkCallback = (): any => {
            var ids = mySplitDialog.getIDs().then((ids) => {
                split(workItemId, ids).then(() => {
                    // TODO: show that we are saving....
                    theDialog.close();
                });
            });
        };

        var dialogOptions = {
            title: "Split work item",
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

        dialogSvc.openDialog(dialogContributionId, dialogOptions).then((dialog: IExternalDialog) => {

            theDialog = dialog;
            var parentId = (<any>dialog)._options.urlReplacementObject.id;

            TFS_Wit_Client.getClient().getWorkItem(parentId, null, null, <any>"all").then(workItem => {
                var childIds = parseIds(workItem);

                var checkChildrenToSplit = () => {

                };
                if (childIds.length === 0) {
                    dialog.getContributionInstance("split-work-dialog").then(splitWorkDialog => {
                        mySplitDialog = splitWorkDialog;
                        mySplitDialog.setNoChildResults();
                    });
                }
                else {
                    TFS_Wit_Client.getClient().getWorkItems(childIds).then(childWorkItems => {

                        var openChildWorkItems = [];
                        for (var i = 0; i < childWorkItems.length; i++) {
                            if (childWorkItems[i].fields["System.State"] !== "Closed") { // TODO: does not work across all process templates (what about Cut state?)
                                openChildWorkItems.push(childWorkItems[i])
                            }
                        }

                        dialog.getContributionInstance("split-work-dialog").then(splitWorkDialog => {
                            mySplitDialog = splitWorkDialog;
                            if (openChildWorkItems.length > 0) {
                                mySplitDialog.buildChildDivs(openChildWorkItems);
                                dialog.updateOkButton(true);
                            }
                            else {
                                mySplitDialog.setNoChildResults();
                            }
                        });
                    });
                }
            });
        });
    });
}

var actionProvider = {
    getMenuItems: (context) => {
        return [<IContributedMenuItem>{
            title: "Split",
            icon: "img/logo.png",
            action: (actionContext) => {
                let workItemId = actionContext.id
                    || (actionContext.ids && actionContext.ids.length > 0 && actionContext.ids[0])
                    || (actionContext.workItemIds && actionContext.workItemIds.length > 0 && actionContext.workItemIds[0]);

                if (workItemId) {
                    showSplitDialog(workItemId);
                }
            }
        }];
    }
};


// Register context menu action provider
VSS.register("blueprint-team.vsts-extension-split-work.vsts-extension-split-work-action", actionProvider);
VSS.register("vsts-extension-split-work-action", actionProvider);