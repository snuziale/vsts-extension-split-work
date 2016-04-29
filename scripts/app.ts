/// <reference path='../typings/tsd.d.ts' />
import Q = require("q");

import TFS_Wit_Contracts = require("TFS/WorkItemTracking/Contracts");
import TFS_Wit_Client = require("TFS/WorkItemTracking/RestClient");
import TFS_Wit_Services = require("TFS/WorkItemTracking/Services");

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
            if (relation.url.indexOf("/" + id) > -1) {
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

function updateLinkRelations(sourceWorkItem: TFS_Wit_Contracts.WorkItem, targetWorkItem: TFS_Wit_Contracts.WorkItem, idsToMove?: number[]): IPromise<TFS_Wit_Contracts.WorkItem> {
    var childRelations = sourceWorkItem.relations.filter(relation => relation.rel === "System.LinkTypes.Hierarchy-Forward");
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

    // TODO: Filter childRelations based on provided child ids...

    var childIds = childRelations.map(relation => {
        var url = relation.url;
        return parseInt(url.substr(url.lastIndexOf("/") + 1), 10);
    });


    return removeLinks(sourceWorkItem, childIds, targetWorkItem.id).then(() => {
        var relationsToAdd = parentRelation.concat(childRelations).concat(attachmentRelations);
        return addRelations(targetWorkItem, relationsToAdd).then(() => {

        });
    });
}

function createWorkItem(workItem: TFS_Wit_Contracts.WorkItem): IPromise<TFS_Wit_Contracts.WorkItem> {
    var patchDocument = [];
    _fieldsToCopy.forEach(field => {
        patchDocument.push(createFieldPatchBlock(field, workItem.fields[field]));
    })
    // TODO: revisit
    var comment = `This item was <a href="http://bing.com" target="_blank">split</a> from #${workItem.id}: ${workItem.fields["System.Title"]}`;
    patchDocument.push(createFieldPatchBlock("System.History", comment));

    var context = VSS.getWebContext();
    return TFS_Wit_Client.getClient().createWorkItem(patchDocument, context.project.name, workItem.fields["System.WorkItemType"]);
}

function split(id: number, childIdsToMove: number[]) {

    TFS_Wit_Client.getClient().getWorkItem(id, null, null, <any>"all" /*TFS_Wit_Contracts.WorkItemExpand.All*/)    // TODO: Bug - TFS_Wit_Contracts.WorkItemExpand.All should be a string value or REST API should handle enum value.
        .then((sourceWorkItem: TFS_Wit_Contracts.WorkItem) => {
            createWorkItem(sourceWorkItem).then((targetWorkItem) => {
                alert("!! CREATED !!" + targetWorkItem.id);
                updateLinkRelations(sourceWorkItem, targetWorkItem, childIdsToMove).then(
                    () => {

                    },
                    () => {
                        // something went wrong.
                    });
            });
        });
}



var actionProvider = {
    getMenuItems: (context) => {
        return [<IContributedMenuItem>{
            title: "Split",
            action: (actionContext) => {
                let workItemId = actionContext.id
                    || (actionContext.ids && actionContext.ids.length > 0 && actionContext.ids[0])
                    || (actionContext.workItemIds && actionContext.workItemIds.length > 0 && actionContext.workItemIds[0]);

                split(workItemId, []);
            }
        }];
    }
};

// Register context menu action provider
VSS.register("blueprint-team.vsts-extension-split-work.vsts-extension-split-work-action", actionProvider);
VSS.register("vsts-extension-split-work-action", actionProvider);