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