import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Room state storage
  const rooms = new Map<string, {
    hostId: string;
    players: Map<string, any>;
    gameState: any;
  }>();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("create-room", () => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      rooms.set(roomId, {
        hostId: socket.id,
        players: new Map(),
        gameState: null
      });
      socket.join(roomId);
      socket.emit("room-created", roomId);
      console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    socket.on("join-room", (roomId: string) => {
      if (rooms.has(roomId)) {
        socket.join(roomId);
        socket.emit("room-joined", roomId);
        socket.to(roomId).emit("player-joined", socket.id);
        console.log(`User ${socket.id} joined room: ${roomId}`);
      } else {
        socket.emit("error", "Room not found");
      }
    });

    socket.on("update-player", ({ roomId, playerData }) => {
      const room = rooms.get(roomId);
      if (room) {
        room.players.set(socket.id, playerData);
        socket.to(roomId).emit("player-updated", { playerId: socket.id, playerData });
      }
    });

    socket.on("sync-game-state", ({ roomId, gameState }) => {
      const room = rooms.get(roomId);
      if (room && room.hostId === socket.id) {
        room.gameState = gameState;
        socket.to(roomId).emit("game-state-synced", gameState);
      }
    });

    socket.on("player-action", ({ roomId, action }) => {
      // Broadcast actions like shooting or placing traps
      socket.to(roomId).emit("remote-action", { playerId: socket.id, action });
    });

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (rooms.has(roomId)) {
          const room = rooms.get(roomId)!;
          room.players.delete(socket.id);
          socket.to(roomId).emit("player-left", socket.id);
          
          if (room.hostId === socket.id) {
            // If host leaves, pick a new host or close room
            const nextPlayer = Array.from(room.players.keys())[0];
            if (nextPlayer) {
              room.hostId = nextPlayer;
              io.to(nextPlayer).emit("became-host");
            } else {
              rooms.delete(roomId);
            }
          }
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
