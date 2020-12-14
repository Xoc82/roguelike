let allMessageHandlers = {}
let allActions = {}
let allDragAndDropHandlers = {}

function registerActions(actions) {
    for (let name in actions) {
        allActions[name] = actions[name];
    }
}


function registerDragAndDropHandlers(handlers) {
    for (let name in handlers) {
        if (!allDragAndDropHandlers[name])
            allDragAndDropHandlers[name] = {};
        let dropHandlers = handlers[name];
        let allDropHandlers = allDragAndDropHandlers[name];
        for (let n in dropHandlers) {
            allDropHandlers[n] = dropHandlers[n];
        }
    }
}

function registerMessageHandlers(handlers) {
    for (let name in handlers) {
        allMessageHandlers[name] = handlers[name];
    }
}


function processMessages(messages) {
    for (let i = 0; i < messages.length; i++) {
        processMessage(messages[i]);
    }
}

function processMessage(message) {
    var handler = allMessageHandlers[message.type];
    if (!handler) {
        alert("message handler missing: " + message.type);
    }
    handler(message);
}

function initEngine() {
    document.getElementById("gui").addEventListener("click", (e) => {
        let target = e.target;
        if (target.dataset.action) {
            e.preventDefault();
            let actionName = target.dataset.action;
            let actionArgs = target.dataset.actionArgs;
            let action = allActions[actionName];
            if (action)
                action(actionArgs);
            else
                alert("action missing: " + actionName);
        }
    });



    let hackyStartNode = null;

    function getDragAndDropId(node) {
        if (node.id)
            return node.id;
        let randomId = "rnd" + (Math.random() * 1000000000);
        node.id = randomId;
        return randomId;
    }
    document.addEventListener("dragstart", e => {
        let target = e.target;
        let dragNode = null;
        let startNode = null;
        while (target) {
            if (!dragNode && target.draggable) {
                dragNode = target;
            }
            if (target.dataset) {
                let dropZone = target.dataset.dropZone;
                if (!startNode && dropZone) {
                    startNode = target;
                }
            }
            target = target.parentNode;
        }

        if (dragNode && startNode) {
            e.dataTransfer.setData("start", getDragAndDropId(startNode));
            e.dataTransfer.setData("node", getDragAndDropId(dragNode));
            console.log("dragstart: " + dragNode.id);
            hackyStartNode = startNode;
        }
    });


    document.addEventListener("dragover", e => {
        let start = hackyStartNode;//findDropZone(e.srcElement);
        let end = findDropZone(e.target);
        if (hackyStartNode && end) {
            let action = getDragAndDropAction(start.dataset.dropZone, end.dataset.dropZone);
            if (action) {
                console.log("dragover: " + start.dataset.dropZone + end.dataset.dropZone);
                e.preventDefault();
            }
        }
    });

    function findDropZone(target) {
        while (target) {
            if (target.dataset) {
                let dropZone = target.dataset.dropZone;
                if (dropZone) {
                    return target;
                }
            }
            target = target.parentNode;
        }
        return null;
    }

    function getDragAndDropAction(start, end) {
        let dropList = allDragAndDropHandlers[start];
        if (!dropList)
            return null;
        let action = dropList[end];
        if (action) {
            return action;
        }
        return null;
    }

    document.addEventListener("drop", e => {
        let endNode = findDropZone(e.target);
        if (endNode) {
            let startId = e.dataTransfer.getData("start");
            let nodeId = e.dataTransfer.getData("node");
            let startNode = document.getElementById(startId);
            let dragNode = document.getElementById(nodeId);
            let action = getDragAndDropAction(startNode.dataset.dropZone, endNode.dataset.dropZone);
            if (action)
                action(startNode, dragNode, endNode);
        }
    });

}