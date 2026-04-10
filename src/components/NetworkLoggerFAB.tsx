import React, { useRef } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useNetworkLogger } from '../context/NetworkLoggerContext';
import { useTheme } from '../theme';

const FAB_SIZE = 52;
const DEFAULT_BOTTOM = 90;
const DEFAULT_RIGHT = 16;
/** Minimum movement in pixels before a drag gesture is recognised. */
const DRAG_THRESHOLD = 5;

interface Props {
  /**
   * Override the FAB's initial position on screen.
   * Accepts `top`/`left` or `bottom`/`right` offsets (in dp).
   * Defaults to bottom-right (`bottom: 90, right: 16`).
   * When `draggable` is `true` this sets the starting position only;
   * after the first drag the FAB remembers where it was dropped.
   */
  position?: { bottom?: number; right?: number; top?: number; left?: number };
  /**
   * Allow the user to drag the FAB to any position on screen.
   * Defaults to `true`. Uses only React Native core APIs — no extra
   * peer dependencies required.
   */
  draggable?: boolean;
}

/** Converts the `position` prop (bottom/right or top/left) to absolute x/y (top-left origin). */
function resolveInitialPosition(
  position: Props['position'],
  windowWidth: number,
  windowHeight: number
): { x: number; y: number } {
  const x =
    position?.left !== undefined
      ? position.left
      : windowWidth - (position?.right ?? DEFAULT_RIGHT) - FAB_SIZE;

  const y =
    position?.top !== undefined
      ? position.top
      : windowHeight - (position?.bottom ?? DEFAULT_BOTTOM) - FAB_SIZE;

  return { x, y };
}

export const NetworkLoggerFAB = ({ position, draggable = true }: Props = {}) => {
  const { entries, dispatch } = useNetworkLogger();
  const theme = useTheme();

  // Compute initial top/left once; subsequent renders must not re-evaluate
  // because PanResponder and Animated.ValueXY are initialised from this.
  const initialPosition = useRef<{ x: number; y: number }>(null as any);
  if (initialPosition.current === null) {
    const { width, height } = Dimensions.get('window');
    initialPosition.current = resolveInitialPosition(position, width, height);
  }

  // Animated position — x maps to `left`, y maps to `top` via pan.getLayout().
  const pan = useRef(new Animated.ValueXY(initialPosition.current)).current;

  // Tracks the committed position (after each drop) so we can restore it on
  // gesture cancellation and correctly compute the next drag's base point.
  const committed = useRef({ ...initialPosition.current });

  // Allow dynamic toggling of draggable without recreating PanResponder.
  const draggableRef = useRef(draggable);
  draggableRef.current = draggable;

  const panResponder = useRef(
    PanResponder.create({
      // Only capture the gesture once the finger has moved past the threshold.
      // This keeps normal taps flowing through to the inner TouchableOpacity.
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        draggableRef.current &&
        (Math.abs(gestureState.dx) > DRAG_THRESHOLD ||
          Math.abs(gestureState.dy) > DRAG_THRESHOLD),

      onPanResponderGrant: () => {
        // Store the committed position as the offset so the FAB doesn't jump
        // back to the origin when tracking dx/dy from zero.
        pan.setOffset(committed.current);
        pan.setValue({ x: 0, y: 0 });
      },

      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),

      onPanResponderRelease: (_evt, gestureState) => {
        const { width, height } = Dimensions.get('window');
        // Clamp so the FAB always stays fully visible on screen.
        const clampedX = Math.max(
          0,
          Math.min(committed.current.x + gestureState.dx, width - FAB_SIZE)
        );
        const clampedY = Math.max(
          0,
          Math.min(committed.current.y + gestureState.dy, height - FAB_SIZE)
        );
        committed.current = { x: clampedX, y: clampedY };
        // Reset offset and set the final value directly.
        pan.setOffset({ x: 0, y: 0 });
        pan.setValue(committed.current);
      },

      onPanResponderTerminate: () => {
        // Gesture cancelled by the system — spring back to the last committed spot.
        pan.setOffset({ x: 0, y: 0 });
        pan.setValue(committed.current);
      },
    })
  ).current;

  const count = entries.length;
  const badge = count > 99 ? '99+' : String(count);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[styles.fab, { backgroundColor: theme.primary }, pan.getLayout()]}
        {...panResponder.panHandlers}
      >
        {/*
         * TouchableOpacity sits inside the Animated.View so that taps —
         * which never trigger onMoveShouldSetPanResponder — still fire onPress.
         */}
        <TouchableOpacity
          style={styles.fabTouchable}
          onPress={() => dispatch({ type: 'SET_VISIBLE', payload: true })}
          accessibilityRole="button"
          accessibilityLabel="Open Network Logger"
          activeOpacity={0.8}
        >
          <Text style={styles.icon}>📡</Text>
          {count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  fab: {
    position: 'absolute',
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabTouchable: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E32222',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

