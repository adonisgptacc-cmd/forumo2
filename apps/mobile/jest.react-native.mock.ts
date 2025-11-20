import React from 'react';

const View: React.FC<React.PropsWithChildren> = ({ children, ...rest }) => React.createElement('div', rest, children);
const Text: React.FC<React.PropsWithChildren> = ({ children, ...rest }) => React.createElement('span', rest, children);
const Button: React.FC<{ title: string; onPress?: () => void }> = ({ title }) => React.createElement('button', null, title);
const FlatList: React.FC<any> = ({ data = [], renderItem }) =>
  React.createElement('div', null, data.map((item: any, index: number) => renderItem({ item, index })));

export const StyleSheet = { create: (styles: Record<string, unknown>) => styles };
export const ActivityIndicator = () => React.createElement('div', null, 'loading');
export const RefreshControl = () => null;
export const Alert = { alert: () => {} };
export { View, Text, Button, FlatList };

export default {
  View,
  Text,
  Button,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
};
