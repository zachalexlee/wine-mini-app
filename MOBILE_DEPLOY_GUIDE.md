# 📱 Mobile-First Deployment Guide: Wine Aging Assistant

Absolutely! You can get the entire Wine Aging Assistant app running from your mobile phone without needing a computer. This guide will walk you through every step, from creating the bot to deploying the code and making it live.

We will use free services that work well in a mobile browser:

-   **Telegram** for the bot itself.
-   **GitHub** to store the code (already done!).
-   **Vercel** to host our frontend (the Mini App interface).
-   **Railway** to host our backend (the server logic).

Let's get started!

---

### **Step 1: Create Your Telegram Bot**

First, you need to create a "bot user" in Telegram. This is done by talking to a special bot called `@BotFather`.

1.  **Open Telegram** on your phone.
2.  Search for `@BotFather` (make sure it has a blue checkmark) and start a chat with it.
3.  Send the command `/newbot`.
4.  **BotFather will ask for a name.** This is the display name, like `Wine Aging Assistant`.
5.  **Next, it will ask for a username.** This must be unique and end in `bot`. For example: `MyWinePalBot`.
6.  **Success!** BotFather will send you a message with your **bot token**. It looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`. **Copy this token immediately and save it somewhere safe**, like your phone's notes app. You will need it soon.

![BotFather Token](https://i.imgur.com/sVv2n8H.png)

---

### **Step 2: Deploy the Frontend with Vercel**

Next, we'll publish the app's user interface to the web using Vercel.

1.  **Open your mobile browser** (like Chrome or Safari) and go to [vercel.com](https://vercel.com).
2.  Tap **Sign Up** and choose **Continue with GitHub**. Authorize Vercel to access your GitHub account.
3.  Once in your Vercel dashboard, tap **Add New...** and select **Project**.
4.  Under **Import Git Repository**, find and select your `wine-mini-app` repository.
5.  Vercel will detect it's a monorepo. It will ask for the **Root Directory**. Tap the **Edit** button next to `frontend` and then tap **Continue**.
6.  Vercel knows this is a Next.js app, so you don't need to change any build settings.
7.  Before deploying, expand the **Environment Variables** section.
    -   **Name:** `NEXT_PUBLIC_API_BASE`
    -   **Value:** Leave this blank for now. We'll get the URL from our backend in the next step.
    -   Tap **Add**.
8.  Tap **Deploy**. Vercel will start building your project. This might take a minute or two.
9.  When it's done, you'll see a "Congratulations!" message with a preview of your app. Tap **Continue to Dashboard**.
10. On the project dashboard, you will see the public URL under **Domains** (e.g., `wine-mini-app-alpha.vercel.app`). **Copy this URL and save it.** This is your `WEBAPP_URL`.

---

### **Step 3: Deploy the Backend with Railway**

Now for the server. We'll use Railway, which is great for hosting Node.js apps.

1.  In your mobile browser, go to [railway.app](https://railway.app).
2.  Tap **Login** and choose **Login with GitHub**. Authorize Railway.
3.  In your dashboard, tap **New Project**.
4.  Select **Deploy from GitHub repo**.
5.  Find and select your `wine-mini-app` repository.
6.  Railway will ask if this is a monorepo. Tap **This is a Monorepo**.
7.  For the **Root Directory**, enter `backend` and tap **Save**.
8.  Railway will analyze the code and start deploying. While it's working, go to the **Variables** tab.
9.  Add two variables:
    -   **Variable 1:**
        -   **Name:** `BOT_TOKEN`
        -   **Value:** Paste the token you got from BotFather in Step 1.
    -   **Variable 2:**
        -   **Name:** `WEBAPP_URL`
        -   **Value:** Paste the Vercel frontend URL you got in Step 2.
10. After adding the variables, Railway will automatically redeploy. Once it's finished, go to the **Settings** tab.
11. Under the **Networking** section, you'll find a **Public URL** (e.g., `wine-mini-app-backend-production.up.railway.app`). **Copy this URL and save it.** This is your backend API URL.

---

### **Step 4: Connect All the Pieces**

We're almost there! We just need to tell our services about each other.

1.  **Update Vercel:**
    -   Go back to your Vercel dashboard in your browser.
    -   Navigate to your `wine-mini-app` project settings.
    -   Go to the **Environment Variables** section.
    -   Find `NEXT_PUBLIC_API_BASE` and tap the menu (three dots) to **Edit** it.
    -   For the **Value**, paste your **Railway backend URL** from Step 3.
    -   Save it. Vercel will automatically start a new deployment with the updated variable.

2.  **Set the Telegram Webhook:**
    -   This tells Telegram where to send messages (like `/start`) from your users.
    -   You need to visit a special URL in your browser. Construct it like this:
        `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<BACKEND_URL>/telegram/webhook`
    -   **Replace `<TOKEN>`** with your Bot Token.
    -   **Replace `<BACKEND_URL>`** with your Railway backend URL (make sure it starts with `https://`).
    -   **Example:** `https://api.telegram.org/bot123456:ABC-DEF/setWebhook?url=https://wine-mini-app-backend-production.up.railway.app/telegram/webhook`
    -   **Paste this complete URL into your mobile browser's address bar and press Go.**
    -   Your browser will show a simple message: `{"ok":true,"result":true,"description":"Webhook was set"}`. This means it worked!

---

### **Step 5: Set the Mini App Menu Button**

This final step adds the button inside your Telegram chat that opens the app.

1.  Go back to your chat with `@BotFather` in Telegram.
2.  Send the command `/mybots`.
3.  Tap on the bot you created.
4.  Tap **Bot Settings** -> **Menu Button**.
5.  Tap **Configure menu button**.
6.  BotFather will ask for the URL. **Paste your Vercel frontend URL** (the `WEBAPP_URL` from Step 2).
7.  It will then ask for the button text. You can just send `Open Assistant`.
8.  Success! The menu button is now configured.

---

### **Step 6: You're Live!**

That's it! Everything is deployed and connected.

-   Go to your bot's chat in Telegram.
-   Send the `/start` command.
-   You should see the welcome message and a menu button at the bottom that says "Open Assistant".
-   Tap the button, and your Mini App will launch right inside Telegram!

Enjoy your Wine Aging Assistant! 🍷
