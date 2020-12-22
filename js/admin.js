
async function startGame() {
    let unitTypes = arrayToDictionaryById(await loadJson("json/unit-types.json"));
    let roomTypes = arrayToDictionaryById(await loadJson("json/room-types.json"));
    let currencyTypes = arrayToDictionaryById(await loadJson("json/currencies.json"));
    let achievementDescriptions = arrayToDictionaryById(await loadJson("json/achievements.json"));


    function setUserInfo(text) {
        document.getElementById("user-info").innerText = text;
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
    registerActions({
        giveMeCC: async () => {
            await apiPostCall("player/currency/cc/gain", 100);
            await loadCurrencies();
        },
        leaderboardFightsRecalc: async () => {
            await apiPostCall("game/update-fights-leaderboard");
            await updateLeaderBoardFights();
        },
        reloadJson: async () => {
            await apiPostCall("game/reload-json-definitions");
        },
        hardReset: async () => {
            processMessages(await apiPostCall("player/reset"));
        },
        deploy: async () => {
            let result = await apiPostCall("commands/deploy");
            alert(result);
        },
        login: async () => {
            let data = {
                name: document.getElementById("name").value,
                password: document.getElementById("password").value
            };
            await apiPostCall("account/login", data);
        }
    });

    if (await loadUserInfo()) {
    }
    initEngine();
}


document.addEventListener('DOMContentLoaded', () => startGame());