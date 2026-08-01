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
});
