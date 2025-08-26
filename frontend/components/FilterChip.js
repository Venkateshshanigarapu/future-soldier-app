import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { green } from '../theme';

const FilterChip = ({ 
  label, 
  icon, 
  isActive = false, 
  onPress, 
  style,
  textStyle,
  iconStyle,
  compact = false,
}) => {
  return (
    <TouchableOpacity 
      style={[
        styles.chip, 
        compact && styles.compactChip,
        isActive && styles.activeChip,
        style
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon && (
        <Icon 
          name={icon} 
          size={compact ? 14 : 16} 
          color={isActive ? '#FFFFFF' : green.dark} 
          style={[styles.icon, iconStyle]}
        />
      )}
      <Text style={[
        styles.text, 
        compact && styles.compactText,
        isActive && styles.activeText,
        textStyle
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: green.background,
    borderWidth: 1,
    borderColor: green.dark,
  },
  compactChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
  },
  activeChip: {
    backgroundColor: green.primary,
    borderColor: green.primary,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: green.dark,
  },
  compactText: {
    fontSize: 12,
  },
  activeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default FilterChip;
