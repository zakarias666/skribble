<script>
    import { global } from "./store.js";
    import { setupWebSocket, sendMessage } from "./websocketStore.js";

    setupWebSocket();

    export let id = null;
    let roomdata = Array.from({ length: $global.rooms }, () => ({
        players: [],
        status: 'open'
    }));
    let data = [];
    $: {
        if ($global.roomdata) {
            roomdata = JSON.parse($global.roomdata);
        }
        data = roomdata[id - 1];
    }

    function exit() {
        let username = $global.username;
        console.log({'id': id, 'username': username});
        import("./websocketStore.js").then(({ sendMessage }) =>
            sendMessage("leave", {'id': id, 'username': username})
        );
        $global.gameid = null;
        $global.username = null;
    }

    function startGame() {
        import("./websocketStore.js").then(({ sendMessage }) =>
            sendMessage("start", {'id': id})
        );
    }
</script>

<lobby>
    <players>
        {#if data?.players}
            {#each data.players as player}
                <div id="player-container">
                    <div id="player-name">{player.username}</div>
                </div>
            {/each}
        {/if}
    </players>
    <header>
        Room {id}
    </header>
    <div id="buttons">
        <button on:click={startGame}>Start game</button>
    </div>

    <button id="exit" on:click={exit}>✖</button>
</lobby>


<style>
    players {
        display: flex;
        flex-direction: column;
        grid-area: players;
        width: 100%;
        height: 96%;

        background-image: linear-gradient(to bottom right, #0E2666, #2C56C5);
        backdrop-filter: blur(10px);

        border-radius: 15px;
        border: 5px rgb(103, 129, 185) solid;

        overflow: hidden; /* Sikrer, at indhold ikke stikker ud */
        padding: 2%; /* Giver luft indenfor */
    }

    lobby {
        display: grid;
        grid-template-columns: 1fr 3fr;
        grid-template-areas:
        "players header"
        "players buttons";
        height: 80vh;
        width: 70vw;

        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);

        background: rgba(255, 255, 255, 0.151);
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        padding: 20px;
    }

    header {
        width: 100%;
        text-align: center;
        font-size: 50px;
        color: white;
        margin-top: 30px;
    }

    #buttons {
        grid-area: buttons;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    #exit {
        font-size: 25px;
        color: white;
        position: absolute;
        top: 10px;
        right: 10px;
        content: "Room 1";
        background-color: transparent;
        border: none;
        cursor: pointer;
    }
    #exit:hover {
        color: rgb(228, 228, 228);
    }

    #player-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: calc(100% - 20px); /* Justerer for padding */
        height: 60px;
        font-size: 30px;
        color: white;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);

        border-radius: 10px;
        margin: 5px auto;
    }
    #player-name {
        position: absolute;
        width: 90%;
        top: 23%;
        left: 10px;
        font-size: 0.7em;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }
</style>