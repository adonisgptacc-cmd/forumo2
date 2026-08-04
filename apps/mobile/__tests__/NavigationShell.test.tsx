import React from "react";
import renderer, { act } from "react-test-renderer";
import { NavigationShell } from "../src/navigation/AppNavigator";
import { AuthProvider } from "../src/providers/AuthProvider";

jest.mock("../src/hooks/usePushNotifications", () => ({
  usePushNotifications: jest.fn(),
}));

describe("NavigationShell", () => {
  it("renders the navigation container", async () => {
    let tree: renderer.ReactTestRenderer;

    await act(async () => {
      tree = renderer.create(
        <AuthProvider>
          <NavigationShell />
        </AuthProvider>,
      );
    });

    expect(tree!.toJSON()).toMatchSnapshot();
  });
});
