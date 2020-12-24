let allMessageHandlers = {}
let allActions = {}
let allDragAndDropHandlers = {}
let allTooltips = {}

function registerActions(callbacks) {
    for (let name in callbacks) {
        allActions[name] = callbacks[name];
    }
}

function registerTooltips(callbacks) {
    for (let name in callbacks) {
        allTooltips[name] = callbacks[name];
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
            //console.log("dragstart: " + dragNode.id);
            hackyStartNode = startNode;
        }
    });

    document.addEventListener("dragover", e => {
        hideTooltip();
        let start = hackyStartNode;//findDropZone(e.srcElement);
        let end = findDropZone(e.target);
        if (hackyStartNode && end) {
            let action = getDragAndDropAction(start.dataset.dropZone, end.dataset.dropZone);
            if (action) {
                //console.log("dragover: " + start.dataset.dropZone + end.dataset.dropZone);
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

    let tooltipContainer = document.getElementById("tooltip");
    let currentTooltipElement = null;
    let currentTooltip = null;

    function showTooltip(element, x, y) {
        let tooltipId = element.dataset.tooltip;
        var tooltipCreator = allTooltips[tooltipId];
        if (!tooltipCreator) {
            alert("tooltip creator missing: " + tooltipId);
            return;
        }

        deleteAllChildren(tooltipContainer);
        tooltipContainer.appendChild(tooltipCreator(element.dataset));
        tooltipContainer.style.display = "block";
        let offset = getPageOffset(element);
        let clientRect = element.getBoundingClientRect();
        let midX = (clientRect.left + clientRect.width / 2);
        let midY = (clientRect.top + clientRect.height / 2);
        let px = midX < window.innerWidth / 2
            ? offset.x + element.offsetWidth + 10
            : offset.x - tooltipContainer.offsetWidth - 10;
        let py = midY < window.innerHeight / 2
            ? offset.y + element.offsetHeight + 10
            : offset.y - tooltipContainer.offsetHeight - 10;

        tooltipContainer.style.left = px + "px";
        tooltipContainer.style.top = py + "px";
    }

    function hideTooltip() {
        tooltipContainer.style.display = "none";
    }

    document.addEventListener("mousemove", e => {
        let target = e.target;
        if (tooltipContainer && tooltipContainer.contains(target))
            return;
        if (currentTooltipElement !== target) {
            currentTooltipElement = target;
            while (target != null) {
                if (target.dataset.tooltip) {
                    if (currentTooltip !== target) {
                        currentTooltip = target;
                        showTooltip(target, e.pageX, e.pageY);
                    }
                    return;
                }
                target = target.parentElement;
            }
            if (currentTooltip) {
                currentTooltip = null;
                hideTooltip();
            }
        }
    });
}


// ==== GUI STUFF ====

function openPanel(panelName) {
    let qa = document.querySelector('.panel.active');
    if (qa !== null) qa.classList.remove('active');
    qa = document.querySelector('#guiMainPanel #gui' + panelName);
    if (qa !== null) qa.classList.add('active');
}


registerActions({
    openPanel: target => {
        openPanel(target); // generic for now
        /*        switch (target) {
                    case "Admin":
                    case "Followers":
                    case "Inventory":
                    case "Dungeon":
                    case "Leaderboard":
                        break;
                    default:
                        break;
                }*/
    }
});