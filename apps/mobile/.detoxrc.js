/** @type {import('detox').DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: "jest",
      config: "e2e/jest.config.js",
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    "android.debug": {
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/debug/app-debug.apk",
      testBinaryPath:
        "android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk",
      build:
        "cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug --no-daemon --stacktrace",
      reversePorts: [8081],
    },
    "ios.sim.debug": {
      type: "ios.app",
      binaryPath:
        "ios/build/Build/Products/Debug-iphonesimulator/ForumoMobile.app",
      build: "bash ./scripts/build-detox-ios.sh",
    },
  },
  devices: {
    androidEmulator: {
      type: "android.attached",
      device: {
        adbName: "emulator-.*",
      },
    },
    simulator: {
      type: "ios.simulator",
      device: {
        type: "iPhone 15",
      },
    },
  },
  configurations: {
    "android.att.debug": {
      app: "android.debug",
      device: "androidEmulator",
    },
    "ios.sim.debug": {
      app: "ios.sim.debug",
      device: "simulator",
    },
  },
};
