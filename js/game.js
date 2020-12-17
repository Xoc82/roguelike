
async function startGame() {
    let unitTypes = arrayToDictionaryById(await loadJson("json/unit-types.json"));
    let roomTypes = arrayToDictionaryById(await loadJson("json/room-types.json"));
    let currencyTypes = arrayToDictionaryById(await loadJson("json/currencies.json"));
    let achievementDescriptions = arrayToDictionaryById(await loadJson("json/achievements.json"));
    let skills = arrayToDictionaryById(await loadJson("json/skills.json"));
    let units = {};
    let encounterUnits = {};
    let currencies = {};


    function setUserInfo(text) {
        document.getElementById("user-info").innerText = text;
    }

    function setLane(placements) {
        let laneNode = document.getElementById("lane");
        fillLane(laneNode, units, placements);
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

    function createUnitNode(unit, options) {
        if (!options)
            options = {}
        let unitTemplate = document.getElementById("unit-template").content;
        let type = unitTypes[unit.typeId];
        let stats = getStatesAtLevel(type, unit.level);
        let node = document.importNode(unitTemplate, true);
        if (options.id)
            node.querySelector(".unit").id = options.id;
        if (options.draggable)
            node.querySelector(".unit").draggable = true;
        node.querySelector(".unit").dataset.id = unit.id;
        node.querySelector(".unit .header").innerText = type.name;
        node.querySelector(".unit .attack").innerText = stats.attack;
        node.querySelector(".unit .hp .numeric").innerText = stats.hp + "/" + stats.hp;
        node.querySelector(".unit .hp .current").style.width = "100%";
        node.querySelector(".unit .level").innerText = unit.level;
        return node;
    }


    function fillLane(laneNode, units, placements) {

        let placementNodes = laneNode.children;
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
            let unitNode = createUnitNode(units[unitId],
                {
                    id: laneNode.id + "-" + unitId,
                    draggable: !!placementNode.dataset.dropZone
                });
            placementNode.appendChild(unitNode);
        }
    }

    function renderLog(log, squadA, squadB) {
        let result = "";
        let unitsA = squadA.order.map(u => squadA.units[u.id]);
        let unitsB = squadB.order.map(u => squadB.units[u.id]);
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
        processMessage(await apiGetCall("player/room"));
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

        let parentNodes = document.querySelectorAll(".unitlist");
        for (let i = 0; i < parentNodes.length; i++) {
            let parent = parentNodes[i];
            parent.querySelectorAll('*').forEach(n => n.remove());
            for (let unitId in units) {
                let unitNode = createUnitNode(units[unitId],
                    {
                        draggable: !!parent.dataset.dropZone
                    });
                parent.appendChild(unitNode);
                let button = document.createElement("button");
                button.dataset.action = "levelUp";
                button.dataset.actionArgs = unitId;
                button.innerText = "level up";
                parent.appendChild(button);
            }
        }
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

    registerActions({
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
        fightEncounter: async () => {
            let lane = { "units": getLaneData(document.getElementById("lane")) };
            processMessages(await apiPostCall("player/room/fight", lane));
        },
        leaderboardFightsRecalc: async () => {
            await apiPostCall("game/update-fights-leaderboard");
            await updateLeaderBoardFights();
        },
        leaderboardFightsRefresh: async () => {
            await updateLeaderBoardFights();
        },
        chatPost: async () => {
            let input = document.getElementById("chat-message");
            let text = input.value;
            input.value = "";
            await apiPostCall("chat", text);
        },
        collectRoom: async () => {
            processMessages(await apiPostCall("player/room/collect"));
        },
        newRun: async () => {
            processMessages(await apiPostCall("player/new-run"));
        },
        hardReset: async () => {
            processMessages(await apiPostCall("player/reset"));
        },
        login: async () => {
            let data = {
                name: document.getElementById("name").value,
                password: document.getElementById("password").value
            };
            await apiPostCall("account/login", data);
        }
    });

    registerMessageHandlers({
        chat: message => {
            addChatMessage(message);
        },
        currency: async message => {
            await loadCurrencies();
        },
        unit: async message => {
            await loadUnits();
        },
        room: message => {
            let room = message.room;
            let roomType = roomTypes[room.type];
            document.getElementById("room-level").innerText = room.level;
            document.getElementById("room-title").innerText = roomType.title;
            document.getElementById("room-description").innerText = roomType.description;
            let encounterNode = document.getElementById("encounter");
            let laneNode = document.getElementById("encounter-lane");
            encounterNode.style.display = "none";
            if (room.type === "combat") {
                encounterNode.style.display = "block";
                encounterUnits = room.encounter.units;
                fillLane(laneNode, room.encounter.squad.units, room.encounter.squad.order);
            }
        },
        battle: message => {
            document.getElementById("battle-log").innerText = renderLog(message.log, message.squadA, message.squadB);
        },
        achievement: message => {
            let description = achievementDescriptions[message.achievement];
            alert("Achievement unlocked: " + description.name + "\n" + description.description);
        }
    });

    registerDragAndDropHandlers({
        unitList: {
            unitCell: (startNode, dragNode, endNode) => {
                let unitId = dragNode.dataset.id;
                let unitNodeId = endNode.parentNode.id + "-" + unitId;
                let unitNode = document.getElementById(unitNodeId) || createUnitNode(units[unitId],
                    {
                        id: unitNodeId,
                        draggable: true
                    });

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
    });


    if (await loadUserInfo()) {
        await loadUnits();
        await loadLane();
        await loadCurrencies();
        await updateLeaderBoardFights();
        await initServerMessages();
        await joinChat();
        await loadCurrentRoom();
    }
    initEngine();
}

document.addEventListener('DOMContentLoaded', () => startGame());
