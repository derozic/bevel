# Store screenshot matrix

Required marketing screenshots for App Store / Play when shipping BEVEL 0.3.x.
Capture on simulators / devices; store under `dist/native/screenshots/<platform>/`
(gitignored). CI does not require them to build.

## iOS (App Store Connect)

| Device class | Simulator / device | Portrait | Landscape |
|--------------|-------------------|----------|-----------|
| iPhone 6.9" (Pro Max class) | iPhone 16 Pro Max / 17 Pro Max when available | 3–5 | optional |
| iPhone 6.7" | iPhone 15 Pro Max | 3–5 | optional |
| iPad Pro 13" | iPad Pro 13-inch (M4) | 2–3 | **2 dual-pane** |
| iPad Pro 11" | iPad Pro 11-inch (M4) | 2–3 | **2 dual-pane** |

**Shots to capture**

1. Home / Google Workspace onboarding step 1  
2. Continue with Google (system browser callout)  
3. Workspace `~general` channel  
4. Timeline with escalation  
5. Dual-pane (iPad landscape): rail + channel  
6. Notification settings  

## Android (Play Console)

| Device class | Emulator / device | Notes |
|--------------|-------------------|--------|
| Phone (xxhdpi) | Pixel 8 / 9 | 1080×2400+ |
| Large phone | Pixel 8 Pro | |
| Tablet | Pixel Tablet | dual-pane landscape |
| Fold cover | Pixel Fold / Fold API 34 outer | compact layout |
| Fold inner | unfolded | dual-pane when landscape |

**Shots**

1. Onboarding Google Workspace  
2. Cover screen compact home  
3. Inner full workspace  
4. Escalation notification shade (if possible)  
5. Notification settings  

## macOS (optional marketing)

- Silicon window with workspace + Hermes card  
- Native integrations hub  

## Naming convention

```
dist/native/screenshots/
  ios/
    iphone-promax-01-onboarding.png
    ipad-pro-13-landscape-dual-pane.png
  android/
    pixel-tablet-dual-pane.png
    fold-cover-home.png
    fold-inner-workspace.png
```

## Capture helper

```bash
# iOS simulator (example)
xcrun simctl io booted screenshot dist/native/screenshots/ios/shot.png

# Android emulator
adb exec-out screencap -p > dist/native/screenshots/android/shot.png
```

See also [NATIVE_RELEASE.md](./NATIVE_RELEASE.md) and [NATIVE_PUSH.md](./NATIVE_PUSH.md).
