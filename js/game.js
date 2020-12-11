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

    function registerButtons() {
        registerClickOnClass("create-test-lane",
            () => {
                setLane([
                    { "id": "carl" },
                    { "id": "hunter" },
                    { "id": "jet" }
                ]);
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
            async  () => {
                let text = document.getElementById("chat-message").value;
                await apiPostCall("/chat", text);
            });
    }

    function setUserInfo(text) {
        document.getElementById("user-info").innerText = text;
    }

    function setLane(units) {
        document.getElementById("lane").value = JSON.stringify(units);
        document.getElementById("setup-printed").innerText = renderSetup(units);
    }


    async function loadUserInfo() {
        let user = await apiGetCall("/account/me");
        if (!user.authenticated) {
            setUserInfo(" not logged in");
            return;
        }
        setUserInfo(user.name + " " + user.id);
        let lane = await apiGetCall("/player/lane/default");
        setLane(lane.units);
    }

    function renderSetup(units) {
        let result = "";
        for (let i = 0; i < units.length; i++) {
            let unit = units[i];
            let type = unitTypes[unit.id];
            result += `${i + 1} ${type.name} atk:${type.attack} hp:${type.hp}\n`;
        }
        return result;
    }

    function renderLog(log, laneA, laneB) {
        let result = "";
        for (let i = 0; i < log.length; i++) {
            let event = log[i];
            result += event.type + " ";
            function getUnitFromId(unitId) {
                let type = null;
                if (unitId > 0)
                    type = unitTypes[laneA.units[+unitId - 1].id];
                if (unitId < 0)
                    type = unitTypes[laneB.units[-unitId - 1].id];
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

    function addChatMessage(message)
    {
        let div = document.createElement("div");
        div.innerText = message.name + ": " + message.text;
        document.getElementById("chat").append(div);
    }

    registerButtons();
    await loadUserInfo();
    await updateLeaderBoardFights();
    var recentChat = await apiGetCall("/chat/recent");
    for (let i = 0; i < recentChat.length; i++) {
        addChatMessage(recentChat[i]);
    }
    await initWebSocket(message => {
        if(message.type === "chat") {
            addChatMessage(message);
        }else{
            alert(message);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => startGame());
