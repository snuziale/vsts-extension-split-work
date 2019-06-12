/// <reference types="vss-web-extension-sdk" />

import TFS_Wit_Contracts = require("TFS/WorkItemTracking/Contracts");
import TFS_Wit_Client = require("TFS/WorkItemTracking/RestClient");
import TFS_Wit_Services = require("TFS/WorkItemTracking/Services");

import TFS_Work_Contracts = require("TFS/Work/Contracts");
import TFS_Work_Client = require("TFS/Work/RestClient");

import {CoreFields} from "./constants";

function createFieldPatchBlock(field: string, value: string): any {
    return {
        "op": "add",
        "path": "/fields/" + field,
        "value": value || ""
    };
}

function createRemoveRelationPatchBlock(index: string) {
    return {
        "op": "remove",
        "path": "/relations/" + index
    };
}

function createAddRelationPatchBlock(relation: TFS_Wit_Contracts.WorkItemRelation) {
    return {
        "op": "add",
        "path": "/relations/-",
        "value": relation
    };
}

function createHtmlLink(link: string, text: number | string) {
    return `<a href="${link}" target="_blank">${text}</a>`;
}

function createWorkItemHtmlLink(id: number): string {
    var context = VSS.getWebContext();
    var link = `${context.collection.uri}${context.project.name}/_workitems/edit/${id}`;
    return createHtmlLink(link, id);
}

function removeLinks(workItem: TFS_Wit_Contracts.WorkItem, linkedWorkItemIds: number[], targetId: number): IPromise<TFS_Wit_Contracts.WorkItem> {
    if (!linkedWorkItemIds || linkedWorkItemIds.length === 0) {
        return new Promise( function (resolve, reject)
        {
            resolve(workItem);
        });
    }

    var indices = [];
    workItem.relations.forEach((relation, index) => {
        linkedWorkItemIds.forEach(id => {
            var relationId = parseInt(relation.url.substr(relation.url.lastIndexOf("/") + 1), 10);
            if (relationId === id) {
                indices.unshift(index);
            }
        });
    });

    var patchDocument = indices.map(index => createRemoveRelationPatchBlock(index));

    var childLinks = linkedWorkItemIds.map(id => createWorkItemHtmlLink(id)).join(", ");
    var comment = `The follow items were ${createHtmlLink("http://aka.ms/split", "split")} to work item ${createWorkItemHtmlLink(targetId)}:<br>&nbsp;&nbsp;${childLinks}`;
    patchDocument.push(createFieldPatchBlock(CoreFields.History, comment));

    return TFS_Wit_Client.getClient().updateWorkItem(patchDocument, workItem.id);
}

function addRelations(workItem: TFS_Wit_Contracts.WorkItem, relations: TFS_Wit_Contracts.WorkItemRelation[]): IPromise<TFS_Wit_Contracts.WorkItem> {
    if (!relations || relations.length === 0) {
        return new Promise(function (resolve, reject){
            return workItem;
        });
    }

    var patchDocument = relations.map(relation => createAddRelationPatchBlock(relation));
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
        return addRelations(targetWorkItem, relationsToAdd);
    });
}

function updateIterationPath(childIdsToMove: number[], iterationPath: string): IPromise<TFS_Wit_Contracts.WorkItem[]> {
    var promises: IPromise<TFS_Wit_Contracts.WorkItem>[] = [];
    childIdsToMove.forEach(childId => {
        var patchDocument = [createFieldPatchBlock(CoreFields.IterationPath, iterationPath)];
        promises.push(TFS_Wit_Client.getClient().updateWorkItem(patchDocument, childId));
    });

    return Promise.all(promises);
}

function createWorkItem(workItem: TFS_Wit_Contracts.WorkItem, copyTags: boolean, title?: string, iterationPath?: string): IPromise<TFS_Wit_Contracts.WorkItem> {
    var patchDocument = [];
    var fieldsToCopy = [CoreFields.Title, CoreFields.AssignedTo, CoreFields.IterationPath, CoreFields.AreaPath, CoreFields.Description];
    if (copyTags){
        fieldsToCopy.push(CoreFields.Tags);
    }
    fieldsToCopy.forEach(field => {
        if (field === CoreFields.Title && title && title.length > 0) {
            patchDocument.push(createFieldPatchBlock(field, title));
        }
        else if (field === CoreFields.IterationPath && iterationPath) {
            patchDocument.push(createFieldPatchBlock(field, iterationPath));
        }
        else {
            patchDocument.push(createFieldPatchBlock(field, workItem.fields[field]));
        }
    });
    var comment = `This work item was ${createHtmlLink("http://aka.ms/split", "split")} from work item ${createWorkItemHtmlLink(workItem.id)}: ${workItem.fields[CoreFields.Title]}`;
    patchDocument.push(createFieldPatchBlock(CoreFields.History, comment));

    var context = VSS.getWebContext();
    return TFS_Wit_Client.getClient().createWorkItem(patchDocument, context.project.name, workItem.fields[CoreFields.WorkItemType]);
}

function findNextIteration(sourceWorkItem: TFS_Wit_Contracts.WorkItem): IPromise<string> {
    var currentIterationPath = sourceWorkItem.fields[CoreFields.IterationPath];

    var context = VSS.getWebContext();
    var teamContext = {
        project: context.project.name,
        projectId: context.project.id,
        team: context.team.name,
        teamId: context.team.id
    };

    return TFS_Work_Client.getClient().getTeamIterations(teamContext).then((iterations: TFS_Work_Contracts.TeamSettingsIteration[]) => {
        var index = 0;
        var found = false;
        for (var len = iterations.length; index < len; index++) {
            var iteration = iterations[index];
            if (currentIterationPath === iteration.path) {
                found = true;
                break;
            }
        }
        if (!found || index >= iterations.length - 1) {
            return currentIterationPath;
        }
        else {
            return iterations[index + 1].path;
        }
    });
}

function peformSplit(id: number, childIdsToMove: number[], copyTags : boolean, title?: string): IPromise<TFS_Wit_Contracts.WorkItem> {
    return TFS_Wit_Client.getClient().getWorkItem(id, null, null, <any>"all" /*TFS_Wit_Contracts.WorkItemExpand.All*/)    // TODO: Bug - TFS_Wit_Contracts.WorkItemExpand.All should be a string value or REST API should handle enum value.
        .then((sourceWorkItem: TFS_Wit_Contracts.WorkItem) => {
            return findNextIteration(sourceWorkItem).then(iterationPath => {
                return createWorkItem(sourceWorkItem, copyTags, title, iterationPath ).then((targetWorkItem) => {
                    return updateLinkRelations(sourceWorkItem, targetWorkItem, childIdsToMove).then(() => {
                        return updateIterationPath(childIdsToMove, iterationPath).then(() => {
                            return targetWorkItem;
                        });
                    });
                });
            });
        });
}

function getChildIds(workItem: TFS_Wit_Contracts.WorkItem): number[] {
    return !workItem.relations ? [] : workItem.relations.filter(relation => relation.rel === "System.LinkTypes.Hierarchy-Forward").map(relation => {
        var url = relation.url;
        return parseInt(url.substr(url.lastIndexOf("/") + 1), 10);
    });
}

function showDialog(workItemId: number) {
    var _dialog: IExternalDialog;
    var _contribution: any;

    var dialogOptions = <IHostDialogOptions>{
        title: "Split work item",
        draggable: true,
        modal: true,
        okText: "Split",
        cancelText: "Cancel",
        height: 450,
        width: 500,
        resizable: false,
        useBowtieStyle: true,
        bowtieVersion: 2,
        getDialogResult: () => {
            return _contribution.getDetails();
        },
        okCallback: (details:  { ids: number[], title: string, shouldOpenNewWorkItem: boolean, shouldCopyTags: boolean })  =>
        {
            if (details.ids && details.ids.length > 0) {
                peformSplit(workItemId, details.ids, details.shouldCopyTags, details.title).then((splitWorkItem: TFS_Wit_Contracts.WorkItem) => {
                    _dialog.close();

                    if (details.shouldOpenNewWorkItem) {
                        VSS.getService(TFS_Wit_Services.WorkItemFormNavigationService.contributionId).then((service : TFS_Wit_Services.IWorkItemFormNavigationService) => {
                            service.openWorkItem(splitWorkItem.id);
                        });
                    }
                });
            }
        }
    };

    VSS.getService(VSS.ServiceIds.Dialog).then((dialogSvc: IHostDialogService) => {
        var extensionCtx = VSS.getExtensionContext();
        var splitWorkDialogContributionId = extensionCtx.publisherId + "." + extensionCtx.extensionId + ".vsts-extension-split-work-dialog";
        dialogSvc.openDialog(splitWorkDialogContributionId , dialogOptions).then((dialog: IExternalDialog) => {
            _dialog = dialog;
            dialog.getContributionInstance(splitWorkDialogContributionId ).then((contribution: any) => {
                _contribution = contribution;
                contribution.startSplit(workItemId).then(enable => {
                    if (enable) {
                        dialog.updateOkButton(true);
                    }
                });
            });
        });
    });
}

var actionProvider = {
    getMenuItems: (context) => {
        return [<IContributedMenuItem>{
            text: "Split",
            title: "Split",
            icon: "img/icon.png",
            action: (actionContext) => {
                let workItemId = actionContext.id
                    || actionContext.workItemId
                    || (actionContext.ids && actionContext.ids.length > 0 && actionContext.ids[0])
                    || (actionContext.workItemIds && actionContext.workItemIds.length > 0 && actionContext.workItemIds[0]);

                if (workItemId) {
                    showDialog(workItemId);
                }
            }
        }];
    }
};

VSS.register(VSS.getContribution().id, actionProvider);
VSS.notifyLoadSucceeded();
