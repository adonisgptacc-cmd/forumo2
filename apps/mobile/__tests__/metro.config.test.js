const path = require("path");

jest.mock("expo/metro-config", () => ({
  getDefaultConfig: () => ({ resolver: {} }),
}));

const config = require("../metro.config");

describe("Metro workspace resolution", () => {
  it("always resolves React from the mobile application", () => {
    const context = { resolveRequest: jest.fn() };

    const resolution = config.resolver.resolveRequest(context, "react", "ios");

    expect(resolution).toEqual({
      filePath: require.resolve("react", {
        paths: [path.resolve(__dirname, "..")],
      }),
      type: "sourceFile",
    });
    expect(context.resolveRequest).not.toHaveBeenCalled();
  });

  it("delegates non-React modules to Metro", () => {
    const expected = { filePath: "/tmp/example.js", type: "sourceFile" };
    const context = {
      resolveRequest: jest.fn(() => expected),
    };

    expect(config.resolver.resolveRequest(context, "example", "ios")).toBe(
      expected,
    );
    expect(context.resolveRequest).toHaveBeenCalledWith(
      context,
      "example",
      "ios",
    );
  });
});
