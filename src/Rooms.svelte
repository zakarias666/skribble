<script>
    import { global } from "./store.js";
    import { setupWebSocket, sendMessage } from "./websocketStore.js";

    setupWebSocket();

    export let id = null;
    export let data = null;

    let disabledButton = "";
    let disabledContainer = "";

    function joinRoom(disabled) {
        if (disabled) return;

        let username = prompt("Enter your name");

        while (!username || username.length < 3) {
            username = prompt("Enter your name (at least 3 characters):");
            if (username === null) {
                alert("Name input canceled.");
                return null;
            } else if (username.length < 3) {
                alert("Name must be at least 3 characters long.");
            }
        }

        $global.username = username;
        $global.gameid = id;
        import("./websocketStore.js").then(({ sendMessage }) =>
            sendMessage("join", {'id': id, 'username': username})
        );
    }

    let playerCount = 0;

    $: {
        try {
            if (data.players.length) {
                playerCount = data.players.length;
            } else {
                playerCount = 0;
            }
        } catch (error) {
            playerCount = 0;
        }
    }


    $: {
        if (data) {
            console.log(data);
            if (playerCount >= $global.roommax || data.status !== 'open') {
                disabledButton = "background-color: grey; cursor: not-allowed;";
                disabledContainer = "border-color: grey;";
            } else {
                disabledButton = "";
                disabledContainer = "";
            }
        } else {
            disabledButton = "";
            disabledContainer = "";
        }
    }

</script>

<div id="container" style="{disabledContainer}">
    <div id="playercount">
        <span>Room {id}</span>
        <span id="count">{playerCount}/{$global.roommax}</span>
    </div>
    <button id="join" on:click={joinRoom(disabledButton)} style="{disabledButton}">Join</button>
</div>

<style>
    #container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100px;
        width: 160px;
        background-color: white;

        border-radius: 20px;
        border: 5px solid #0EB46E;
    }

    #playercount {
        font-size: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 40px;
    }

    button {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #0EB46E;
        width: 80%;
        height: 30%;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 10px;
        margin-top: 10px;
    }
    button:hover {
        filter: brightness(1.1);
    }
    button:focus {
        background-color: #0EB46E;
    }

    span#count {
        margin-top: -3px;
        font-size: 15px;
    }
</style>