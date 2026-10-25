import { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import COLORS from '../theme/colors';

const ANIMATION = {
  totalDuration: 1900,
  openingDuration: 720,
  fadeOutDuration: 240,
};

// Mantém a splash nativa visível até que a camada animada esteja pronta.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function AnimatedSplashScreen() {
  const [visible, setVisible] = useState(true);
  const hasStarted = useRef(false);
  const [animationValues] = useState(() => ({
    overlayOpacity: new Animated.Value(1),
    bookOpacity: new Animated.Value(0),
    bookScale: new Animated.Value(0.86),
    opening: new Animated.Value(0),
    glowOpacity: new Animated.Value(0),
    nameOpacity: new Animated.Value(0),
    nameTranslateY: new Animated.Value(10),
    sloganOpacity: new Animated.Value(0),
    sloganTranslateY: new Animated.Value(8),
  }));
  const {
    overlayOpacity,
    bookOpacity,
    bookScale,
    opening,
    glowOpacity,
    nameOpacity,
    nameTranslateY,
    sloganOpacity,
    sloganTranslateY,
  } = animationValues;

  const startAnimation = useCallback(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    void SplashScreen.hideAsync().catch(() => undefined);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(bookOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(bookScale, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opening, {
          toValue: 1,
          duration: ANIMATION.openingDuration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(620),
          Animated.sequence([
            Animated.timing(glowOpacity, {
              toValue: 0.62,
              duration: 240,
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.28,
              duration: 360,
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(700),
          Animated.parallel([
            Animated.timing(nameOpacity, {
              toValue: 1,
              duration: 420,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(nameTranslateY, {
              toValue: 0,
              duration: 420,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(1120),
          Animated.parallel([
            Animated.timing(sloganOpacity, {
              toValue: 1,
              duration: 360,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(sloganTranslateY, {
              toValue: 0,
              duration: 360,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),
      Animated.delay(
        Math.max(
          0,
          ANIMATION.totalDuration - 1120 - 360 - ANIMATION.fadeOutDuration
        )
      ),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: ANIMATION.fadeOutDuration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [
    bookOpacity,
    bookScale,
    glowOpacity,
    nameOpacity,
    nameTranslateY,
    opening,
    overlayOpacity,
    sloganOpacity,
    sloganTranslateY,
  ]);

  const handleLayout = useCallback(() => {
    startAnimation();
  }, [startAnimation]);

  const leftPageRotation = opening.interpolate({
    inputRange: [0, 1],
    outputRange: ['-68deg', '-8deg'],
  });
  const rightPageRotation = opening.interpolate({
    inputRange: [0, 1],
    outputRange: ['68deg', '8deg'],
  });

  return (
    <>
      <StatusBar style={visible ? 'light' : 'dark'} />
      {visible && (
        <Animated.View
          onLayout={handleLayout}
          pointerEvents="auto"
          style={[styles.overlay, { opacity: overlayOpacity }]}
        >
          <View style={styles.content}>
            <Animated.View
              style={[
                styles.bookMark,
                {
                  opacity: bookOpacity,
                  transform: [{ scale: bookScale }],
                },
              ]}
            >
              <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />
              <View style={styles.book}>
                <Animated.View
                  style={[
                    styles.page,
                    styles.leftPage,
                    {
                      transform: [
                        { perspective: 420 },
                        { rotateY: leftPageRotation },
                      ],
                    },
                  ]}
                >
                  <View style={styles.pageLine} />
                  <View style={[styles.pageLine, styles.shortPageLine]} />
                  <View style={[styles.pageLine, styles.shortPageLine]} />
                </Animated.View>
                <Animated.View
                  style={[
                    styles.page,
                    styles.rightPage,
                    {
                      transform: [
                        { perspective: 420 },
                        { rotateY: rightPageRotation },
                      ],
                    },
                  ]}
                >
                  <View style={styles.pageLine} />
                  <View style={[styles.pageLine, styles.shortPageLine]} />
                  <View style={[styles.pageLine, styles.shortPageLine]} />
                </Animated.View>
                <View style={styles.spine} />
                <View style={styles.bookBase} />
              </View>
            </Animated.View>

            <Animated.Text
              style={[
                styles.name,
                {
                  opacity: nameOpacity,
                  transform: [{ translateY: nameTranslateY }],
                },
              ]}
            >
              Bentora
            </Animated.Text>

            <Animated.Text
              style={[
                styles.slogan,
                {
                  opacity: sloganOpacity,
                  transform: [{ translateY: sloganTranslateY }],
                },
              ]}
            >
              Leia. Reflita. Guarde o que importa.
            </Animated.Text>
          </View>
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bookMark: {
    width: 150,
    height: 118,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  glow: {
    position: 'absolute',
    width: 142,
    height: 100,
    borderRadius: 70,
    backgroundColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.7,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  book: {
    width: 116,
    height: 82,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  page: {
    width: 58,
    height: 72,
    backgroundColor: COLORS.backgroundLight,
    borderColor: COLORS.gold,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: 8,
    gap: 7,
    backfaceVisibility: 'hidden',
  },
  leftPage: {
    borderLeftWidth: 2,
    borderTopLeftRadius: 7,
    borderBottomLeftRadius: 4,
    alignItems: 'flex-end',
  },
  rightPage: {
    borderRightWidth: 2,
    borderTopRightRadius: 7,
    borderBottomRightRadius: 4,
    alignItems: 'flex-start',
  },
  pageLine: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.cream,
    opacity: 0.65,
  },
  shortPageLine: {
    width: '72%',
  },
  spine: {
    position: 'absolute',
    width: 2,
    height: 74,
    alignSelf: 'center',
    top: 5,
    backgroundColor: COLORS.gold,
    opacity: 0.9,
  },
  bookBase: {
    position: 'absolute',
    height: 2,
    left: 0,
    right: 0,
    bottom: 4,
    backgroundColor: COLORS.gold,
    opacity: 0.75,
  },
  name: {
    marginTop: 8,
    color: COLORS.cream,
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontSize: 38,
    letterSpacing: 1.2,
    lineHeight: 48,
  },
  slogan: {
    marginTop: 8,
    color: COLORS.gold,
    fontSize: 13,
    letterSpacing: 0.7,
    textAlign: 'center',
  },
});
