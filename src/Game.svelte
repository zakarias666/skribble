<script>
    import { drawings, guesses } from "./websocketStore.js";
    import { onMount } from "svelte";
    import { global } from "./store.js";

    let canvas;
    let ctx;
    let drawing = false;
    let currentUser = null

    let currentWord = null;

    $drawings;
    $guesses;

    let roomdata = Array.from({ length: $global.rooms }, () => []);
    let data = [];
    $: {
        if ($global.roomdata) {
            roomdata = JSON.parse($global.roomdata);
        }
        console.log("Changed roomdata from", roomdata);
        if (roomdata.players) {
            data = roomdata;
        } else {
            data = roomdata[$global.gameid - 1] || { players: [] };
        }
        console.log("Changed roomdata to", data);
        currentUser = data.players.find(player => player.username === $global.username);
        currentWord = data.currentWord;
        console.log(currentUser)
    }


    function drawOnCanvas(strokes) {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        strokes.forEach((stroke) => {
            if (stroke.length > 0) {
                ctx.beginPath();
                ctx.moveTo(stroke[0].x, stroke[0].y);
                for (let i = 1; i < stroke.length; i++) {
                    ctx.lineTo(stroke[i].x, stroke[i].y);
                }
                ctx.stroke();
            }
        });
    }

    $: {
        drawOnCanvas($drawings);
    }

    function startDrawing(event) {
        if (!data) {
            console.error("Room data or players are undefined. Cannot draw.");
            return;
        }

        if (!currentUser) {
            console.error("Current user not found in room data. Cannot draw.");
            return;
        }

        if (!currentUser.brush) {
            console.error("You are not allowed to draw.");
            return; // Stop, hvis brugeren ikke har børsterettigheder
        }

        drawing = true;

        drawings.update((current) => {
            current.push([]); // Start en ny streg
            return current;
        });

        import("./websocketStore.js").then(({ sendMessage }) =>
            sendMessage('newStroke', { id: $global.gameid })
        );
    }





    function draw(event) {
        if (!drawing) return;

        const data = { x: event.offsetX, y: event.offsetY };
        drawings.update((current) => {
            current[current.length - 1].push(data); // Tilføj punkt til den nyeste streg
            return current;
        });

        import("./websocketStore.js").then(({ sendMessage }) =>
            sendMessage('draw', { id: $global.gameid, point: data })
        );
    }




    function stopDrawing() {
        drawing = false;
    }



    function sendGuess(guess) {
        if (guess.trim()) {
            import("./websocketStore.js").then(({ sendMessage }) =>
                sendMessage('guess', {
                    id: $global.gameid,
                    username: $global.username, // Send brugernavnet
                    guess: guess.trim() // Send gættet
                })
            );
        } else {
            console.error('Invalid guess input:', guess);
        }
    }

    onMount(() => {
        const canvasElement = canvas;
        ctx = canvasElement.getContext("2d");
        ctx.lineWidth = 2;
        ctx.strokeStyle = "black";
    });
</script>

<main>
    <div id="game">
        <header>
            {#if currentUser?.brush}
                <div id="word">
                    <strong>{currentWord}</strong>
                </div>
            {/if}
        </header>
        <players>
        {#if data}
            {#each data?.players as player}
                <div id="player-container">
                    <div id="player-name">{player.username}</div>
                    <div id="player-score">Score: {player.score}</div>
                    {#if player.brush === true}
                    <img src="/skribble/uploads/brush.png" id="brush" alt>
                    {/if}
                </div>
            {/each}
        {/if}
        </players>
        <canvas
            bind:this={canvas}
            width="500"
            height="450"
            on:mousedown={startDrawing}
            on:mousemove={draw}
            on:mouseup={stopDrawing}
            on:mouseleave={stopDrawing}
        ></canvas>
        <div id="guesses">
            {#if $guesses.length}
                {#each $guesses as guess}
                    <div id="guess"><strong>{guess.username}:</strong>&nbsp {guess.guess}</div>
                {/each}
            {/if}

            <input
                type="text"
                placeholder="Enter your guess"
                id="guess-input"
                disabled={currentUser?.brush}
                style="cursor: {!currentUser?.brush ? 'text' : 'not-allowed'}"
                on:keydown={(e) => {
                    if (e.key === "Enter") {
                        sendGuess(e.target.value);
                        e.target.value = "";
                    }
                }}
            />
        </div>
    </div>
</main>

<style>
    * {
        box-sizing: border-box;
    }

    #game {
        height: 510px;
        width: 1000px;
        display: grid;
        grid-template-columns: 200px 500px auto;
        grid-template-rows: 60px auto;
        grid-template-areas:
            "header header header"
            "players canvas guesses";
        margin: auto;
        gap: 10px;

        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    }

    header {
        grid-area: header;
        background-image: linear-gradient(to bottom right, #0E2666, #2C56C5);
        backdrop-filter: blur(10px);

        border-radius: 15px;
        border: 5px rgb(103, 129, 185) solid;

        display: flex;
        justify-content: center;
        align-items: center;
    }

    players {
        grid-area: players;
        height: 450px;
        background-image: linear-gradient(to bottom right, #0E2666, #2C56C5);
        backdrop-filter: blur(10px);

        border-radius: 15px;
        border: 5px rgb(103, 129, 185) solid;
    }

    canvas {
        grid-area: canvas;
        background-color: white;
        border-radius: 15px;
        border: 1px rgb(209, 209, 209) solid;
    }

    #guess {
        width: 100%;
        display: flex;
    }
    #guesses {
        grid-area: guesses;
        background-color: white;

        border-radius: 15px;
        display: flex;
        flex-direction: column;
        align-items: end;
        justify-content: end;
        padding: 10px;
        overflow: hidden;
        padding-bottom: 0;
    }
    #guess-input {
        display: flex;
        padding: 10px;
        width: 100%;
        border: none;
        border-top: 1px solid rgb(192, 192, 192);
        border-radius: 0 0 15px 15px;
        margin-top: 7px;
    }
    #guess-input:focus{
        outline: none;
    }

    #player-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: calc(100% - 20px); /* Justerer for padding */
        height: 45px;
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
        width: 70%;
        top: 10%;
        left: 10px;
        font-size: 0.5em;
        font-weight: bold;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }
    #player-score {
        position: absolute;
        width: 70%;
        bottom: 10%;
        left: 10px;
        right: 10px;
        font-size: 0.4em;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
    }

    #brush {
        position: absolute;
        right: 10px;
        top: 7px;
        height: 30px;
        width: 30px;
        z-index: 10;
    }
    #word {
        color: white;
    }
</style>
