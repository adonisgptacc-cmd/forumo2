import type { DetoxConfig } from 'detox';

const config: DetoxConfig = {
  testRunner: 'jest',
  runnerConfig: 'e2e/jest.config.js',
  skipLegacyWorkersInstantiation: true,
  apps: {
    'ios.sim.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/ForumoMobile.app',
      build: 'echo "Stub build command for CI"',
    },
  },
  devices: {
    'ios.sim.debug': {
      type: 'ios.simulator',
      device: { type: 'iPhone 15' },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'ios.sim.debug',
      app: 'ios.sim.debug',
    },
  },
};

export default config;
