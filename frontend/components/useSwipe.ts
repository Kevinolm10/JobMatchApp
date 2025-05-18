// frontend/hooks/useSwipe.ts

import { useRef } from 'react';
import { Animated, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';

export const useSwipe = (onSwipeComplete: (direction: 'left' | 'right') => void) => {
  const pan = useRef(new Animated.ValueXY()).current;

  const resetPosition = () => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const forceSwipe = (direction: 'left' | 'right') => {
    const x = direction === 'right' ? 500 : -500;

    Animated.timing(pan, {
      toValue: { x, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      onSwipeComplete(direction);
      pan.setValue({ x: 0, y: 0 });
    });
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event(
      [
        null,
        { dx: pan.x},
      ],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (_: GestureResponderEvent, gesture: PanResponderGestureState) => {
      if (gesture.dx > 120) {
        forceSwipe('right');
        console.log('Accepted');
      } else if (gesture.dx < -120) {
        forceSwipe('left');
        console.log('Rejected');
      } else {
        resetPosition();
      }
    },
  });

  return { pan, panResponder };
};
