import { useEffect, useRef, useState } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const DISPLAY_FONT = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

function getLabel(
  options: BottomTabBarProps['descriptors'][string]['options'],
  routeName: string
) {
  if (typeof options.tabBarLabel === 'string') {
    return options.tabBarLabel;
  }

  if (typeof options.title === 'string') {
    return options.title;
  }

  return routeName;
}

export default function FloatingTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const activeTranslateX = useRef(new Animated.Value(0)).current;
  const itemWidth = barWidth > 0 ? barWidth / state.routes.length : 0;
  const activeTintColor = '#F6D8AB';
  const inactiveTintColor = '#9FB5AD';
  const bottomOffset = Math.max(insets.bottom, 10) + 8;
  const bottomPadding = 8;
  const barHeight = 62;
  const lastScrubIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!itemWidth) {
      return;
    }

    Animated.spring(activeTranslateX, {
      toValue: itemWidth * state.index,
      useNativeDriver: true,
      damping: 17,
      stiffness: 210,
      mass: 0.75,
    }).start();
  }, [activeTranslateX, itemWidth, state.index]);

  const handleBarLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  const indexFromX = (locationX: number) => {
    if (!barWidth || state.routes.length === 0) {
      return state.index;
    }

    const progress = Math.min(Math.max(locationX / barWidth, 0), 0.9999);
    return Math.floor(progress * state.routes.length);
  };

  const navigateToIndex = (index: number) => {
    const route = state.routes[index];

    if (!route || state.index === index) {
      return;
    }

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const handleScrubMove = (event: GestureResponderEvent) => {
    const nextIndex = indexFromX(event.nativeEvent.locationX);

    if (lastScrubIndex.current === nextIndex) {
      return;
    }

    lastScrubIndex.current = nextIndex;
    navigateToIndex(nextIndex);
  };

  const resetScrubState = () => {
    lastScrubIndex.current = null;
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { bottom: bottomOffset }]}>
      <View
        style={[
          styles.container,
          {
            height: barHeight,
            paddingBottom: bottomPadding,
          },
        ]}
        onLayout={handleBarLayout}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleScrubMove}
        onResponderMove={handleScrubMove}
        onResponderRelease={resetScrubState}
        onResponderTerminate={resetScrubState}
      >
        {itemWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeCapsule,
              {
                width: Math.max(itemWidth - 8, 0),
                transform: [{ translateX: activeTranslateX }],
              },
            ]}
          />
        ) : null}

        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          const options = descriptor.options;
          const focused = state.index === index;
          const resolvedActiveTint = options.tabBarActiveTintColor ?? activeTintColor;
          const resolvedInactiveTint =
            options.tabBarInactiveTintColor ?? inactiveTintColor;
          const tintColor = focused ? resolvedActiveTint : resolvedInactiveTint;
          const label = getLabel(options, route.name);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
              activeOpacity={0.9}
            >
              <View style={styles.iconSlot}>
                {options.tabBarIcon?.({
                  focused,
                  color: tintColor,
                  size: 20,
                })}
              </View>
              <Text style={[styles.tabLabel, { color: tintColor }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 18,
    right: 18,
  },
  container: {
    flexDirection: 'row',
    borderRadius: 24,
    borderTopWidth: 0,
    backgroundColor: '#102D24',
    paddingTop: 8,
    shadowColor: '#0D231C',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 18,
    overflow: 'hidden',
  },
  activeCapsule: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(246, 216, 171, 0.14)',
  },
  tabButton: {
    flex: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: DISPLAY_FONT,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 2,
  },
});
