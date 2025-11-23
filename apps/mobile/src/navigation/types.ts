export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Discover: undefined;
  Inbox: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  Thread: { threadId: string; thread?: import('@forumo/shared').SafeMessageThread };
};
