# 🍷 Wine Aging Assistant — Telegram Mini App

This repository contains the full source code for the Wine Aging Assistant, a Telegram Mini App built with a Next.js frontend and a Node.js/Express backend.

- **Frontend**: A responsive web app built with Next.js and TypeScript, designed to run inside Telegram. It communicates with the Telegram client via the WebApp JS SDK.
- **Backend**: A Node.js server using Express that handles Telegram bot webhooks, serves a mock API for wine data, and manages bot commands.

## Project Structure

```
.
├── backend
│   ├── .env.example
│   ├── .gitignore
│   ├── index.js
│   └── package.json
├── frontend
│   ├── .env.example
│   ├── .gitignore
│   ├── app
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── next.config.js
│   ├── package.json
│   ├── public/
│   └── tsconfig.json
└── README.md
```

## Key Files

### Backend (`/backend`)

- **`index.js`**: The main Express server file. It sets up the Telegram bot, defines the `/telegram/webhook` endpoint for receiving updates from Telegram, handles the `/start` command, and exposes the mock `/api/scan` endpoint.
- **`package.json`**: Defines backend dependencies like `express`, `node-telegram-bot-api`, and `cors`.
- **`.env.example`**: Template for environment variables. You will need to create a `.env` file and add your Telegram `BOT_TOKEN` and the public `WEBAPP_URL` of your frontend.

### Frontend (`/frontend`)

- **`app/page.tsx`**: The main (and only) page of the Next.js application. It implements the home screen with three buttons ("Scan bottle", "Type wine", "My cellar") and renders dummy content for each view. It also includes the logic to call the backend's `/api/scan` endpoint and display the mock result.
- **`app/layout.tsx`**: The root layout for the Next.js app. It crucially includes the Telegram WebApp JavaScript SDK (`telegram-web-app.js`), which is necessary for the app to function as a Mini App inside Telegram.
- **`package.json`**: Defines frontend dependencies like `next`, `react`, and `react-dom`.
- **`.env.example`**: Template for the frontend environment variable `NEXT_PUBLIC_API_BASE`, which should point to your backend server URL.

## Getting Started

### 1. Set up the Backend

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create your environment file:**
    Copy `.env.example` to a new file named `.env`.
    ```bash
    cp .env.example .env
    ```

4.  **Configure your bot:**
    - Get a bot token from [@BotFather](https://t.me/BotFather) on Telegram.
    - Paste the token into your `.env` file for the `BOT_TOKEN` variable.

5.  **Start the server:**
    ```bash
    npm start
    ```
    The backend will be running on `http://localhost:3001`.

### 2. Set up the Frontend

1.  **Navigate to the frontend directory:**
    ```bash
    cd ../frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create your environment file:**
    Copy `.env.example` to `.env.local` and ensure `NEXT_PUBLIC_API_BASE` points to your backend (e.g., `http://localhost:3001`).

4.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The frontend will be running on `http://localhost:3000`.

### 3. Connect Telegram to Your Local Services

To test the full flow, you need to expose your local backend and frontend servers to the internet.

1.  **Expose your backend:** Use a tool like [ngrok](https://ngrok.com/) to create a public URL for your backend.
    ```bash
    ngrok http 3001
    ```

2.  **Set the webhook:** Take the public HTTPS URL from ngrok and set it as your bot's webhook via a `POST` request (e.g., using `curl` or Postman). Replace `YOUR_BOT_TOKEN` and `YOUR_NGROK_URL`.
    ```bash
    curl -F "url=https://YOUR_NGROK_URL/telegram/webhook" https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook
    ```

3.  **Expose your frontend:** In a new terminal, expose your frontend.
    ```bash
    ngrok http 3000
    ```

4.  **Update Mini App URL:**
    - Go back to [@BotFather](https://t.me/BotFather), select your bot, and go to `Bot Settings` -> `Menu Button`.
    - Set the Menu Button URL to your public frontend ngrok URL.
    - Also, update the `WEBAPP_URL` in your backend's `.env` file to this new URL and restart the backend server.

Now, when you send `/start` to your bot in Telegram, it will show a button that opens your local Next.js app directly inside the chat.
