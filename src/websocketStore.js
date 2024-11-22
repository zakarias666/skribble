import { writable } from "svelte/store";
import { global } from "./store";

// Writable stores til at dele data
export const drawings = writable([]);
export const guesses = writable([]);

let socket = null;

export function setupWebSocket() {
    if (!socket) { // Sørg for, at WebSocket kun oprettes én gang
        socket = new WebSocket("ws://localhost:3000");

        socket.onopen = () => {
            console.log("WebSocket connected");
        };

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
        
            if (message.type === "correctGuess") {
                console.log(`${message.data.username} guessed the word correctly! The word was: ${message.data.word}`);

            } else if (message.type === "newStroke") {
                drawings.update((current) => {
                    current.push([]); // Start en ny streg
                    return current;
                });
            } else if (message.type === "draw") {
                drawings.update((current) => {
                    current[current.length - 1].push(message.data.point); // Tilføj punkt til den nyeste streg
                    return current;
                });
            } else if (message.type === "drawdata") {
                drawings.set(message.data); // Initialiser eller ryd tegnebrættet
            } else if (message.type === "guess") {
                guesses.update((current) => [...current, message.data]); // Tilføj objektet
            } else if (message.type === "chatdata") {
                guesses.set(message.data.filter(Boolean)); // Initialiser eller ryd chatten
            } else if (message.type === "roomcount") {
                global.update((current) => {
                    return { ...current, rooms: message.data };
                });
            } else if (message.type === "roommax") {
                global.update((current) => {
                    return { ...current, roommax: message.data };
                });
            } else if (message.type === "roomdata") {
                global.update((current) => {
                    console.log("Updating roomdata with:", message.data);
                    return { ...current, roomdata: JSON.stringify(message.data) }; // Gem som array
                });
            } else if (message.type === "start") {
                console.log("Game started in room:", message.data.id);
                drawings.set([]);
                guesses.set([]);
                global.update((current) => {
                    return { ...current, ingame: true };
                });
            } else if (message.type === "currentWord") {
                console.log("New word received:", message.data);
            }
        };
        

        socket.onclose = () => {
            console.log("WebSocket disconnected");
            socket = null; // Nulstil socket, så vi kan genoprette forbindelsen om nødvendigt
        };

        socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }

    return socket;
}

export function sendMessage(type, data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, data }));
    } else {
        console.warn("WebSocket is not connected");
    }
}
