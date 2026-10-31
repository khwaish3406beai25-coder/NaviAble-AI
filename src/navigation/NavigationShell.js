import { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import HomeScreen from '../../App';
import { ActionButton } from '../components/ActionButton';
import HelpScreen from '../screens/HelpScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../styles/theme';

const screens = [
  { id: 'home', label: 'Home', hint: 'Show the NaviAble AI dashboard.' },
  { id: 'settings', label: 'Settings', hint: 'Show text size and accessibility information.' },
  { id: 'help', label: 'Help', hint: 'Explain the app features and how to get started.' },
];

export default function NavigationShell() {
  const [activeScreen, setActiveScreen] = useState('home');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View accessibilityRole="tablist" style={styles.navigation}>
        {screens.map((screen) => (
          <ActionButton
            key={screen.id}
            label={screen.label}
            role="tab"
            hint={screen.hint}
            selected={activeScreen === screen.id}
            onPress={() => setActiveScreen(screen.id)}
          />
        ))}
      </View>
      <View style={styles.screen}>
        {activeScreen === 'home' ? <HomeScreen /> : null}
        {activeScreen === 'settings' ? <SettingsScreen /> : null}
        {activeScreen === 'help' ? <HelpScreen /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  navigation: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  screen: { flex: 1, minHeight: 0 },
});
