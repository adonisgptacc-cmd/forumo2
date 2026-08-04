import resolveConfig from "../app.config";

describe("mobile app configuration", () => {
  it("defines the splash resources required by Android prebuild", () => {
    const config = resolveConfig({
      config: {},
      projectRoot: ".",
      staticConfigPath: null,
      packageJsonPath: "package.json",
    });

    expect(config.splash).toEqual({
      backgroundColor: "#ffffff",
      resizeMode: "contain",
    });
  });

  it("enables the Android Detox config plugin only for Detox builds", () => {
    const previousDetoxAndroid = process.env.DETOX_ANDROID;

    try {
      delete process.env.DETOX_ANDROID;
      const standardConfig = resolveConfig({
        config: {},
        projectRoot: ".",
        staticConfigPath: null,
        packageJsonPath: "package.json",
      });

      process.env.DETOX_ANDROID = "true";
      const detoxConfig = resolveConfig({
        config: {},
        projectRoot: ".",
        staticConfigPath: null,
        packageJsonPath: "package.json",
      });

      expect(standardConfig.plugins).not.toContain(
        "./plugins/withDetoxAndroid",
      );
      expect(detoxConfig.plugins).toContain("./plugins/withDetoxAndroid");

      const standardBuildProperties = standardConfig.plugins?.find(
        (plugin) =>
          Array.isArray(plugin) && plugin[0] === "expo-build-properties",
      );
      const detoxBuildProperties = detoxConfig.plugins?.find(
        (plugin) =>
          Array.isArray(plugin) && plugin[0] === "expo-build-properties",
      );

      expect(standardBuildProperties?.[1]).not.toHaveProperty("android");
      expect(detoxBuildProperties?.[1]).toMatchObject({
        android: { minSdkVersion: 24 },
      });
    } finally {
      if (previousDetoxAndroid === undefined) {
        delete process.env.DETOX_ANDROID;
      } else {
        process.env.DETOX_ANDROID = previousDetoxAndroid;
      }
    }
  });
});
