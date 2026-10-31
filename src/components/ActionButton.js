import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../styles/theme';

export function ActionButton({ label, onPress, selected = false, hint, role = 'button', style }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={role === 'tab' ? { selected } : undefined}
      style={({ pressed }) => [styles.button, selected && styles.selected, pressed && styles.pressed, style]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, flex: 1, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  selected: { backgroundColor: colors.softLavender, borderColor: colors.border },
  label: { color: colors.secondaryText, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  selectedLabel: { color: colors.deepLavender, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
