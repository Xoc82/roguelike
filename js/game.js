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
    let units = {};

    function registerButtons() {
        registerClickOnClass("create-test-lane",
            () => {
                var placements = [];
                for (let unitId in units) {
                    placements.push({ id: unitId });
                }
                setLane(placements);
            });
        registerClickOnClass("save",
            async () => {
                let units = JSON.parse(document.getElementById("lane").value);
                setLane(units);
                await apiPostCall("/player/lane",
                    {
                        id: "default",
                        units: units
                    });
            });
        registerClickOnClass("fight",
            async () => {
                let units = JSON.parse(document.getElementById("lane").value);
                let laneA = { "units": units };
                let laneB = { "units": units };
                let log = await apiPostCall("/player/fight",
                    {
                        laneA: laneA,
                        laneB: laneB
                    });
                document.getElementById("battle-log").innerText = renderLog(log, laneA, laneB);
            });
        registerClickOnClass("leaderboard-fights-recalc",
            async () => {
                await apiPostCall("/game/update-fights-leaderboard");
                await updateLeaderBoardFights();
            });
        registerClickOnClass("leaderboard-fights-refresh",
            async () => {
                await updateLeaderBoardFights();
            });

        registerClickOnClass("chat-post",
            async () => {
                let text = document.getElementById("chat-message").value;
                await apiPostCall("/chat", text);
            });

        registerClickOnClass("room-collect",
            async () => {
                await apiPostCall("/player/room/collect");
            });
    }

    function setUserInfo(text) {
        document.getElementById("user-info").innerText = text;
    }

    function setLane(placements) {
        document.getElementById("lane").value = JSON.stringify(placements);
        renderLane();
    }


    async function loadUserInfo() {
        let user = await apiGetCall("/account/me");
        if (!user.authenticated) {
            setUserInfo(" not logged in");
            return false;
        }
        setUserInfo(user.name + " " + user.id);
        return true;
    }

    async function loadLane() {
        let lane = await apiGetCall("/player/lane/default");
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
            if(!unit)
                continue;
            let type = unitTypes[unit.typeId];
            let stats = getStatesAtLevel(type, unit.level);
            result += `${i + 1} ${type.name} atk:${stats.attack} hp:${stats.hp}\n`;
        }
        return result;
    }

    function renderLane() {
        var placements = JSON.parse(document.getElementById("lane").value);
        var text = renderSetup(placements);
        document.getElementById("setup-printed").innerText = text;
    }

    function renderLog(log, laneA, laneB) {
        let result = "";
        var unitsA = laneA.units.map(u => units[u.id]);
        var unitsB = laneB.units.map(u => units[u.id]);
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
        let entries = await apiGetCall("/leaderboard/fights?max=10");
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
        var recentChat = await apiGetCall("/chat/join");
        for (let i = 0; i < recentChat.length; i++) {
            addChatMessage(recentChat[i]);
        }
    }

    async function initServerMessages() {
        await initWebSocket(message => {
            if (message.type === "chat") {
                addChatMessage(message);
            } else {
                alert(message);
            }
        });
    }

    async function loadCurrentRoom() {
        let room = await apiGetCall("/player/room");
        let roomType = roomTypes[room.type];
        document.getElementById("room-level").innerText = room.level;
        document.getElementById("room-title").innerText = roomType.title;
        document.getElementById("room-description").innerText = roomType.description;
    }

    async function loadUnits() {
        units = arrayToDictionaryById(await apiGetCall("/player/unit"));
        var s = "";
        for (let unitId in units) {
            let unit = units[unitId];
            let unitType = unitTypes[unit.typeId];
            s += unitId + " " + unitType.name + " " + unit.level + " <button class='unit-up' data-id='" + unitId + "'>level up</button><br>";
        }
        document.getElementById("unit-list").innerHTML = s;
    }

    registerClickOnClass("unit-list",
        async (e) => {
            let target = e.target;
            if (target.classList.contains("unit-up")) {
                e.preventDefault();
                let unitId = target.dataset.id;
                await apiPostCall(`/player/unit/${unitId}/up`);
                await loadUnits();
                renderLane();
            }
        });


    registerButtons();
    if (await loadUserInfo()) {
        await loadUnits();
        await loadLane();
        await updateLeaderBoardFights();
        await initServerMessages();
        await joinChat();
        await loadCurrentRoom();
    }
}

document.addEventListener('DOMContentLoaded', () => startGame());
