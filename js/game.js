async function startGame() {
    let unitTypes = arrayToDictionaryById(await loadJson("json/unit-types.json"));
    let roomTypes = arrayToDictionaryById(await loadJson("json/room-types.json"));
    let currencyTypes = arrayToDictionaryById(await loadJson("json/currencies.json"));
    let achievementDescriptions = arrayToDictionaryById(await loadJson("json/achievements.json"));
    window.T = new Texer("json/texer.json");
    let units = {};
    let encounterUnits = {};
    let currencies = {};
    currentBattle = buildReplay(currentBattle.log, currentBattle.squadA, currentBattle.squadB);

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
            deleteAllChildren(placementNode);
            if (i >= placements.length)
                continue;
            let placement = placements[i];
            let unitId = placement.id;
            if (!unitId)
                continue;
            let unit = units[unitId];
            if (!unit)
                continue;
            let unitNode = createUnitNode(unit,
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
            if (event.unit)
                result += getUnitFromId(event.unit) + " ";
            if (event.attribute)
                result += event.attribute + " ";
            if (event.value)
                result += event.value + " ";
            result += "\n";
        }
        return result;
    }

    function buildReplay(log, squadA, squadB) {
        let result = { steps: [], units: { 0: [], 1: [] } };
        let unitsA = squadA.order.map(u => squadA.units[u.id]);
        let unitsB = squadB.order.map(u => squadB.units[u.id]);
        //console.log(unitsA);
        // spawn units
        for (let i = 0; i < 6; i++) {
            if (unitsB[i]) {
                result.units[1][i] = unitsB[i];
                result.steps.push({
                    action: "SPAWN",
                    data: unitsB[i],
                    pos: 5 - i,
                    target: "other"
                });
            }
            if (unitsA[i]) {
                result.units[0][i] = unitsA[i];
                result.steps.push({
                    action: "SPAWN",
                    data: unitsA[i],
                    pos: 5 - i,
                    target: "you"
                });
            }
        }
        // todo : show extra (auras...)
        // fight
        for (let i = 0; i < log.length; i++) {
            let event = log[i];
            let unit;
            switch (event.type) {
                case "attack":
                    unit = event.source > 0 ? unitsA[+event.source - 1] : unitsB[-event.source - 1];
                    result.steps.push({
                        action: "GHIT",
                        data: unit,
                        value: event.value,
                        pos: (event.source > 0 ? event.source - 1 : -event.source - 1),
                        target: event.target > 0 ? "you" : "other"
                    });
                    break;
                case "damaged":
                    unit = event.target > 0 ? unitsA[+event.target - 1] : unitsB[-event.target - 1];
                    result.steps.push({
                        action: "RHIT",
                        data: unit,
                        value: event.value,
                        pos: (event.target > 0 ? event.target - 1 : -event.target - 1),
                        target: event.target > 0 ? "you" : "other"
                    });
                    break;
                case "death":
                    result.steps.push({
                        action: "DIE",
                        pos: Math.abs(event.target) - 1,
                        target: event.target > 0 ? "you" : "other"
                    });
                    break;
                case "result":
                    break;
            }
        }
        console.log(result);
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

    async function loadCurrentRun() {
        processMessage(await apiGetCall("player/run"));
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
        fightEncounter: async () => {
            let lane = { "units": getLaneData(document.getElementById("lane")) };
            processMessages(await apiPostCall("player/run/fight", lane));
        },
        collectRoom: async () => {
            processMessages(await apiPostCall("player/run/collect"));
        },
        newRun: async () => {
            processMessages(await apiPostCall("player/run/new"));
        },
        login: async () => {
            let data = {
                name: document.getElementById("name").value,
                password: document.getElementById("password").value
            };
            await apiPostCall("account/login", data);
        },
        chatToggle: () => {
            let gc = document.querySelector('#guiChat');
            gc.classList.toggle('hidden');
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
                encounterUnits = room.encounter.squad.units;
                fillLane(laneNode, room.encounter.squad.units, room.encounter.squad.order);
            }
        },
        battle: message => {
            document.getElementById("battle-log").innerText = renderLog(message.log, message.squadA, message.squadB);
            //drawBattle(ctx, buildReplay(message.log, message.squadA, message.squadB));
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

    registerTooltips({
        unit: id => {
            let unitTemplate = document.getElementById("unit-tooltip-template").content;
            let node = document.importNode(unitTemplate, true);

            let unit = units[id];
            if (!unit)
                unit = encounterUnits[id];
            let type = unitTypes[unit.typeId];
            let stats = getStatesAtLevel(type, unit.level);

            node.querySelector("h2").innerText = type.name;
            return node;
        }
    });

    if (await loadUserInfo()) {
        await loadUnits();
        await loadLane();
        await loadCurrencies();
        await updateLeaderBoardFights();
        await initServerMessages();
        await joinChat();
        await loadCurrentRun();
        canvas = document.getElementById("bAnim");
        ctx = canvas.getContext("2d");
        W = canvas.width;
        H = canvas.height;
    }
    initEngine();
    CHandler = new Graphics();
    CHandler.loop();
}

function Graphics() {
    this.drawBattle = function (ctx) {//, steps, A, B
        var youPos = [
            { x: W / 2 - 120, y: H - 100 },
            { x: W / 2 - 240, y: H - 122 },
            { x: W / 2 - 320, y: H - 180 },
            { x: W / 2 - 380, y: H - 230 },
            { x: W / 2 - 420, y: H - 270 },
            { x: W / 2 - 440, y: H - 300 },
            { x: W / 2 - 450, y: H - 320 },
        ];
        var otherPos = [
            { x: W / 2 + 120, y: H - 100 },
            { x: W / 2 + 240, y: H - 122 },
            { x: W / 2 + 320, y: H - 180 },
            { x: W / 2 + 380, y: H - 230 },
            { x: W / 2 + 420, y: H - 270 },
            { x: W / 2 + 440, y: H - 300 },
            { x: W / 2 + 450, y: H - 320 },
        ]
        if (currentBattle.steps[bStep] !== undefined) {
            var step = currentBattle.steps[bStep];
            var delta = clamp(bStepAnim - bStep, 0, 1);
            var side;
            //currentBattle
            for (var sid = 0; sid <= 1; ++sid) {
                side = sid ? "other" : "you";
                var pos = sid ? otherPos : youPos;
                for (var i = 5; i >= 0; --i) {
                    if (step.target == side && step.pos == i && step.action == "SPAWN") {
                        ctx.save();
                        ctx.globalAlpha = delta;
                        //this.drawMonster(ctx, gBattle[side][i].id, pos[i].x, pos[i].y, gBattle[side][i], reverse, mapf(i, 0, 6, 2, 1), gBattle[side][i].lvl, undefined, undefined, gBattle[side][i].prom);
                        this.drawMonster(ctx, 0, pos[i + 1].x, pos[i + 1].y, 0, false, mapf(i + 1, 0, 6, 2, 1), 1, undefined, undefined, 0);
                        ctx.restore();
                    } else if (step.target == side && step.pos == i && step.action == "DIE") {
                        ctx.save();
                        ctx.globalAlpha = 1 - delta;
                        var rpos = sid ? youPos : otherPos;
                        this.drawMonster(ctx, 0, pos[i + 1].x, pos[i + 1].y, 0, false, mapf(i + 1, 0, 6, 2, 1), 1, undefined, undefined, 0);
                        ctx.restore();
                    } else {
                        if (currentBattle.units[sid][i].show == true) {
                            this.drawMonster(ctx, 0, pos[i + 1].x, pos[i + 1].y, 0, false, mapf(i + 1, 0, 6, 2, 1), 1, undefined, undefined, 0);
                        }
                        if (step.target == side && step.pos == i && step.action == "GHIT") {
                            var rpos = sid ? youPos : otherPos;
                            //this.drawMonster(ctx, 0, pos[i + 1].x, pos[i + 1].y, 0, false, mapf(i + 1, 0, 6, 2, 1), 1, undefined, undefined, 0);
                            text(ctx, "Give Hit: " + step.value, rpos[i + 1].x, rpos[i + 1].y - 20, "40px " + FONT, "black", "left", "middle");
                        }
                        if (step.target == side && step.pos == i && step.action == "RHIT") {
                            //this.drawMonster(ctx, 0, pos[i + 1].x, pos[i + 1].y, 0, false, mapf(i + 1, 0, 6, 2, 1), 1, undefined, undefined, 0);
                            text(ctx, "Receive Hit: " + step.value, pos[i + 1].x, pos[i + 1].y - 20, "40px " + FONT, "black", "left", "middle");
                        }
                    }
                }
            }
        }
        var x = W * 0.05;
        var y = H * 0.94;
        text(ctx, "Battle speed: x" + battleSpeed, W * 0.4, y - 125, "32px " + FONT, "black", "left", "middle");
    }
    this.drawMonster = function (ctx, id, x, y, bstats, reverse, scale, level, available, base, prom, hide_prom) {
        reverse = reverse || false;
        scale = scale || 1;
        level = level || 1;
        if (available == undefined) available = true;
        if (base == undefined) base = true;
        if (prom == undefined) prom = 0;
        if (hide_prom == undefined) hide_prom = false;
        //
        ctx.save();
        ctx.translate(x, y);
        if (reverse) ctx.scale(-1, 1);
        T.draw(ctx, "7bfg", -T.width("7bfg") * scale / 2, -(T.height("7bfg") + 10) * scale, T.width("7bfg") * scale, T.height("7bfg") * scale);
        ctx.restore();
    }
    this.update = function (delta) {
        T.stepAnim();
        if (delta > 1000 / 20 || delta < 0) delta = 1000 / 20;
        bStepAnim += (delta / 1600) * battleSpeed;
        let cstep = Math.floor(bStepAnim);
        if (currentBattle.steps[bStep] !== undefined && cstep > bStep) {
            if (currentBattle.steps[bStep].action == "SPAWN")
                currentBattle.units[currentBattle.steps[bStep].target == "you" ? 0 : 1][currentBattle.steps[bStep].pos].show = true;
            if (currentBattle.steps[bStep].action == "DIE")
                currentBattle.units[currentBattle.steps[bStep].target == "you" ? 0 : 1][currentBattle.steps[bStep].pos].show = false;
            bStep++;
        }
    }
    this.loop = function () {
        var now = Date.now();
        if (!last) last = now;
        var delta = now - last;
        CHandler.update(delta);
        last = now;
        ctx.clearRect(0, 0, W, H);
        CHandler.drawBattle(ctx);
        requestAnimFrame(CHandler.loop);
    }

}

window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback) {
            window.setTimeout(callback, 1000 / 60);
        };
})();

function clamp(v, a, b) {
    return Math.max(Math.min(v, b), a)
}
function mapf(s, a1, a2, b1, b2) {
    return b1 + (s - a1) * (b2 - b1) / (a2 - a1)
}
function fix(str) {
    var pos = str.indexOf("px");
    if (pos !== -1) {
        var num = parseFloat(str.substring(0, pos));
        return (num / 2).toString() + str.substring(pos);
    } else return str;
}
function text(ctx, text, x, y, font, fill, align, valign, stroke, strokeWidth) {
    ctx.fillStyle = fill || "black";
    ctx.textAlign = align || "left";
    ctx.textBaseline = valign || "top";
    ctx.font = fix(font) || "12px Arial";
    if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth / 2 || 1;
        ctx.strokeText(text, x, y + 2);
    }
    ctx.fillText(text, x, y + 2);
}


var canvas, ctx, W, H, last, bStep, bStepAnim, CHandler, currentBattle;
currentBattle = {
    "log": [
        { "type": "attack", "source": 1, "target": -1, "value": 360 },
        { "type": "damaged", "source": 0, "target": -1, "value": 360 },
        { "type": "death", "source": 0, "target": -1, "value": 0 },
        { "type": "attack", "source": 1, "target": -2, "value": 360 },
        { "type": "damaged", "source": 0, "target": -2, "value": 360 },
        { "type": "death", "source": 0, "target": -2, "value": 0 },
        { "type": "attack", "source": 1, "target": -3, "value": 360 },
        { "type": "damaged", "source": 0, "target": -3, "value": 360 },
        { "type": "death", "source": 0, "target": -3, "value": 0 },
        { "type": "attack", "source": 1, "target": -4, "value": 360 },
        { "type": "damaged", "source": 0, "target": -4, "value": 540 }, { "type": "death", "source": 0, "target": -4, "value": 0 }, { "type": "attack", "source": -4, "target": 1, "value": 48 }, { "type": "damaged", "source": 0, "target": 1, "value": 48 }, { "type": "attack", "source": 1, "target": -4, "value": 360 }, { "type": "damaged", "source": 0, "target": -4, "value": 540 }, { "type": "death", "source": 0, "target": -4, "value": 0 }, { "type": "attack", "source": 1, "target": -5, "value": 360 }, { "type": "damaged", "source": 0, "target": -5, "value": 360 }, { "type": "death", "source": 0, "target": -5, "value": 0 }, { "type": "attack", "source": 1, "target": -6, "value": 360 }, { "type": "damaged", "source": 0, "target": -6, "value": 360 }, { "type": "death", "source": 0, "target": -6, "value": 0 },
        { "type": "result", "source": 0, "target": 0, "value": 1 }
    ],
    "result": 1,
    "squadA": {
        "units": { "002e1793f1584e48b63d179f6519426e": { "typeId": "hunter", "level": 100, "id": "002e1793f1584e48b63d179f6519426e" }, "046313480ad84300a36ca619cc8cf664": { "typeId": "carl", "level": 100, "id": "046313480ad84300a36ca619cc8cf664" }, "055a5f6c3b4343e29543d512aea9da54": { "typeId": "jet", "level": 100, "id": "055a5f6c3b4343e29543d512aea9da54" }, "0fcc3f3b549f4803a64536ed92ab28ee": { "typeId": "test", "level": 100, "id": "0fcc3f3b549f4803a64536ed92ab28ee" }, "120724d2821b4b8196cec1187f3ffdfb": { "typeId": "test", "level": 100, "id": "120724d2821b4b8196cec1187f3ffdfb" }, "13d81ed50bda430fbb588358a914bd97": { "typeId": "jet", "level": 100, "id": "13d81ed50bda430fbb588358a914bd97" } },
        "order": [{ "id": "002e1793f1584e48b63d179f6519426e" }, { "id": "046313480ad84300a36ca619cc8cf664" }, { "id": "055a5f6c3b4343e29543d512aea9da54" }, { "id": "0fcc3f3b549f4803a64536ed92ab28ee" }, { "id": "120724d2821b4b8196cec1187f3ffdfb" }, { "id": "13d81ed50bda430fbb588358a914bd97" }
        ]
    },
    "squadB": {
        "units": { "e9a7f44d40bfb6884f7a203eea69de5f": { "typeId": "jet", "level": 17, "id": "e9a7f44d40bfb6884f7a203eea69de5f" }, "cbef6a9f7abe5ae964da78fccf5531c4": { "typeId": "geum", "level": 10, "id": "cbef6a9f7abe5ae964da78fccf5531c4" }, "666a47aa72b1860c5412a628e3e4b204": { "typeId": "geum", "level": 15, "id": "666a47aa72b1860c5412a628e3e4b204" }, "ef9a009253f65aeb140ef486647428fd": { "typeId": "carl", "level": 6, "id": "ef9a009253f65aeb140ef486647428fd" }, "72e96d5723fded183776f572eebfc3f7": { "typeId": "geum", "level": 11, "id": "72e96d5723fded183776f572eebfc3f7" }, "cce34bda883ac8c52c6cce1f1daeefcf": { "typeId": "hunter", "level": 3, "id": "cce34bda883ac8c52c6cce1f1daeefcf" } },
        "order": [{ "id": "e9a7f44d40bfb6884f7a203eea69de5f" }, { "id": "cbef6a9f7abe5ae964da78fccf5531c4" }, { "id": "666a47aa72b1860c5412a628e3e4b204" }, { "id": "ef9a009253f65aeb140ef486647428fd" }, { "id": "72e96d5723fded183776f572eebfc3f7" }, { "id": "cce34bda883ac8c52c6cce1f1daeefcf" }
        ]
    },
    "type": "battle"
};
bStep = 0;
bStepAnim = 0;
var battleSpeed = 2;
var FONT = 'Arial';
document.addEventListener('DOMContentLoaded', () => startGame());
