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
    "ios.sim.debug": {
      type: "ios.app",
      binaryPath:
        "ios/build/Build/Products/Debug-iphonesimulator/ForumoMobile.app",
      build: "bash ./scripts/build-detox-ios.sh",
    },
  },
  devices: {
    simulator: {
      type: "ios.simulator",
      device: {
        type: "iPhone 15",
      },
    },
  },
  configurations: {
    "ios.sim.debug": {
      app: "ios.sim.debug",
      device: "simulator",
    },
  },
};
