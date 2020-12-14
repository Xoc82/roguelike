async function initWebSocket(callback) {
    const socket = new WebSocket("wss://" + location.host + "/ws");


    socket.addEventListener('message', function (event) {

        var data = JSON.parse(event.data);
        callback(data);
    });
}