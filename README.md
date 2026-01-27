# PermissionGraph

PermissionGraph is a role and permission management system designed for admin-controlled environments. It provides secure authentication, role-based access control, user lifecycle management, and a complete audit trail with undo capabilities.

## Features

### Authentication
- JWT-based login
- Persistent sessions
- Secure sign-out
- Public viewer signup

### User Management
- Admin-only user creation
- Role assignment (admin / editor / viewer)
- Role change confirmation and undo
- Admin-only user deletion

### Audit Log
- Logs all sensitive actions
- Shows actor, action, and timestamp
- Visual status indicators
- Real-time refresh

### Access Control
- Admin UI hidden from viewers
- Backend-enforced authorization
- Viewer accounts are read-only

## Tech Stack
- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: JWT
