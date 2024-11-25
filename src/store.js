import { writable } from "svelte/store";

export const global = writable({
    user: "",
    gameid: "",
    rooms: "",
    roomdata: "",
    roommax: "",
    roundtime: "",
    ingame: false,
});