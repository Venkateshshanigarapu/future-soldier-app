# Project Overview – Future Soldiers Mobile Application



## 📋 Client Overview

**Client:** *Future Soldiers* – a security‑focused organization that coordinates field personnel, monitors zones, and handles emergency alerts for tactical operations.

**Their needs:**
- Real‑time location tracking of personnel on the ground.
- Immediate push notifications for zone breaches, emergencies, and assignment updates.
- A reliable way for users to view and manage alerts, preferences, and assignments while offline.
- Secure authentication and role‑based access to sensitive data.

**Purpose of the project:**
To deliver a premium, cross‑platform mobile application (Android & iOS) that empowers field agents with live situational awareness, fast communication, and a seamless interface to the backend command system.


## 🚀 Project Overview

The **Future Soldiers** app is a React‑Native (Expo) mobile client that talks to a Node/Express backend API and a PostgreSQL database.  It provides:
- **Live location updates** via Expo’s background location services.
- **Push notifications** (FCM via Firebase Admin) for zone‑breach alerts, emergencies, and assignment notifications.
- **In‑app notification center** where users can view, mark‑read, and clear alerts.
- **Assignment management** – users receive new tasks and can acknowledge them.
- **Realtime communication** using Socket.io for instant updates without polling.
- **User preferences** for notification settings stored on the server.

The app works by:
1. Authenticating the user and storing a JWT‑like token locally.
2. Registering the device’s Expo push token with the backend.
3. Continuously sending location data (when permitted) to the API.
4. Receiving server‑side events via Socket.io and push notifications.
5. Displaying alerts in the UI and allowing the user to interact with them.



## 🛠️ Technical Overview (Developers)

### Tech Stack
| Layer | Technology | Version |
|---|---|---|
| **Mobile UI** | React 19, React‑Native ^0.79.5, Expo SDK ^53.0.20 | |
| **State / Storage** | @react-native-async-storage/async-storage | 2.1.2 |
| **Networking** | @react-native-community/netinfo, socket.io-client | ^11.4.1 / ^4.8.1 |
| **Location / Sensors** | expo-location, expo-task-manager | ~18.1.6 / ~13.1.6 |
| **Push / Notifications** | expo-notifications, firebase (client) | ~0.31.4 / ^11.10.0 |
| **Maps** | react-native-maps, react-native-google-places-autocomplete | ^1.20.1 / ^2.5.7 |
| **UI Kit** | react-native-paper, react-native-vector-icons | ^5.14.1 / ^10.2.0 |
| **Backend** | Node v16+, Express ^5.1.0, socket.io | |
| **Database** | PostgreSQL + pg driver | ^8.16.3 |
| **Auth / Misc** | bcrypt, uuid, i18n-js | ^6.0.0 / ^11.1.0 / ^4.5.1 |

### Architecture Diagram

[Mobile App (Expo)] <--REST/HTTPS--> [Express API (my‑api)]
        │                                 │
        │   ↔︎  socket.io (WebSocket) ↔︎   │
        │                                 │
        └─► expo-notifications (client) ──► Firebase Admin (FCM) ──► Device

*The diagram is also visualised in `docs/architecture.png`.*

### Core Modules (Frontend)
- **`services/api.js`** – thin wrapper around `fetch` for all REST calls.
- **`services/notificationService.js`** – central class handling notification preferences, sending test notifications, local scheduling, permission checks, and FCM token updates.
- **`services/socketService.js`** – establishes a Socket.io client, listens for `locationUpdate`, `alert`, etc.
- **`tasks/locationTask.js`** (if present) – background task that periodically posts GPS coordinates.
- **`screens/*`** – UI screens (Login, Home, Notifications, Settings, Map, Assignment).

### Core Modules (Backend)
- **`index.js`** – server bootstrap, middleware (CORS, body‑parser, auth), and socket.io integration.
- **`routes/notifications.js`**, **`routes/alerts.js`**, **`routes/users.js`** – REST endpoints for CRUD operations.
- **`controllers/*`** – business logic for each route.
- **`services/fcmService.js`** – uses `firebase-admin` to send push messages to Expo tokens.
- **`db/`** – SQL schema, migration scripts, and helper functions.

### Data Flow
1. **Authentication** – `POST /auth/login` returns a JWT stored in AsyncStorage.
2. **FCM registration** – client calls `notificationService.updateFCMToken()` → `POST /users/update-token`.
3. **Location** – background task posts to `POST /location` → server stores in DB and may trigger zone‑breach logic.
4. **Alert generation** – server creates an alert, stores it, then:
   - Emits a Socket.io event to connected devices.
   - Sends an FCM push via `firebase-admin`.
5. **Client receipt** – `notificationService.showLocalNotification()` displays a banner; UI updates via Redux/Context.

mermaid
flowchart TD
    A[App.js (Entry)] --> B[services/api.js]
    A --> C[services/notificationService.js]
    A --> D[services/socketService.js]
    A --> E[tasks/locationTask.js]
    B --> F[Express API (my-api/index.js)]
    C --> G[Firebase Admin (FCM)]
    D --> H[Socket.io Server]
    E --> I[POST /location]
    F --> J[PostgreSQL DB]
    G --> K[FCM Service]
    H --> L[Socket.io Clients]
    J --> M[Alerts / Zones Logic]
    M --> N[Emit Socket.io Event]
    M --> O[Send FCM Push]
    N --> D
    O --> C
    C --> P[showLocalNotification]
    P --> UI[React Native UI]




## 🌐 Simple Explanation (Non‑Technical Users)

*Future Soldiers* needed a way for their field teams to stay connected, know where everyone is, and get instant warnings when something important happens (e.g., a restricted area is entered, an emergency occurs, or a new task is assigned).  The solution is a **mobile app** that:
- **Shows your current location** on a map and shares it securely with the command center.
- **Sends you push alerts** (like a text message) the moment a critical event happens.
- **Lets you see all alerts in one place**, mark them as read, and clear old ones.
- **Keeps your notification preferences** (you can turn off push alerts, email alerts, etc.)
- **Works even when the app is in the background**, so you never miss a warning.

The app talks to a server that stores all the data, decides when an alert should be created, and pushes it to the right people.  All communication is encrypted and follows modern security best practices.


5. **Client receipt** – `notificationService.showLocalNotification()` displays a banner; UI updates via Redux/Context.

mermaid
flowchart TD
    A[App.js (Entry)] --> B[services/api.js]
    A --> C[services/notificationService.js]
    A --> D[services/socketService.js]
    A --> E[tasks/locationTask.js]
    B --> F[Express API (my-api/index.js)]
    C --> G[Firebase Admin (FCM)]
    D --> H[Socket.io Server]
    E --> I[POST /location]
    F --> J[PostgreSQL DB]
    G --> K[FCM Service]
    H --> L[Socket.io Clients]
    J --> M[Alerts / Zones Logic]
    M --> N[Emit Socket.io Event]
    M --> O[Send FCM Push]
    N --> D
    O --> C
    C --> P[showLocalNotification]
    P --> UI[React Native UI]