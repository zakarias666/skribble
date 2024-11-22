<script>
    import { global } from "./store.js";
    import Rooms from "./Rooms.svelte";

    let roomdata = Array.from({ length: $global.roommax }, () => []);
    console.log(roomdata);

    $global.roomdata;
    $: {
        if ($global.roomdata.length > 0) {
            roomdata = JSON.parse($global.roomdata);
        }
    }

    $: console.log($global.roomdata);
    
</script>

<home>
    <img src="/uploads/logo.png" id="home-logo" alt>

    <room-container>
        {#each Array.from({ length: parseInt($global.rooms) }, (_, i) => i + 1) as room}
            <Rooms id={room} data={roomdata[room - 1]} />
        {/each}
        
    </room-container>
</home>

<style>
    img#home-logo {
        aspect-ratio: 5/1;
        width: 750px;
        max-width: 80vw;
        margin: 100px;
    }

    home {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    room-container {
        justify-content: center;
        display: flex;
        flex-wrap: wrap;
        width: 50%;
        height: 200px;
        gap: 20px;
    }
</style>

