# LILA Tic-Tac-Toe Multiplayer Arena

This repository includes a production-ready multiplayer Tic-Tac-Toe game using a server-authoritative architecture built on the **Nakama** game server framework and **React**.

## Architecture & Design Decisions

- **Frontend (`/frontend`)**: Built in React.js powered by Vite for extremely fast build times. It uses `zustand` for lightweight state management and simple Vanilla CSS to achieve a premium "glassmorphism" aesthetic with vibrant dynamic colors.
- **Backend Server (`/backend`)**: Built using Nakama's TypeScript runtime. The `match_handler.ts` maintains absolute server authority. The game's complete 3x3 board state exists only in Nakama system memory to prevent client-side cheating or tampering.
- **Client/Server Negotiation**: We rely on `@heroiclabs/nakama-js` to handle WebSockets. State patches, such as player moves and turn validations, use a custom payload opcode syntax mapped between the React UI and the Nakama dispatcher. 

## Requirements Achieved
- **Server-Authoritative Match Handler**: Turn order, cell empty verification, and win/draw condition evaluations execute securely on the server.
- **Concurrent Matchups**: Designed fundamentally as isolated server loop instances. Thousands can run concurrently.
- **Blitz Timer Logic**: Incorporates an integrated fixed tick-rate match loop that enforces a timed `deadlineRemainingTicks`. Players who fail to take action within the 10-second blitz mode window automatically forfeit.

---

## Local Setup & Installation Instructions

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose

### 1. Run the Nakama Backend Infrastructure
1. Open a terminal to the `/backend` directory.
2. Compile the TypeScript server logic to JavaScript: 
   ```bash
   npm install && npm run build
   ```
3. Start the Nakama node and the PostgreSQL database:
   ```bash
   docker compose up -d --build
   ```

### 2. Run the React Frontend
1. Open a new terminal to the `/frontend` directory.
2. Install necessary dependencies:
   ```bash
   npm install
   ```
3. Boot up the Vite developer server:
   ```bash
   npm run dev
   ```

---

## How to Test the Multiplayer Functionality

1. Ensure both the Docker containers and the Vite dev server are running.
2. Open exactly two separate web browsers (e.g., standard Chrome and an Incognito window). 
3. Navigate to `http://localhost:3000` (or whichever port Vite assigned) on both browsers.
4. Click **Enter Arena** on both windows to authenticate dummy sessions securely.
5. In the lobby, click the **Blitz** mode on Window 1. The status will update to "Searching for opponent...".
6. Click the **Blitz** mode on Window 2. Nakama's server will instantly locate both matchmaker requests, spawn the Match Handler instance, and load your simultaneous board states!

---

## Deployment Process Documentation

To take this application live, you must deploy the Backend Game Server (Nakama) and the Frontend (React application) separately.

### Deploying the Game Server (DigitalOcean, AWS, GCP)
The most common and secure method to deploy Nakama is using an **Ubuntu VM (Droplet/EC2)** with Docker.

1. Provision a linux instance on your preferred cloud.
2. Point your DNS (e.g., `api.example.com`) to the IP address of that instance.
3. Install Docker and Docker Compose on the machine.
4. Clone this repository directly onto your cloud machine.
5. In `/backend/docker-compose.yml`, change the PostgreSQL `postgres:localdb` password string on line `50` and `51` to a secure production secret!
6. Start the server using `docker compose up -d`.
7. **Important Port Settings**: 
   Ensure your cloud firewall configuration opens inbound TCP traffic for ports:
   - `7350` (The main API & WebSocket port)
   - `7351` (The built-in Nakama dashboard/admin console)

### Deploying the Frontend (Vercel, Netlify, or AWS S3)
Because the frontend is a purely static React build, hosting it is incredibly straightforward compared to a Node server.

1. Ensure your Nakama Backend is securely live.
2. In `frontend/src/nakama.ts`, replace the local `127.0.0.1` connection string with the live IP/Domain of your server. Make sure `useSSL` is set to `true` if you configured HTTPS.
3. Push your repository to GitHub.
4. Connect the repository to **Vercel** or **Netlify**. Select Vite as the framework.
5. Set the build command to `npm run build` and output directory to `dist`.
6. Click deploy! Your app will securely boot up and users globally can matchmake via your live endpoints.
