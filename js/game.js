function registerClickOnClass(className, callback) {
    for (let button of document.getElementsByClassName(className)) {
        button.addEventListener("click", (e) => callback(e));
    }
}

var loadJson = (name) => new Promise(resolve => {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", name);
    xhr.send();
    xhr.onload = () => {
        if (xhr.status === 200) {
            let data = JSON.parse(xhr.responseText);
            resolve(data);
        } else {
            alert(xhr.responseText);
        }
    };
});

function arrayToDictionaryById(array) {
    return array.reduce((a, x) => { a[x.id] = x; return a }, {});
}

async function startGame() {
    let unitTypes = arrayToDictionaryById(await loadJson("json/unit-types.json"));
    let roomTypes = arrayToDictionaryById(await loadJson("json/room-types.json"));
    let currencyTypes = arrayToDictionaryById(await loadJson("json/currencies.json"));
    let units = {};
    let currencies = {};


    let messageHandlers = {
        chat: message => {
            addChatMessage(message);
        },
        currency: async message => {
            await loadCurrencies();
        },
        unit: async message => {
            await loadUnits();
        }
    };

    function setUserInfo(text) {
        document.getElementById("user-info").innerText = text;
    }

    function setLane(placements) {
        renderLane(placements);
    }


    async function loadUserInfo() {
        let user = await apiGetCall("account/me");
        if (!user.authenticated) {
            setUserInfo(" not logged in");
            return false;
        }
        setUserInfo(user.name + " " + user.id);
        return true;
    }

    async function loadLane() {
        let lane = await apiGetCall("player/lane/default");
        setLane(lane.units);
    }

    function getStatesAtLevel(unitType, level) {
        let i = 1;
        while (level < unitType.stats[i]) i++;
        var start = unitType.stats[i - 1];
        var end = unitType.stats[i];
        function interpolate(a, b) {
            return Math.floor(a + (b - a) * (level - start.level) / (end.level - start.level));
        }
        return {
            attack: interpolate(start.attack, end.attack),
            hp: interpolate(start.hp, end.hp)
        }
    }

    function renderSetup(placements) {
        let result = "";
        for (let i = 0; i < placements.length; i++) {
            let placement = placements[i];
            let unit = units[placement.id];
            if (!unit)
                continue;
            let type = unitTypes[unit.typeId];
            let stats = getStatesAtLevel(type, unit.level);
            result += `${i + 1} ${type.name} atk:${stats.attack} hp:${stats.hp}\n`;
        }
        return result;
    }

    function createUnitNode(unitId, id) {
        let unit = units[unitId];
        let unitTemplate = document.getElementById("unit-template").content;
        let type = unitTypes[unit.typeId];
        let stats = getStatesAtLevel(type, unit.level);
        if(id)
            unitTemplate.querySelector(".unit").id = id;
        unitTemplate.querySelector(".unit").dataset.id = unit.id;
        unitTemplate.querySelector(".unit .header").innerText = type.name;
        unitTemplate.querySelector(".unit .attack").innerText = stats.attack;
        unitTemplate.querySelector(".unit .hp .numeric").innerText = stats.hp + "/" + stats.hp;
        unitTemplate.querySelector(".unit .hp .current").style.width = "100%";
        unitTemplate.querySelector(".unit .level").innerText = unit.level;
        return document.importNode(unitTemplate, true);
    }

    function renderLane(placements) {
        let parent = document.getElementById("lane");

        let placementNodes = parent.children;
        for (let i = 0; i < placementNodes.length; i++) {
            let placementNode = placementNodes[i];
            let unitNodes = placementNode.children;
            if (unitNodes.length > 0)
                unitNodes[0].remove();
            if (i >= placements.length)
                continue;
            let placement = placements[i];
            let unitId = placement.id;
            if (!unitId)
                continue;
            let unitNode = createUnitNode(unitId, parent.id + "-" + unitId);
            placementNode.appendChild(unitNode);
        }
    }

    function renderLog(log, laneA, laneB) {
        let result = "";
        let unitsA = laneA.units.map(u => units[u.id]);
        let unitsB = laneB.units.map(u => units[u.id]);
        for (let i = 0; i < log.length; i++) {
            let event = log[i];
            result += event.type + " ";
            function getUnitFromId(unitId) {
                let unit = null;
                if (unitId > 0)
                    unit = unitsA[+unitId - 1];
                if (unitId < 0)
                    unit = unitsB[-unitId - 1];
                if (!unit)
                    return "";
                var type = unitTypes[unit.typeId];
                return type.name;
            }
            if (event.source)
                result += getUnitFromId(event.source) + " ";
            if (event.target)
                result += getUnitFromId(event.target) + " ";
            if (event.value)
                result += event.value + " ";
            result += "\n";
        }
        return result;
    }

    async function updateLeaderBoardFights() {
        let entries = await apiGetCall("leaderboard/fights?max=10");
        let result = "";
        for (let i = 0; i < entries.length; i++) {
            let entry = entries[i];
            result += entry.name + ": " + entry.score + "\n";
        }
        document.getElementById("leaderboard-fights").innerText = result;
    }

    function addChatMessage(message) {
        let div = document.createElement("div");
        div.innerText = message.name + ": " + message.text;
        document.getElementById("chat").append(div);
    }

    async function joinChat() {
        var recentChat = await apiGetCall("chat/join");
        for (let i = 0; i < recentChat.length; i++) {
            addChatMessage(recentChat[i]);
        }
    }

    async function initServerMessages() {
        await initWebSocket(processMessage);
    }

    async function loadCurrentRoom() {
        let room = await apiGetCall("player/room");
        let roomType = roomTypes[room.type];
        document.getElementById("room-level").innerText = room.level;
        document.getElementById("room-title").innerText = roomType.title;
        document.getElementById("room-description").innerText = roomType.description;
    }

    async function loadCurrencies() {
        currencies = arrayToDictionaryById(await apiGetCall("player/currency"));
        var s = "";
        for (let currencyId in currencyTypes) {
            var currencyType = currencyTypes[currencyId];
            let currency = currencies[currencyId] ? currencies[currencyId].value : 0;
            s += currencyType.name + ": " + currency + "\n";
        }
        document.getElementById("currencies-list").innerText = s;
    }

    async function loadUnits() {
        units = arrayToDictionaryById(await apiGetCall("player/unit"));

        let parent = document.getElementById("unit-list");
        parent.querySelectorAll('*').forEach(n => n.remove());
        for (let unitId in units) {
            parent.appendChild(createUnitNode(unitId));
            let button = document.createElement("button");
            button.dataset.action = "levelUp";
            button.dataset.actionArgs = unitId;
            button.innerText = "level up";
            parent.appendChild(button);
        }
    }

    function processMessages(messages) {
        for (var i = 0; i < messages.length; i++) {
            processMessage(messages[i]);
        }
    }

    function processMessage(message) {
        var handler = messageHandlers[message.type];
        if (!handler) {
            alert("message handler missing: " + message.type);
        }
        handler(message);
    }

    function getLaneData(node) {
        let placementNodes = node.children;
        let data = [];
        for (let i = 0; i < placementNodes.length; i++) {
            let placementNode = placementNodes[i];
            let unitNodes = placementNode.children;
            if (unitNodes.length > 0)
                data.push({ id: unitNodes[0].dataset.id });
            else
                data.push({ id: null });
        }
        return data;
    }

    let actions = {
        giveMeCC: async () => {
            await apiPostCall("player/currency/cc/gain", 100);
            await loadCurrencies();
        },
        levelUp: async unitId => {
            processMessages(await apiPostCall(`player/unit/${unitId}/up`));
        },

        saveLane: async () => {
            let units = getLaneData(document.getElementById("lane"));
            await apiPostCall("player/lane",
                {
                    id: "default",
                    units: units
                });
        },
        fightLane: async () => {
            let units = getLaneData(document.getElementById("lane"));
            let laneA = { "units": units };
            let laneB = { "units": units };
            let log = await apiPostCall("player/fight",
                {
                    laneA: laneA,
                    laneB: laneB
                });
            document.getElementById("battle-log").innerText = renderLog(log, laneA, laneB);
        },
        leaderboardFightsRecalc: async () => {
            await apiPostCall("game/update-fights-leaderboard");
            await updateLeaderBoardFights();
        },
        leaderboardFightsRefresh: async () => {
            await updateLeaderBoardFights();
        },
        chatPost: async () => {
            let text = document.getElementById("chat-message").value;
            await apiPostCall("chat", text);
        },
        collectRoom: async () => {
            processMessages(await apiPostCall("player/room/collect"));
        }
    }

    document.getElementById("gui").addEventListener("click", (e) => {
        let target = e.target;
        if (target.dataset.action) {
            e.preventDefault();
            let actionName = target.dataset.action;
            let actionArgs = target.dataset.actionArgs;
            let action = actions[actionName];
            if (action)
                action(actionArgs);
            else
                alert("action missing: " + actionName);
        }
    });


    if (await loadUserInfo()) {
        await loadUnits();
        await loadLane();
        await loadCurrencies();
        await updateLeaderBoardFights();
        await initServerMessages();
        await joinChat();
        await loadCurrentRoom();



        {
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

            let hackyStartNode = null;

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

            let dragAndDrops = {
                unitList: {
                    unitCell: (startNode, dragNode, endNode) => {
                        let unitId = dragNode.dataset.id;
                        let unitNodeId = endNode.parentNode.id + "-" + unitId;
                        let unitNode = document.getElementById(unitNodeId) || createUnitNode(unitId, unitNodeId);

                        if (endNode.children.length > 0) {
                            endNode.children[0].remove();
                        }
                        endNode.appendChild(unitNode);
                    }
                },
                unitCell: {
                    unitCell: (startNode, dragNode, endNode) => {
                        if (endNode.children.length > 0) {
                            let targetNode = endNode.children[0];
                            endNode.appendChild(dragNode);
                            startNode.appendChild(targetNode);
                        } else {
                            endNode.appendChild(dragNode);
                        }
                    },
                    unitList: (startNode, dragNode, endNode) => {
                        dragNode.remove();
                    }
                }
            };

            function getDragAndDropAction(start, end) {
                let dropList = dragAndDrops[start];
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
            /*
            let units = document.getElementsByClassName("unit");
            let places = document.getElementsByClassName("unit-place");
            for (let i = 0; i < units.length; i++) {
                units[i].addEventListener("dragstart", e => {
                    e.dataTransfer.setData("text", e.target.id);
                    console.log("dragstart: " + e.target.id);
                });
                units[i].addEventListener("dragover", e => {
                    console.log("dragover unit");
                    e.preventDefault();
                });
            }
            for (let i = 0; i < places.length; i++) {
                places[i].addEventListener("drop", e => {
                    let id = e.dataTransfer.getData("text");
                    console.log("drop: " + id);
                    e.target.append(document.getElementById(id));
                    //e.preventDefault();
                });
                places[i].addEventListener("dragover", e => {
                    console.log("dragover place");
                    e.preventDefault();
                });
            }*/
        }
    }
}

document.addEventListener('DOMContentLoaded', () => startGame());
