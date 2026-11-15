# StudentExchange Android

A native Android application for the StudentExchange student marketplace, built using Java and XML.

The application allows students to browse marketplace listings, search for products, manage accounts, create listings, and communicate with other users.

StudentExchange Android connects to the same ASP.NET Core backend used by the StudentExchange website through a separately deployed Node.js API adapter.

## Technology Stack

| Component | Technology |
|---|---|
| Mobile Application | Java, XML, Android SDK |
| Development Environment | Android Studio |
| Networking | Retrofit, OkHttp, Gson |
| API Adapter | Node.js |
| Backend | ASP.NET Core |
| Database | SQLite |
| Backend Hosting | Microsoft Azure |
| Adapter Hosting | Render |
| Version Control | Git and GitHub |

## System Architecture

The Android application communicates with the existing StudentExchange backend through a secure, separately deployed API adapter.

```text
Android Application
        |
        | HTTPS
        v
Node.js API Adapter
(Render)
        |
        | HTTPS
        v
ASP.NET Core Backend
(Microsoft Azure)
        |
        v
SQLite Database
```

The adapter forwards supported requests to the existing backend while keeping sensitive application credentials outside the Android application.

Both the Android application and the StudentExchange website access the same backend and marketplace data.

## Deployment

The StudentExchange Android API adapter is deployed on Render.

**Public Adapter URL:**

https://studentexchangemobile.onrender.com/

**Health Check:**

https://studentexchangemobile.onrender.com/healthz

**Marketplace API:**

https://studentexchangemobile.onrender.com/api/listings

### Deployment Status

The adapter has been successfully deployed and configured to communicate with the existing StudentExchange backend.

Verified results:

- Render deployment completed successfully.
- HTTPS communication is operational.
- Health endpoint returned HTTP 200.
- Backend communication is enabled.
- Marketplace API returned HTTP 200.
- Live marketplace listings were retrieved successfully.
- Android emulator successfully displayed listings from the live backend.

The adapter is deployed from the `robert-android-app` branch.

## Application Features

### Authentication

- Student registration interface
- Student login interface
- School selection
- Session management

### Marketplace

- Browse marketplace listings
- Search products
- Filter by category
- Filter by price
- Filter by condition
- View product details
- View product image galleries
- Save listings

### Seller Features

- Create listing interface
- Upload product images
- Manage personal listings
- Edit listing information

### Messaging and Offers

- Conversation inbox
- Messaging interface
- Offer functionality

Offers do not represent completed payments or accepted purchases.

**Note:** These interfaces and features are implemented in the Android application. Some still require successful end-to-end testing against the live backend.

## Current Integration Status

### Confirmed Working

- Android application builds and launches.
- Android emulator runs the connected application.
- Render API adapter is deployed.
- HTTPS communication works.
- Adapter connects to the existing ASP.NET Core backend.
- Live marketplace listings are retrieved.
- Marketplace listings appear in the Android application.
- Android requests use the deployed adapter instead of the local mock server when running the connected build variant.

### Currently Being Investigated

- School selection occasionally returns an "Adapter is busy" response.
- Student registration requires additional live testing.
- Login and authenticated sessions require verification.
- Listing creation and management require live testing.
- Messaging and offers require live testing.

## Android Development Setup

### Requirements

- Android Studio
- Android SDK 34
- Java 17
- Android 8.0 (API 26) or newer
- Android emulator or compatible physical device

### Build Variants

The project supports two primary development configurations.

| Build Variant | Purpose | API Connection |
|---|---|---|
| `debug` | Local development | Local mock adapter |
| `connected` | Live integration testing | Deployed Render adapter |

### Local Mock Development

The `debug` build variant communicates with the local development adapter.

The mock environment uses isolated sample data and does not require production backend access.

Mock accounts:

```text
demo@mock.invalid
seller@mock.invalid
```

Mock password:

```text
CampusDemo123!
```

These accounts are development fixtures and are not valid production accounts.

### Connected Development

The `connected` build variant communicates with the deployed StudentExchange adapter.

The public adapter URL is:

```text
https://studentexchangemobile.onrender.com/
```

The Gradle configuration reads the `SE_ADAPTER_URL` environment variable.

For the current local development configuration, the deployed Render URL is also configured as the default when that environment variable is not provided.

To run the connected application:

1. Open the project in Android Studio.
2. Sync the project with Gradle.
3. Open **View → Tool Windows → Build Variants**.
4. Select `connected` for the `app` module.
5. Start an Android emulator.
6. Run the application.

The application should communicate with the deployed adapter instead of the local mock server.

## Building the Application

Run the following command to build and test the debug application:

```bash
./gradlew --offline --no-configuration-cache assembleDebug test lintDebug
```

The generated debug APK is located at:

```text
app/build/outputs/apk/debug/app-debug.apk
```

Connected and release builds require a valid public HTTPS adapter URL.

## API Integration

The Android application uses Retrofit and OkHttp to communicate with the Node.js adapter.

The adapter provides supported API routes for marketplace operations, authentication, profiles, and messaging.

Examples include:

| Endpoint | Purpose |
|---|---|
| `GET /healthz` | Adapter health check |
| `GET /api/listings` | Retrieve marketplace listings |
| `GET /api/listings/{id}` | Retrieve listing details |
| `GET /api/categories` | Retrieve listing categories |
| `GET /api/conditions` | Retrieve listing conditions |
| `GET /api/schools` | Retrieve available schools |
| `POST /api/register` | Register a student |
| `POST /api/login` | Authenticate a student |
| `GET /api/profile` | Retrieve user profile |

Additional supported operations include listing management and messaging.

Some endpoints require authenticated sessions.

## Security

StudentExchange Android uses a server-side adapter to prevent sensitive backend credentials from being exposed to mobile clients.

Security measures include:

- HTTPS communication between Android and the adapter.
- HTTPS communication between the adapter and backend.
- Backend application credentials stored in Render environment variables.
- No backend application secrets embedded in the Android APK.
- Opaque session cookies maintained in application process memory.
- API requests restricted to the configured adapter origin.
- Request validation and rate limiting.
- Restricted forwarding of sensitive administrative credentials.
- No production database files stored inside the Android application.

The adapter handles backend authentication requirements without exposing application-level secrets to Android clients.

## Project Structure

```text
StudentExchangeMobile/
|
|-- app/
|   |-- src/
|   |   |-- main/
|   |       |-- java/
|   |       |-- res/
|   |       |-- AndroidManifest.xml
|   |
|   |-- build.gradle
|
|-- development-adapter/
|   |-- server/
|   |-- test/
|   |-- Dockerfile
|   |-- package.json
|
|-- README.md
|-- LOCAL_ANDROID_TESTING.md
|-- BACKEND_INTEGRATION_STATUS.md
|-- ADAPTER_DEPLOYMENT.md
```

The Android application is located in `app/`.

The Node.js API adapter is located in `development-adapter/`.

## Additional Documentation

The repository contains additional technical documentation:

- `LOCAL_ANDROID_TESTING.md` — Local development and testing instructions.
- `BACKEND_INTEGRATION_STATUS.md` — Backend compatibility and integration status.
- `ADAPTER_DEPLOYMENT.md` — Adapter deployment configuration and requirements.

## Current Project Status

**Development Phase: Live Backend Integration and Testing**

The Android application has successfully retrieved marketplace data from the existing StudentExchange backend through its deployed Render adapter.

Current development priorities include:

1. Resolving school selection errors.
2. Completing student registration testing.
3. Verifying login and session management.
4. Testing listing creation and management.
5. Testing messaging and offers.
6. Completing Android integration testing.

## Repository Information

**Development Branch:**

```text
robert-android-app
```

Development is maintained in the StudentExchange Android workspace repository.

The Android application and its Node.js adapter are developed separately from the existing StudentExchange website and ASP.NET Core backend.

Changes to this repository do not directly modify the original website or backend repositories.
