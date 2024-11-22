<script>
	import { onMount } from "svelte";
	import { global } from "./store.js";
	import Home from "./Home.svelte";
	import Game from "./Game.svelte";
	import Lobby from "./Lobby.svelte";
	import { setupWebSocket } from "./websocketStore.js";

	$global.user;

	$: console.log($global.ingame, "SIUIIII");

	setupWebSocket();

	function handleBeforeUnload(event) {
		if ($global.gameid) {
			import("./websocketStore.js").then(({ sendMessage }) =>
			sendMessage("leave", {'id': $global.gameid, 'username': $global.username})
		);
		event.returnValue = "";
		}
	}

	onMount(() => {
		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	});
</script>

<main>
{#if $global.gameid}
	{#if $global.ingame}
		<Game id={$global.gameid}/>
	{:else}
		<Lobby id={$global.gameid}/>
	{/if}
{:else}
	<Home />
{/if}
</main>


<style>
    main {
		position: absolute;
        width: 100%;
        height: 100%;
        background-color: #0E2666;
    }
</style>
