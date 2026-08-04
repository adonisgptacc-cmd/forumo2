const {
  createDetoxTestSource,
  detoxVersion,
  networkSecurityConfig,
  patchAppBuildGradle,
  patchProjectBuildGradle,
} = require("../plugins/withDetoxAndroid");

describe("withDetoxAndroid config plugin", () => {
  it("adds the Detox Maven repository once", () => {
    const buildGradle = `buildscript {
    repositories {
        google()
        mavenCentral()
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}`;

    const patchedOnce = patchProjectBuildGradle(buildGradle);
    const patchedTwice = patchProjectBuildGradle(patchedOnce);

    expect(patchedOnce).toContain(
      'maven { url("$rootDir/../node_modules/detox/Detox-android") }',
    );
    expect(patchedOnce.indexOf("Detox-android")).toBeGreaterThan(
      patchedOnce.indexOf("allprojects"),
    );
    expect(patchedTwice).toBe(patchedOnce);
  });

  it("adds the Android test runner and Detox dependency once", () => {
    const buildGradle = `android {
    defaultConfig {
        applicationId 'app.forumo.mobile'
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
}`;

    const patchedOnce = patchAppBuildGradle(buildGradle);
    const patchedTwice = patchAppBuildGradle(patchedOnce);

    expect(patchedOnce).toContain(
      "testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'",
    );
    expect(patchedOnce).toContain(
      "testBuildType System.getProperty('testBuildType', 'debug')",
    );
    expect(patchedOnce).toContain(
      `androidTestImplementation('com.wix:detox:${detoxVersion}')`,
    );
    expect(patchedOnce).not.toContain("com.wix:detox:+");
    expect(patchedTwice).toBe(patchedOnce);
  });

  it("generates a Detox test in the Android application package", () => {
    const source = createDetoxTestSource("app.forumo.mobile");

    expect(source).toContain("package app.forumo.mobile;");
    expect(source).toContain("Detox.runTests(mActivityRule, detoxConfig);");
  });

  it("allows cleartext traffic only to the local Metro endpoints", () => {
    expect(networkSecurityConfig).toContain(">localhost</domain>");
    expect(networkSecurityConfig).toContain(">10.0.2.2</domain>");
    expect(networkSecurityConfig).not.toContain(
      'cleartextTrafficPermitted="true" />',
    );
  });
});
