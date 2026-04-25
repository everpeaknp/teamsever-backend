# Teamsever WebSocket Documentation (Live Config)

This document provides technical details for connecting to and interacting with the Teamsever WebSocket server, based on the current environment configuration.

## 1. Connection Details

- **Protocol**: Socket.IO (v4+)
- **Base URL**: `http://localhost:5000` (Based on current `PORT=5000`)
- **Websocket URL**: `ws://localhost:5000`
- **Socket.io Path**: `/socket.io/`
- **Transports**: `['websocket', 'polling']`

## 2. Authentication Credentials

The WebSocket server requires a JWT token for every connection.

- **Auth Method**: Handshake `auth` object
- **Auth Key**: `token`
- **JWT Secret (Internal)**: `jwt@345`

### Live Test Token (User: R.a.mon)
You can use this token for immediate testing in Postman or your frontend:
```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YmJmNzhjYTk2ZmU3OGY3MTY3NTI4ZiIsImVtYWlsIjoicmFtb250aXdhcmkwODZAZ21haWwuY29tIiwibmFtZSI6IlIuYS5tb24iLCJpYXQiOjE3NzcyMDEwMjksImV4cCI6MTc3NzgwNTgyOX0.Qqp3gkuJWWKqD9q0v9V6e_N57_UElAkImIHOOUvBhkQ
```

### How to get your own Access Token
1. Login via `POST /api/auth/login`
2. Extract the `accessToken` from the response.
3. Pass it to the socket connection.

### Example Connection (React/Next.js)
```javascript
import { io } from "socket.io-client";

// Get token from your auth state / localStorage
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5YmJmNzhjYTk2ZmU3OGY3MTY3NTI4ZiIsImVtYWlsIjoicmFtb250aXdhcmkwODZAZ21haWwuY29tIiwibmFtZSI6IlIuYS5tb24iLCJpYXQiOjE3NzcyMDEwMjksImV4cCI6MTc3NzgwNTgyOX0.Qqp3gkuJWWKqD9q0v9V6e_N57_UElAkImIHOOUvBhkQ";

const socket = io("http://localhost:5000", {
  auth: {
    token: token
  },
  transports: ["websocket"]
});
```

### Example Connection (Flutter/Dart)
Flutter developers should use the `socket_io_client` package.

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;

void connectToServer() {
  IO.Socket socket = IO.io('http://localhost:5000', 
    IO.OptionBuilder()
      .setTransports(['websocket']) // for Flutter or Dart VM
      .setAuth({'token': 'YOUR_JWT_ACCESS_TOKEN'})
      .build()
  );

  socket.connect();
  
  socket.onConnect((_) {
     print('connected');
     socket.emit('join_workspace', {'workspaceId': 'YOUR_WORKSPACE_ID'});
  });

  socket.on('chat:new', (data) => print(data));
  socket.onDisconnect((_) => print('disconnected'));
}
```

## 3. Allowed Handshake Origins (CORS)

The current backend is configured to allow these origins:
- `http://localhost:3000` (Defined in `FRONTEND_URL`)
- `https://teamsever.vercel.app`
- `https://teamsever-frontend.vercel.app`
- `https://teamsever-frontend-d22u.vercel.app`

## 4. Operational Rooms

Once connected, you must join specific rooms to receive filtered updates:

- **User Direct**: `user:{userId}` (Joined automatically)
- **Workspace Updates**: `workspace:{workspaceId}`
- **Sub-entities**: `space:{spaceId}` or `task:{taskId}`
- **Chat Channels**: `channel:{channelId}`

## 5. Active Event List

### Client → Server (Sending)
| Event | Expected Payload |
| :--- | :--- |
| `join_workspace` | `{ workspaceId: "UUID" }` |
| `join_channel` | `{ channelId: "UUID" }` |
| `join_task` | `{ taskId: "UUID" }` |
| `chat:send` | `{ workspaceId, channelId, content, mentions: [] }` |
| `chat:typing` | `{ channelId: "UUID" }` |

### Server → Client (Listening)
| Event | Data Description |
| :--- | :--- |
| `user:online` | User presence notification |
| `presence:update` | Batch online status for workspace members |
| `chat:new` | New incoming message in current channel |
| `chat:user_typing`| Notification that another user is typing |
| `notification:new`| Real-time system/activity notifications |
| `workspace:event` | Structure updates (member added, role changed) |
| `task:event` | Task updates (status, assigned, etc.) |

## 6. Health & Troubleshooting
- **Check Server Status**: Run `curl http://localhost:5000/health`
- **Ping Timeout**: 60 seconds
- **Ping Interval**: 25 seconds
