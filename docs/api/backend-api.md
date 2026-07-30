# Backend REST API Documentation

## Endpoints

### 1. Member
- `POST /member/join` - Register new user
- `POST /member/login` - User authentication

### 2. Project
- `GET /project/list` - List projects
- `GET /project/{id}` - Project detail

### 3. Logo Generation
- `POST /logo/generate` - Request AI logo generation
- `GET /logo/result/{id}` - View logo generation result

### 4. Similarity Inspection
- `POST /similarity/check` - Run similarity search against trademark database
