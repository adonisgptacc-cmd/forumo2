const detoxConfig = require("../.detoxrc");

describe("Android Detox configuration", () => {
  it("builds both APKs and targets the emulator started by CI", () => {
    expect(detoxConfig.apps["android.debug"]).toMatchObject({
      type: "android.apk",
      binaryPath: "android/app/build/outputs/apk/debug/app-debug.apk",
      testBinaryPath:
        "android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk",
      reversePorts: [8081],
    });
    expect(detoxConfig.apps["android.debug"].build).toContain(
      "assembleDebug assembleAndroidTest",
    );
    expect(detoxConfig.devices.androidEmulator).toEqual({
      type: "android.attached",
      device: { adbName: "emulator-.*" },
    });
    expect(detoxConfig.configurations["android.att.debug"]).toEqual({
      app: "android.debug",
      device: "androidEmulator",
    });
  });
});
