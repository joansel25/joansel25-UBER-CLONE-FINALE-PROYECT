# UBER_CLONE

A fully functional ride-hailing mobile application built for Android and iOS, developed as a final academic project. The app replicates the core experience of a ride-sharing platform — passengers request trips, drivers accept them, and payments are processed in real time.

**Developers:** Joan Cardenas · Carlos Soto

---

## What the app does

The app supports two user roles — **passenger** and **driver** — each with their own dedicated interface.

As a **passenger**, you open the app and see a map centered on your current location with up to 6 simulated drivers nearby. You pick your destination, the app calculates the route and estimated fare (economy, XL, or premium), and you request the trip. A driver accepts automatically, approaches your location, and completes the ride. Once the trip is done, you pay by card through Stripe and rate the driver.

As a **driver**, you toggle your availability, see incoming trip requests, accept them, pick up the passenger, and complete the ride.

Everything runs in real time — driver position updates on the passenger's map as the trip progresses, and trip status changes are reflected instantly on both ends.

---

## Tech stack

| Layer | Technology |
|---|---|
| Mobile framework | React Native 0.85.2 (React 19) |
| Language | JavaScript (JSX) |
| Authentication | Firebase Auth |
| Database | Firebase Firestore |
| Real-time location | Firebase Realtime Database |
| File storage | Firebase Storage |
| Maps & routing | Google Maps SDK · Directions API · Places API · Geocoding API |
| Payments | Stripe (`@stripe/stripe-react-native`) |
| State management | Redux Toolkit + React Redux |
| Navigation | React Navigation (Native Stack + Bottom Tabs) |
| Environment config | react-native-config |
| Icons | react-native-vector-icons (Ionicons) |
| Image picker | react-native-image-picker |
| Local storage | AsyncStorage |
| Testing | Jest + React Native Testing Library |

---

## Architecture

There is no custom backend server. All business logic runs client-side through Firebase SDKs and direct API calls:

```
React Native app
├── Firebase Auth          → user sessions, password reset
├── Firestore              → trips, users, drivers, transactions
├── Realtime Database      → live driver location during a trip
├── Firebase Storage       → profile photo uploads
├── Google Maps APIs       → map rendering, route calculation, address search
└── Stripe API             → payment intents, saved cards, payment sheet
```

---

## App screens

**Passenger flow**
- Login / Register with email and password
- Home — interactive map, animated driver carousel, route search, fare estimation
- Follow Travel — real-time trip tracking with driver movement
- Travel History — all past trips with detail view
- Payment Methods — add and manage saved cards
- Payment History — completed and pending transactions
- Profile — personal info, contact details, language preference (ES / EN)

**Driver flow**
- Driver Home — availability toggle, incoming trip requests, trip lifecycle controls
- Driver Register — vehicle info and license setup

---

## APIs and environment variables

Create a file named `.env` inside the `frontend/` folder with the following keys:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
```

### Google Cloud — APIs to enable

Go to [Google Cloud Console](https://console.cloud.google.com) and enable these APIs for your project:

- Maps SDK for Android
- Maps SDK for iOS
- Directions API
- Places API
- Geocoding API

> **API key restrictions:** Directions API, Places API, and Geocoding API are REST web services called from JavaScript — they are not platform-specific. The same key works on both Android and iOS. Only the Maps SDKs are platform-specific. If your key has an *Android apps* restriction, remove it or create a separate unrestricted key (restricted by API only) so iOS requests are also accepted.

### Firebase

The app requires one configuration file per platform, both downloaded from the Firebase console.

**Android** — already included in the repository:

```
frontend/android/app/google-services.json
```

**iOS** — you must register an iOS app in your Firebase project and download its file:

1. Open the Firebase console → your project → **Add app** → iOS icon
2. Use bundle ID: `com.company.Uberjoan`
3. Download `GoogleService-Info.plist`
4. Place it at:

```
frontend/ios/FinaleProyectUber/GoogleService-Info.plist
```

> Skip steps 3–5 of the Firebase setup wizard (SDK installation, initialization code, connection test) — those apply to native Swift apps. React Native handles all of that automatically through CocoaPods.

### Stripe

The app uses Stripe in **test mode**. Use the following test card for payments:

```
Card number : 4242 4242 4242 4242
Expiry      : any future date (e.g. 12/34)
CVC         : any 3 digits
```

---

## Installation

### Android

**Requirements**

- Node.js >= 22.11.0
- JDK 17
- Android Studio with an emulator or a physical Android device
- React Native CLI

**Steps**

```bash
# 1. Clone the repository
git clone <repository-url>
cd FinaleProyectUber/frontend

# 2. Install dependencies
npm install

# 3. Create the environment file
# Copy the block above into frontend/.env with your real keys

# 4. Verify google-services.json is present
# frontend/android/app/google-services.json
```

---

### iOS

> iOS builds require **macOS with Xcode 15 or later**. This cannot be done from Windows or Linux.

**Requirements**

- macOS with Xcode 15+
- Node.js >= 22.11.0
- CocoaPods (`sudo gem install cocoapods`)
- A physical iPhone or the iOS Simulator (no Apple Developer account needed for Simulator)
- React Native CLI

**Steps**

```bash
# 1. Clone the repository
git clone <repository-url>
cd FinaleProyectUber/frontend

# 2. Install JS dependencies
npm install

# 3. Create the environment file
# Copy the .env block above into frontend/.env with your real keys

# 4. Place GoogleService-Info.plist in the iOS folder
# frontend/ios/FinaleProyectUber/GoogleService-Info.plist
# (download from Firebase console — see Firebase section above)

# 5. Install native iOS dependencies
cd ios
pod install
cd ..
```

**Step 6 — Configure react-native-config in Xcode (one-time setup)**

This step lets the app read the `.env` file on iOS (same as it does on Android).

1. Open `frontend/ios/FinaleProyectUber.xcworkspace` in Xcode — use the `.xcworkspace` file, not `.xcodeproj`
2. In the Project Navigator (left panel), click the blue `FinaleProyectUber` project icon at the top
3. Under **TARGETS**, select `FinaleProyectUber`
4. Go to the **Build Phases** tab
5. Click **`+`** (top-left of the Build Phases area) → **New Run Script Phase**
6. Drag the new phase **above** "Compile Sources"
7. Paste this script into the text field:

```bash
"${SRCROOT}/../node_modules/react-native-config/ios/ReactNativeConfig/BuildXCConfig.rb" "${SRCROOT}/.." "${SRCROOT}/tmp.xcconfig"
```

**Step 7 — Add GoogleService-Info.plist to the Xcode target**

The file must be part of the Xcode build, not just present on disk:

1. In the Project Navigator, drag `GoogleService-Info.plist` into the `FinaleProyectUber` folder
2. When the dialog appears, make sure ✅ **Add to targets: FinaleProyectUber** is checked
3. Click **Finish**

---

## Running the app

Open two terminal windows inside the `frontend/` folder.

**Terminal 1 — Metro bundler (both platforms)**

```bash
# Option A — npm script
npm start

# Option B — npx
npx react-native start
```

### Android

**Terminal 2 — Android build**

```bash
# Option A — npm script
npm run android

# Option B — npx
npx react-native run-android
```

The app will build and install on your connected device or running emulator.

> **Emulator GPS note:** Android emulators default to a location in Mountain View, California. To test with a Colombian address, open the emulator's Extended Controls (⋮ icon) → **Location** tab and set:
> ```
> Latitude:   4.7110
> Longitude: -74.0721
> ```

### iOS

**Terminal 2 — iOS build**

```bash
# Option A — npm script
npm run ios

# Option B — npx
npx react-native run-ios
```

To target a specific simulator:

```bash
npx react-native run-ios --simulator="iPhone 15"
```

To run on a physical device, connect it via USB and pass the device name:

```bash
npx react-native run-ios --device="Your iPhone Name"
```

> **Simulator GPS note:** The iOS Simulator does not have real GPS. To test location features, open the Simulator menu → **Features** → **Location** → **Custom Location** and enter:
> ```
> Latitude:   4.7110
> Longitude: -74.0721
> ```

> **Permissions note:** The first time the app requests your location or accesses the photo library, iOS will show a system permission dialog. Tap **Allow** to enable those features.

---

## Running tests

```bash
# Option A — npm script
npm test

# Option B — npx
npx jest
```

---

## Project structure

```
frontend/
├── src/
│   ├── api/           # Firestore and service calls (trips, payments, users, places)
│   ├── components/    # Reusable UI components (map, trip, common)
│   ├── constants/     # Design tokens (colors, spacing, typography)
│   ├── context/       # AuthContext — session and user profile state
│   ├── hooks/         # useLocation, useTripTracking, useTranslation
│   ├── i18n/          # Spanish and English string tables
│   ├── navigation/    # App, Auth, Tab, Driver navigators
│   ├── screens/       # All app screens
│   ├── services/      # Google Maps and Stripe direct API wrappers
│   ├── store/         # Redux store and slices
│   └── utils/         # Formatters, polyline decoder, seed drivers, logger
├── android/           # Native Android project
├── index.js           # App entry point
└── App.js             # Root component with providers
```

---

## Key features

- **Dual role app** — single codebase, separate UX for passengers and drivers
- **Real-time trip tracking** — driver position updates every tick via Firebase Realtime DB
- **Driver simulation** — 6 animated drivers placed around the user's location; nearest is auto-selected when requesting a trip
- **Driver carousel** — horizontal auto-scrolling cards with distance, ETA, and rating; pauses when user selects a driver manually
- **Route estimation** — calculates distance, duration, and fare for three vehicle categories before confirming a trip
- **Stripe payments** — supports saved cards and new card entry via Stripe PaymentSheet; transaction status synced against Stripe on history load
- **Bilingual** — instant language switching between Spanish and English with no app restart
- **Profile photo upload** — stored in Firebase Storage via base64 encoding
- **Password recovery** — Firebase Auth email reset flow

---

## Notes

- The app is configured for **Colombia** (currency COP, address components `country:co`, Google Maps region bias `co`).
- Stripe is in test mode; no real charges are made.
- The driver simulation runs entirely client-side — no actual driver accounts are required to demo the full passenger flow.
- iOS builds require macOS. All JS logic, Firebase, Stripe, and Redux code is shared between platforms — only the native build tooling differs.
- After running `pod install`, always open the project using `FinaleProyectUber.xcworkspace`, not `FinaleProyectUber.xcodeproj`. The workspace includes the installed CocoaPods.
