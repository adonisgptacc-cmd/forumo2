const fs = require("node:fs/promises");
const path = require("node:path");
const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withProjectBuildGradle,
} = require("expo/config-plugins");
const { version: detoxVersion } = require("detox/package.json");

const detoxMavenRepository =
  'maven { url("$rootDir/../node_modules/detox/Detox-android") }';
const detoxDependency = `androidTestImplementation('com.wix:detox:${detoxVersion}')`;

const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">localhost</domain>
        <domain includeSubdomains="false">10.0.2.2</domain>
    </domain-config>
</network-security-config>
`;

function insertAfterOpeningBlock(source, blockName, addition) {
  const openingBlock = new RegExp(`(${blockName}\\s*\\{)`);

  if (!openingBlock.test(source)) {
    throw new Error(
      `Unable to configure Detox: ${blockName} block was not found`,
    );
  }

  return source.replace(openingBlock, `$1\n        ${addition}`);
}

function patchProjectBuildGradle(source) {
  if (source.includes(detoxMavenRepository)) {
    return source;
  }

  const allProjectsRepositories = /(allprojects\s*\{[\s\S]*?repositories\s*\{)/;

  if (!allProjectsRepositories.test(source)) {
    throw new Error(
      "Unable to configure Detox: allprojects repositories block was not found",
    );
  }

  return source.replace(
    allProjectsRepositories,
    `$1\n        ${detoxMavenRepository}`,
  );
}

function patchAppBuildGradle(source) {
  let nextSource = source;

  if (
    !nextSource.includes(
      "testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'",
    )
  ) {
    nextSource = insertAfterOpeningBlock(
      nextSource,
      "defaultConfig",
      "testInstrumentationRunner 'androidx.test.runner.AndroidJUnitRunner'",
    );
  }

  if (
    !nextSource.includes(
      "testBuildType System.getProperty('testBuildType', 'debug')",
    )
  ) {
    nextSource = insertAfterOpeningBlock(
      nextSource,
      "defaultConfig",
      "testBuildType System.getProperty('testBuildType', 'debug')",
    );
  }

  if (!nextSource.includes(detoxDependency)) {
    nextSource = insertAfterOpeningBlock(
      nextSource,
      "dependencies",
      detoxDependency,
    );
  }

  if (!nextSource.includes("androidx.appcompat:appcompat")) {
    nextSource = insertAfterOpeningBlock(
      nextSource,
      "dependencies",
      'implementation("androidx.appcompat:appcompat:1.6.1")',
    );
  }

  return nextSource;
}

function createDetoxTestSource(androidPackage) {
  return `package ${androidPackage};

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.LargeTest;
import androidx.test.rule.ActivityTestRule;

import com.wix.detox.Detox;
import com.wix.detox.config.DetoxConfig;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
@LargeTest
public class DetoxTest {
    @Rule
    public ActivityTestRule<MainActivity> mActivityRule =
        new ActivityTestRule<>(MainActivity.class, false, false);

    @Test
    public void runDetoxTests() {
        DetoxConfig detoxConfig = new DetoxConfig();
        detoxConfig.idlePolicyConfig.masterTimeoutSec = 90;
        detoxConfig.idlePolicyConfig.idleResourceTimeoutSec = 60;
        detoxConfig.rnContextLoadTimeoutSec = BuildConfig.DEBUG ? 180 : 60;
        Detox.runTests(mActivityRule, detoxConfig);
    }
}
`;
}

function withDetoxAndroid(config) {
  const androidPackage = config.android?.package;

  if (!androidPackage) {
    throw new Error("Android package is required to configure Detox");
  }

  let nextConfig = withProjectBuildGradle(config, (modConfig) => ({
    ...modConfig,
    modResults: {
      ...modConfig.modResults,
      contents: patchProjectBuildGradle(modConfig.modResults.contents),
    },
  }));

  nextConfig = withAppBuildGradle(nextConfig, (modConfig) => ({
    ...modConfig,
    modResults: {
      ...modConfig.modResults,
      contents: patchAppBuildGradle(modConfig.modResults.contents),
    },
  }));

  nextConfig = withAndroidManifest(nextConfig, (modConfig) => {
    const currentApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      modConfig.modResults,
    );
    const nextApplication = {
      ...currentApplication,
      $: {
        ...currentApplication.$,
        "android:networkSecurityConfig": "@xml/network_security_config",
      },
    };
    const applications = modConfig.modResults.manifest.application ?? [];

    return {
      ...modConfig,
      modResults: {
        ...modConfig.modResults,
        manifest: {
          ...modConfig.modResults.manifest,
          application: applications.map((application) =>
            application === currentApplication ? nextApplication : application,
          ),
        },
      },
    };
  });

  return withDangerousMod(nextConfig, [
    "android",
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.platformProjectRoot;
      const resourcesDirectory = path.join(
        projectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      );
      const androidTestDirectory = path.join(
        projectRoot,
        "app",
        "src",
        "androidTest",
        "java",
        ...androidPackage.split("."),
      );

      await Promise.all([
        fs.mkdir(resourcesDirectory, { recursive: true }),
        fs.mkdir(androidTestDirectory, { recursive: true }),
      ]);
      await Promise.all([
        fs.writeFile(
          path.join(resourcesDirectory, "network_security_config.xml"),
          networkSecurityConfig,
        ),
        fs.writeFile(
          path.join(androidTestDirectory, "DetoxTest.java"),
          createDetoxTestSource(androidPackage),
        ),
      ]);

      return modConfig;
    },
  ]);
}

module.exports = withDetoxAndroid;
module.exports.createDetoxTestSource = createDetoxTestSource;
module.exports.detoxVersion = detoxVersion;
module.exports.networkSecurityConfig = networkSecurityConfig;
module.exports.patchAppBuildGradle = patchAppBuildGradle;
module.exports.patchProjectBuildGradle = patchProjectBuildGradle;
